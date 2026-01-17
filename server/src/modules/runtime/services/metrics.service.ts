import { defineService } from "@server/src/core/modules";
import type {
  MetricsSnapshot,
  NodeInspectPayload,
  NodeMetrics,
  EdgeMetrics,
} from "@shared/metrics";
import type { Span } from "@shared/trace";
import type { Run } from "@shared/run";

import type { SchedulerObserver } from "../lib/scheduler";
import type { RuntimeToken } from "../types";

const SNAPSHOT_INTERVAL_MS = 200;
const LATENCY_ALPHA = 0.2;
const ERROR_ALPHA = 0.2;
const EDGE_ERROR_ALPHA = 0.2;
const SPAN_TTL_MS = 120_000;
const TRACE_BUFFER_LIMIT = 50;
const SLOW_THRESHOLD_MS = 750;
const EDGE_ATTR_KEY = "__last_edge";

type TraceEvent = {
  type: "trace.span.started" | "trace.span.ended";
  span: Span;
};

const ema = (current: number, sample: number, alpha = 0.2): number => {
  if (!Number.isFinite(current) || current === 0) return sample;
  return current * (1 - alpha) + sample * alpha;
};

class RingBuffer<T> {
  #store: T[] = [];
  constructor(private readonly limit: number) {}

  push(value: T) {
    this.#store.unshift(value);
    if (this.#store.length > this.limit) {
      this.#store.pop();
    }
  }

  values() {
    return [...this.#store];
  }

  clear() {
    this.#store = [];
  }
}

type NodeTraceBuffers = {
  recent: RingBuffer<string>;
  errors: RingBuffer<string>;
  slow: RingBuffer<string>;
};

type NodeState = {
  nodeId: string;
  avgLatencyMs: number;
  errorRate: number;
  throughput: number;
  inflight: number;
  queueLen: number;
  lastProcessed: number;
  lastFailed: number;
  traces: NodeTraceBuffers;
};

type EdgeState = {
  edgeId: string;
  from: string;
  to: string;
  throughput: number;
  errorRate: number;
  pendingTransfers: number;
  pendingErrors: number;
};

type TraceSpanEntry = {
  spans: Map<string, Span>;
  updatedAt: number;
};

const makeTraceBuffers = (): NodeTraceBuffers => ({
  recent: new RingBuffer(TRACE_BUFFER_LIMIT),
  errors: new RingBuffer(TRACE_BUFFER_LIMIT),
  slow: new RingBuffer(TRACE_BUFFER_LIMIT),
});

export const metricsService = defineService("runtime", ({ services }) => {
  const nodeStates = new Map<string, NodeState>();
  const edgeStatesByKey = new Map<string, EdgeState>();
  const edgeStatesById = new Map<string, EdgeState>();
  const nodeMetrics = new Map<string, NodeMetrics>();
  const edgeMetrics = new Map<string, EdgeMetrics>();
  const traceStore = new Map<string, TraceSpanEntry>();
  const activeSpans = new Map<string, Span>();
  const snapshotListeners = new Set<(snapshot: MetricsSnapshot) => void>();
  const traceSubscribers = new Map<string, Set<(event: TraceEvent) => void>>();

  let latestSnapshot: MetricsSnapshot = {
    runId: "idle",
    seq: 0,
    tServerMs: 0,
    nodes: [],
    edges: [],
  };
  let runId: string | null = null;
  let runStartedAt = 0;
  let lastSampleAt = 0;
  let seq = 0;
  let snapshotTimer: NodeJS.Timeout | null = null;

  const runtime = services.runtime;

  const schedulerObserver: SchedulerObserver = {
    onNodeStart({ nodeId, token, startTime }) {
      if (!runId) return;
      const spanId = `${token.trace.traceId}:${nodeId}:${startTime}`;
      const span: Span = {
        spanId,
        traceId: token.trace.traceId,
        nodeId,
        name: nodeId,
        startTime,
        endTime: null,
        status: "running",
      };
      activeSpans.set(`${token.trace.traceId}:${nodeId}`, span);
      upsertTraceSpan(span);
      emitTraceEvent(token.trace.traceId, {
        type: "trace.span.started",
        span,
      });
    },
    onNodeComplete({
      nodeId,
      token,
      status,
      durationMs,
      endTime,
      errorMessage,
    }) {
      if (!runId) return;
      finalizeSpan(nodeId, token, status, endTime, durationMs, errorMessage);
      updateNodeTraces(nodeId, token.trace.traceId, status, durationMs);
      if (status === "error") {
        const lastEdgeId = token.attributes[EDGE_ATTR_KEY];
        if (typeof lastEdgeId === "string") {
          const edgeState = edgeStatesById.get(lastEdgeId);
          if (edgeState) edgeState.pendingErrors += 1;
        }
      }
    },
    onEdgeTransfer({ fromNodeId, toNodeId, token }) {
      if (!runId) return;
      const key = edgeKey(fromNodeId, toNodeId);
      const edgeState = edgeStatesByKey.get(key);
      if (edgeState) {
        edgeState.pendingTransfers += 1;
        token.attributes[EDGE_ATTR_KEY] = edgeState.edgeId;
      }
    },
  };

  runtime.attachObserver(schedulerObserver);

  runtime.onRunLifecycle({
    onRunStart(run) {
      resetState(run);
    },
    onRunStop() {
      stopSampling();
    },
  });

  const edgeKey = (from: string, to: string) => `${from}->${to}`;

  const resetState = (run: Run) => {
    runId = run.runId;
    seq = 0;
    runStartedAt = Date.now();
    lastSampleAt = runStartedAt;
    nodeStates.clear();
    edgeStatesByKey.clear();
    edgeStatesById.clear();
    nodeMetrics.clear();
    edgeMetrics.clear();
    traceStore.clear();
    activeSpans.clear();

    const graph = runtime.getGraph();
    for (const node of graph.nodes) {
      nodeStates.set(node.nodeId, {
        nodeId: node.nodeId,
        avgLatencyMs: 0,
        errorRate: 0,
        throughput: 0,
        inflight: 0,
        queueLen: 0,
        lastProcessed: 0,
        lastFailed: 0,
        traces: makeTraceBuffers(),
      });
    }

    for (const edge of graph.edges) {
      const state: EdgeState = {
        edgeId: edge.edgeId,
        from: edge.from,
        to: edge.to,
        throughput: 0,
        errorRate: 0,
        pendingTransfers: 0,
        pendingErrors: 0,
      };
      edgeStatesByKey.set(edgeKey(edge.from, edge.to), state);
      edgeStatesById.set(edge.edgeId, state);
      edgeMetrics.set(edge.edgeId, {
        edgeId: edge.edgeId,
        from: edge.from,
        to: edge.to,
        rate: 0,
        errorRate: 0,
      });
    }

    startSampling();
  };

  const clearSamplingTimer = () => {
    if (snapshotTimer) {
      clearInterval(snapshotTimer);
      snapshotTimer = null;
    }
  };

  const startSampling = () => {
    clearSamplingTimer();
    snapshotTimer = setInterval(sampleMetrics, SNAPSHOT_INTERVAL_MS);
  };

  const stopSampling = () => {
    clearSamplingTimer();
    runId = null;
  };

  const sampleMetrics = () => {
    if (!runId) return;
    const now = Date.now();
    const deltaMs = Math.max(1, now - lastSampleAt);
    lastSampleAt = now;
    const schedulerSnapshot = runtime.getSchedulerSnapshot();

    for (const row of schedulerSnapshot) {
      const state = nodeStates.get(row.nodeId);
      if (!state) continue;
      const processedDelta = row.processed - state.lastProcessed;
      const failedDelta = row.failed - state.lastFailed;
      state.lastProcessed = row.processed;
      state.lastFailed = row.failed;
      const completions = processedDelta + failedDelta;
      const throughput =
        completions > 0 ? completions / (deltaMs / 1000) : state.throughput * 0.9;
      state.throughput = throughput;
      const errorSample = completions > 0 ? failedDelta / completions : 0;
      state.errorRate = ema(state.errorRate, errorSample, ERROR_ALPHA);
      state.inflight = row.inflight;
      state.queueLen = row.queueLength;
      nodeMetrics.set(row.nodeId, {
        nodeId: row.nodeId,
        inflight: state.inflight,
        queueLen: state.queueLen,
        throughput: state.throughput,
        avgLatencyMs: state.avgLatencyMs,
        errorRate: state.errorRate,
      });
    }

    for (const state of edgeStatesById.values()) {
      const throughput =
        state.pendingTransfers > 0
          ? state.pendingTransfers / (deltaMs / 1000)
          : state.throughput * 0.9;
      state.throughput = throughput;
      const errorSample =
        state.pendingTransfers > 0
          ? state.pendingErrors / state.pendingTransfers
          : 0;
      state.errorRate = ema(state.errorRate, errorSample, EDGE_ERROR_ALPHA);
      edgeMetrics.set(state.edgeId, {
        edgeId: state.edgeId,
        from: state.from,
        to: state.to,
        rate: state.throughput,
        errorRate: state.errorRate,
      });
      state.pendingTransfers = 0;
      state.pendingErrors = 0;
    }

    cleanupTraceStore(now);

    latestSnapshot = {
      runId,
      seq: seq++,
      tServerMs: now - runStartedAt,
      nodes: [...nodeMetrics.values()],
      edges: [...edgeMetrics.values()],
    };
    notifySnapshot();
  };

  const finalizeSpan = (
    nodeId: string,
    token: RuntimeToken,
    status: "ok" | "error",
    endTime: number,
    durationMs: number,
    errorMessage?: string,
  ) => {
    const key = `${token.trace.traceId}:${nodeId}`;
    const span = activeSpans.get(key);
    if (span) {
      span.endTime = endTime;
      span.status = status === "ok" ? "ok" : "error";
      if (status === "error" && errorMessage) {
        span.error = { code: errorMessage, message: errorMessage };
      } else {
        delete span.error;
      }
      upsertTraceSpan(span);
      activeSpans.delete(key);
      emitTraceEvent(token.trace.traceId, {
        type: "trace.span.ended",
        span,
      });
    }
    const state = nodeStates.get(nodeId);
    if (state) {
      state.avgLatencyMs = ema(state.avgLatencyMs, durationMs, LATENCY_ALPHA);
    }
  };

  const updateNodeTraces = (
    nodeId: string,
    traceId: string,
    status: "ok" | "error",
    durationMs: number,
  ) => {
    const state = nodeStates.get(nodeId);
    if (!state) return;
    const buffers = state.traces;
    buffers.recent.push(traceId);
    if (status === "error") buffers.errors.push(traceId);
    const slowCutoff =
      state.avgLatencyMs > 0
        ? Math.max(SLOW_THRESHOLD_MS, state.avgLatencyMs * 1.5)
        : SLOW_THRESHOLD_MS;
    if (durationMs > slowCutoff) buffers.slow.push(traceId);
  };

  const upsertTraceSpan = (span: Span) => {
    const record = traceStore.get(span.traceId) ?? {
      spans: new Map<string, Span>(),
      updatedAt: 0,
    };
    record.spans.set(span.spanId, { ...span });
    record.updatedAt = Date.now();
    traceStore.set(span.traceId, record);
  };

  const cleanupTraceStore = (now: number) => {
    for (const [traceId, record] of traceStore.entries()) {
      if (now - record.updatedAt > SPAN_TTL_MS) {
        traceStore.delete(traceId);
      }
    }
  };

  const getNodeInspect = (nodeId: string): NodeInspectPayload | null => {
    const metrics = nodeMetrics.get(nodeId);
    const state = nodeStates.get(nodeId);
    if (!metrics || !state) return null;
    return {
      nodeId,
      metrics,
      recentTraceIds: state.traces.recent.values(),
      errorTraceIds: state.traces.errors.values(),
      slowTraceIds: state.traces.slow.values(),
    };
  };

  const notifySnapshot = () => {
    for (const listener of snapshotListeners) {
      listener(latestSnapshot);
    }
  };

  const emitTraceEvent = (traceId: string, event: TraceEvent) => {
    const listeners = traceSubscribers.get(traceId);
    if (!listeners || listeners.size === 0) return;
    for (const listener of listeners) {
      listener(event);
    }
  };

  const subscribeTrace = (
    traceId: string,
    listener: (event: TraceEvent) => void,
  ) => {
    const set = traceSubscribers.get(traceId) ?? new Set();
    set.add(listener);
    traceSubscribers.set(traceId, set);
    return () => {
      const nextSet = traceSubscribers.get(traceId);
      if (!nextSet) return;
      nextSet.delete(listener);
      if (nextSet.size === 0) {
        traceSubscribers.delete(traceId);
      }
    };
  };

  const getTraceSpans = (traceId: string): Span[] => {
    const entry = traceStore.get(traceId);
    if (!entry) return [];
    return [...entry.spans.values()].sort(
      (a, b) => a.startTime - b.startTime,
    );
  };

  return {
    getSnapshot(): MetricsSnapshot {
      return latestSnapshot;
    },
    getNodeInspect,
    getTraceSpans,
    onSnapshot(listener: (snapshot: MetricsSnapshot) => void) {
      snapshotListeners.add(listener);
      return () => snapshotListeners.delete(listener);
    },
    subscribeTrace,
  };
});

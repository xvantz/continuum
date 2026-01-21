import type { Graph } from "@shared/graph";
import type { MetricsSnapshot, NodeInspectPayload } from "@shared/metrics";
import type { Run } from "@shared/run";
import type { SimulationControls } from "@shared/controls";
import type { Span } from "@shared/trace";
import { get, type Writable } from "svelte/store";
import { RuntimeClient } from "../runtimeClient";
import { findPreviousNode, sortSpans, upsertSpan } from "./traceUtils";

export type TraceSubscriptionState = "idle" | "loading" | "ready";

export type TraceTransition = {
  from: string | null;
  to: string;
  startedAt: number;
};

export type TraceVisualState = {
  traceId: string;
  activeNodeId: string | null;
  transition: TraceTransition | null;
};

export type WsError = { code: string; message: string; details?: unknown };

type LiveRuntimeBindings = {
  graph: Writable<Graph | null>;
  snapshot: Writable<MetricsSnapshot | null>;
  run: Writable<Run | null>;
  status: Writable<"connecting" | "connected" | "disconnected" | "replay">;
  wsError: Writable<WsError | null>;
  nodeInspect: Writable<NodeInspectPayload | null>;
  traceSpans: Writable<Span[]>;
  traceStatus: Writable<TraceSubscriptionState>;
  traceVisualState: Writable<TraceVisualState | null>;
  serverTimelineMs: Writable<number>;
  getMode: () => "live" | "replay";
  getActiveTraceId: () => string | null;
  getSelectedNodeId: () => string | null;
  onDisconnect: () => void;
  onRuntimeState?: (run: Run | null) => void;
};

export const createLiveRuntime = (
  client: RuntimeClient,
  bindings: LiveRuntimeBindings,
) => {
  const {
    graph,
    snapshot,
    run,
    status,
    wsError,
    nodeInspect,
    traceSpans,
    traceStatus,
    traceVisualState,
    serverTimelineMs,
    getMode,
    getActiveTraceId,
    getSelectedNodeId,
    onDisconnect,
  } = bindings;

  const formatWsError = (error: WsError): WsError => {
    const code = error.code;
    let message = error.message;

    const controlHints: Record<
      string,
      { label: string; fix: string }
    > = {
      requestRate: {
        label: "Rate (req/s)",
        fix: "Set Rate between 20 and 200.",
      },
      payloadComplexity: {
        label: "Complexity",
        fix: "Set Complexity between 1 and 5.",
      },
      nodeConcurrency: {
        label: "Concurrency",
        fix: "Set Concurrency between 1 and 8.",
      },
      failureRate: {
        label: "Failure Rate (%)",
        fix: "Set Failure Rate between 0 and 20.",
      },
      seed: {
        label: "Seed",
        fix: "Use an integer seed value.",
      },
      runDurationMs: {
        label: "Time Limit (sec)",
        fix: "Set Time Limit between 0 and 3600 seconds.",
      },
    };

    const buildIssueMessage = (issue: {
      path?: unknown;
      message?: string;
    }) => {
      const path = Array.isArray(issue.path)
        ? issue.path.map(String)
        : [];
      let field: string | null = null;
      for (let i = path.length - 1; i >= 0; i -= 1) {
        const candidate = path[i];
        if (controlHints[candidate]) {
          field = candidate;
          break;
        }
      }
      if (field) {
        const hint = controlHints[field];
        return `${hint.label} is invalid. Fix: ${hint.fix}`;
      }
      if (path.length > 0) {
        return `${path.join(".")}: ${issue.message ?? "Invalid value"}`;
      }
      return issue.message ?? "Invalid value";
    };

    const formatIssues = (issues: Array<{ path?: unknown; message?: string }>) =>
      issues
        .slice(0, 3)
        .map(buildIssueMessage)
        .join(" ");

    const normalizeMessage = (value: unknown): string | null => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            return normalizeMessage(JSON.parse(trimmed));
          } catch {
            return value;
          }
        }
        return value;
      }
      if (Array.isArray(value)) {
        const formatted = formatIssues(value);
        return formatted || "Invalid payload";
      }
      if (value && typeof value === "object") {
        const candidate = value as {
          message?: unknown;
          error?: unknown;
          issues?: unknown;
        };
        if (Array.isArray(candidate.issues)) {
          const formatted = formatIssues(
            candidate.issues as Array<{ path?: unknown; message?: string }>,
          );
          return formatted || "Invalid payload";
        }
        if (typeof candidate.message === "string") {
          return candidate.message;
        }
        if (typeof candidate.error === "string") {
          return candidate.error;
        }
      }
      return null;
    };

    const detailedMessage = error.details
      ? normalizeMessage(error.details)
      : null;
    message = detailedMessage ?? normalizeMessage(message) ?? "Unexpected error";
    const friendly = {
      run_already_active:
        "Run is already active. Fix: press Stop, then Start again.",
      run_not_active: "No active run to stop. Fix: start a run first.",
      trace_already_subscribed:
        "Trace is already being streamed. Fix: close the current trace before subscribing again.",
      trace_not_subscribed:
        "Trace is not subscribed. Fix: select a trace ID from the list.",
      node_not_found:
        "Selected node is no longer available. Fix: pick a node from the graph.",
      invalid_payload:
        "Some inputs are invalid. Fix: update the highlighted settings.",
      invalid_json:
        "Invalid request format. Fix: reload the page and try again.",
    }[code];
    const resolvedMessage =
      code === "invalid_payload" && message !== "Unexpected error"
        ? message
        : friendly ?? message;
    return {
      code,
      message: resolvedMessage,
    };
  };

  const connect = () => {
    if (getMode() !== "live") return;
    status.set("connecting");
    wsError.set(null);
    client.connect();
  };

  const disconnect = () => {
    client.disconnect();
  };

  const reconnect = () => {
    client.reconnect();
  };

  const startRun = (controls: SimulationControls) => {
    if (getMode() !== "live") return;
    client.send({ type: "run.start", controls });
  };

  const stopRun = () => {
    if (getMode() !== "live") return;
    client.send({ type: "run.stop" });
  };

  const inspectNode = (nodeId: string) => {
    client.inspectNode(nodeId);
  };

  const subscribeTrace = (traceId: string) => {
    client.subscribeTrace(traceId);
  };

  const unsubscribeTrace = (traceId: string) => {
    client.unsubscribeTrace(traceId);
  };

  const start = () => {
    const handleOpen = () => {
      if (getMode() === "live") {
        status.set("connected");
      }
    };

    const handleClose = () => {
      status.set(getMode() === "replay" ? "replay" : "disconnected");
      onDisconnect();
    };

    const handleSnapshot = (event: CustomEvent<MetricsSnapshot>) => {
      if (getMode() !== "live") return;
      snapshot.set(event.detail);
      serverTimelineMs.set(event.detail.tServerMs);
    };

    const handleGraph = (event: CustomEvent<Graph>) => {
      if (getMode() !== "live") return;
      graph.set(event.detail);
    };

    const handleState = (event: CustomEvent<{ run: Run | null }>) => {
      if (getMode() !== "live") return;
      run.set(event.detail.run);
      bindings.onRuntimeState?.(event.detail.run);
    };

    const handleError = (event: CustomEvent<WsError>) => {
      wsError.set(formatWsError(event.detail));
    };

    const handleNodeInspect = (event: CustomEvent<NodeInspectPayload>) => {
      const selectedNodeId = getSelectedNodeId();
      if (!selectedNodeId || event.detail.nodeId !== selectedNodeId) return;
      nodeInspect.set(event.detail);
    };

    const handleTraceSnapshot = (
      event: CustomEvent<{ traceId: string; spans: Span[] }>,
    ) => {
      if (getMode() !== "live") return;
      const activeTraceId = getActiveTraceId();
      if (!activeTraceId || event.detail.traceId !== activeTraceId) return;
      const nextSpans = sortSpans(event.detail.spans);
      traceSpans.set(nextSpans);
      traceStatus.set("ready");
      const running =
        [...nextSpans].reverse().find((span) => span.status === "running") ??
        null;
      const currentVisual = get(traceVisualState);
      traceVisualState.set({
        traceId: activeTraceId,
        activeNodeId: running?.nodeId ?? currentVisual?.activeNodeId ?? null,
        transition: currentVisual?.transition ?? null,
      });
    };

    const handleTraceSpan = (
      event: CustomEvent<{
        type: "trace.span.started" | "trace.span.ended";
        span: Span;
      }>,
    ) => {
      if (getMode() !== "live") return;
      const incoming = event.detail.span;
      const activeTraceId = getActiveTraceId();
      if (!activeTraceId || incoming.traceId !== activeTraceId) return;
      const currentSpans = get(traceSpans);
      if (event.detail.type === "trace.span.started") {
        const previousNode = findPreviousNode(currentSpans, incoming);
        traceVisualState.set({
          traceId: activeTraceId,
          activeNodeId: incoming.nodeId,
          transition: previousNode
            ? {
                from: previousNode,
                to: incoming.nodeId,
                startedAt: performance.now(),
              }
            : null,
        });
      } else {
        const currentVisual = get(traceVisualState);
        if (currentVisual?.activeNodeId === incoming.nodeId) {
          traceVisualState.set({
            traceId: activeTraceId,
            activeNodeId: null,
            transition: currentVisual.transition,
          });
        }
      }
      traceSpans.set(upsertSpan(currentSpans, incoming));
      traceStatus.set("ready");
    };

    client.addEventListener("open", handleOpen);
    client.addEventListener("close", handleClose);
    client.addEventListener("snapshot", handleSnapshot as EventListener);
    client.addEventListener("graph", handleGraph as EventListener);
    client.addEventListener("state", handleState as EventListener);
    client.addEventListener("wsError", handleError as EventListener);
    client.addEventListener("nodeInspect", handleNodeInspect as EventListener);
    client.addEventListener(
      "traceSnapshot",
      handleTraceSnapshot as EventListener,
    );
    client.addEventListener("traceSpan", handleTraceSpan as EventListener);

    return () => {
      client.removeEventListener("open", handleOpen);
      client.removeEventListener("close", handleClose);
      client.removeEventListener("snapshot", handleSnapshot as EventListener);
      client.removeEventListener("graph", handleGraph as EventListener);
      client.removeEventListener("state", handleState as EventListener);
      client.removeEventListener("wsError", handleError as EventListener);
      client.removeEventListener(
        "nodeInspect",
        handleNodeInspect as EventListener,
      );
      client.removeEventListener(
        "traceSnapshot",
        handleTraceSnapshot as EventListener,
      );
      client.removeEventListener("traceSpan", handleTraceSpan as EventListener);
      disconnect();
    };
  };

  return {
    connect,
    disconnect,
    reconnect,
    startRun,
    stopRun,
    inspectNode,
    subscribeTrace,
    unsubscribeTrace,
    start,
  };
};

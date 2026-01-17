import type { Graph } from "@shared/graph";
import type { MetricsSnapshot, NodeInspectPayload } from "@shared/metrics";
import type { Run } from "@shared/run";
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

export type WsError = { code: string; message: string };

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

  const startRun = () => {
    if (getMode() !== "live") return;
    client.send({ type: "run.start", controls: {} });
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
      wsError.set(event.detail);
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

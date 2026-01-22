import type { Graph } from "@shared/graph";
import type { MetricsSnapshot, NodeInspectPayload } from "@shared/metrics";
import type { Run } from "@shared/run";
import {
  DEFAULT_SIMULATION_CONTROLS,
  type SimulationControls,
} from "@shared/controls";
import type { Span } from "@shared/trace";
import { derived, get, writable } from "svelte/store";
import { RuntimeClient } from "../runtimeClient";
import {
  createLiveRuntime,
  type TraceSubscriptionState,
  type TraceVisualState,
  type WsError,
} from "./liveRuntime";
import { createReplayRuntime } from "./replayRuntime";
import { sortSpans } from "./traceUtils";

type Mode = "live" | "replay";
type Status = "connecting" | "connected" | "disconnected" | "replay";

export const createRuntimeController = (runtimeUrl: string) => {
  const client = new RuntimeClient(runtimeUrl);

  const mode = writable<Mode>("live");
  const status = writable<Status>("connecting");
  const visualSpeed = writable(1);

  const graph = writable<Graph | null>(null);
  const snapshot = writable<MetricsSnapshot | null>(null);
  const run = writable<Run | null>(null);
  const runControls = writable<SimulationControls>({
    ...DEFAULT_SIMULATION_CONTROLS,
  });
  const wsError = writable<WsError | null>(null);
  const serverTimelineMs = writable(0);
  const playbackTimeMs = writable(0);

  const selectedNodeId = writable<string | null>(null);
  const nodeInspect = writable<NodeInspectPayload | null>(null);

  const activeTraceId = writable<string | null>(null);
  const traceSpans = writable<Span[]>([]);
  const traceStatus = writable<TraceSubscriptionState>("idle");
  const traceVisualState = writable<TraceVisualState | null>(null);

  const inflightTotal = derived(snapshot, ($snapshot) =>
    $snapshot
      ? $snapshot.nodes.reduce((sum, node) => sum + node.inflight, 0)
      : 0,
  );
  const throughputTotal = derived(snapshot, ($snapshot) =>
    $snapshot
      ? $snapshot.nodes.reduce((sum, node) => sum + node.throughput, 0)
      : 0,
  );
  const runStartMs = derived(run, ($run) => $run?.startedAtServerMs ?? null);

  const resetTraceView = () => {
    activeTraceId.set(null);
    traceSpans.set([]);
    traceStatus.set("idle");
    traceVisualState.set(null);
  };

  const resetRightPanel = () => {
    clearSelection();
    resetTraceView();
  };

  let userStartedRun = false;
  let pendingStart = false;
  let liveRuntimeInstance: ReturnType<typeof createLiveRuntime> | null = null;

  const handleRuntimeState = (currentRun: Run | null) => {
    if (get(mode) !== "live") return;
    if (!currentRun || currentRun.status !== "running") {
      resetRightPanel();
    }
    if (currentRun?.status === "running" && !userStartedRun) {
      liveRuntimeInstance?.stopRun();
    }
    if (pendingStart && (!currentRun || currentRun.status !== "running")) {
      pendingStart = false;
      liveRuntimeInstance?.startRun(get(runControls));
    }
    if (currentRun?.config) {
      runControls.set({ ...currentRun.config });
    }
  };

  const liveRuntime = createLiveRuntime(client, {
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
    getMode: () => get(mode),
    getActiveTraceId: () => get(activeTraceId),
    getSelectedNodeId: () => get(selectedNodeId),
    onDisconnect: resetTraceView,
    onRuntimeState: handleRuntimeState,
  });
  liveRuntimeInstance = liveRuntime;

  const replayRuntime = createReplayRuntime({
    graph,
    snapshot,
    run,
    nodeInspect,
    serverTimelineMs,
    selectedNodeId,
    visualSpeed,
    onResetTrace: resetTraceView,
  });

  const connect = () => {
    if (get(mode) !== "live") return;
    liveRuntime.connect();
  };

  const reconnect = () => {
    if (get(mode) !== "live") return;
    status.set("connecting");
    wsError.set(null);
    liveRuntime.reconnect();
  };

  const startRun = () => {
    userStartedRun = true;
    const currentRun = get(run);
    if (currentRun?.status === "running") {
      pendingStart = true;
      liveRuntime.stopRun();
      return;
    }
    liveRuntime.startRun(get(runControls));
  };

  const stopRun = () => {
    userStartedRun = false;
    liveRuntime.stopRun();
    resetRightPanel();
  };

  let lastInspectSeq: number | null = null;

  const handleNodeSelect = (nodeId: string) => {
    selectedNodeId.set(nodeId);
    nodeInspect.set(null);
    lastInspectSeq = null;
    if (get(mode) === "live") {
      liveRuntime.inspectNode(nodeId);
    } else {
      replayRuntime.inspectNode(nodeId);
    }
  };

  const clearSelection = () => {
    selectedNodeId.set(null);
    nodeInspect.set(null);
    lastInspectSeq = null;
  };

  const closeTraceView = () => {
    const traceId = get(activeTraceId);
    if (get(mode) === "live" && traceId) {
      liveRuntime.unsubscribeTrace(traceId);
    }
    resetTraceView();
  };

  const selectReplayTrace = (traceId: string) => {
    const sample = get(replayRuntime.replayTraceSamples).find(
      (candidate) => candidate.traceId === traceId,
    );
    if (!sample) return;
    activeTraceId.set(traceId);
    traceSpans.set(sortSpans(sample.spans));
    traceStatus.set("ready");
    traceVisualState.set(null);
  };

  const selectTrace = (traceId: string) => {
    if (get(activeTraceId) === traceId) return;
    if (get(mode) === "replay") {
      selectReplayTrace(traceId);
      return;
    }
    const previousTraceId = get(activeTraceId);
    if (previousTraceId) {
      liveRuntime.unsubscribeTrace(previousTraceId);
    }
    activeTraceId.set(traceId);
    traceSpans.set([]);
    traceStatus.set("loading");
    traceVisualState.set({
      traceId,
      activeNodeId: null,
      transition: null,
    });
    liveRuntime.subscribeTrace(traceId);
  };

  const switchMode = (nextMode: Mode) => {
    if (get(mode) === nextMode) return;
    if (nextMode === "replay" && get(activeTraceId)) {
      liveRuntime.unsubscribeTrace(get(activeTraceId) as string);
      resetTraceView();
    }
    mode.set(nextMode);
    if (nextMode === "replay") {
      selectedNodeId.set(null);
      nodeInspect.set(null);
      liveRuntime.disconnect();
      status.set("replay");
    } else {
      replayRuntime.reset();
      snapshot.set(null);
      graph.set(null);
      run.set(null);
      nodeInspect.set(null);
      selectedNodeId.set(null);
      wsError.set(null);
      serverTimelineMs.set(0);
      resetTraceView();
      connect();
    }
  };

  const loadReplayPreset = (presetId: Parameters<typeof replayRuntime.loadPreset>[0]) => {
    if (get(mode) !== "replay") return;
    replayRuntime.loadPreset(presetId);
  };


  const startPlaybackClock = () => {
    let playbackFrame: number | null = null;
    let lastPlaybackTick: number | null = null;

    const tickPlayback = (timestamp: number) => {
      if (lastPlaybackTick === null) {
        lastPlaybackTick = timestamp;
      }
      const delta = timestamp - lastPlaybackTick;
      lastPlaybackTick = timestamp;
      if (delta > 0) {
        const target = get(serverTimelineMs);
        playbackTimeMs.update((current) => {
          if (target === current) return current;
          const diff = target - current;
          const direction = diff > 0 ? 1 : -1;
          const maxStep = delta * get(visualSpeed);
          const step = Math.min(Math.abs(diff), maxStep);
          return current + step * direction;
        });
      }
      playbackFrame = requestAnimationFrame(tickPlayback);
    };

    playbackFrame = requestAnimationFrame(tickPlayback);

    return () => {
      if (playbackFrame !== null) {
        cancelAnimationFrame(playbackFrame);
        playbackFrame = null;
      }
      lastPlaybackTick = null;
    };
  };

  const start = () => {
    const stopLive = liveRuntime.start();
    const stopReplay = replayRuntime.start();
    const stopPlaybackClock = startPlaybackClock();

    const maybeInspectSelected = () => {
      if (get(mode) !== "live") return;
      const seq = get(snapshot)?.seq ?? null;
      const nodeId = get(selectedNodeId);
      if (!nodeId || seq === null) {
        if (!nodeId) {
          lastInspectSeq = null;
        }
        return;
      }
      if (lastInspectSeq === seq) return;
      lastInspectSeq = seq;
      liveRuntime.inspectNode(nodeId);
    };

    const unsubscribeSnapshot = snapshot.subscribe(() => {
      maybeInspectSelected();
    });
    const unsubscribeSelection = selectedNodeId.subscribe(() => {
      if (!get(selectedNodeId)) {
        lastInspectSeq = null;
      }
      maybeInspectSelected();
    });

    connect();

    return () => {
      stopPlaybackClock();
      stopReplay();
      stopLive();
      unsubscribeSnapshot();
      unsubscribeSelection();
      liveRuntime.disconnect();
    };
  };

  return {
    mode,
    status,
    visualSpeed,
    graph,
    snapshot,
    run,
    wsError,
    selectedNodeId,
    nodeInspect,
    activeTraceId,
    traceSpans,
    traceStatus,
    traceVisualState,
    playbackTimeMs,
    serverTimelineMs,
    inflightTotal,
    throughputTotal,
    runStartMs,
    runControls,
    replayPresetId: replayRuntime.replayPresetId,
    replayStatus: replayRuntime.replayStatus,
    replayError: replayRuntime.replayError,
    replayBundle: replayRuntime.replayBundle,
    replayTraceSamples: replayRuntime.replayTraceSamples,
    connect,
    reconnect,
    switchMode,
    startRun,
    stopRun,
    handleNodeSelect,
    clearSelection,
    selectTrace,
    closeTraceView,
    loadReplayPreset,
    start,
  };
};

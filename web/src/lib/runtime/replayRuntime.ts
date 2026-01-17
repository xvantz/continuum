import type { Graph } from "@shared/graph";
import type { MetricsSnapshot, NodeInspectPayload } from "@shared/metrics";
import type { Run } from "@shared/run";
import type { ReplayBundle, ReplayFrame, TraceSample } from "@shared/replay";
import { parseReplayBundle } from "@shared/replay";
import { CONTINUUM_GRAPH } from "@shared/graphPresets";
import { err, ok, ResultAsync } from "neverthrow";
import { get, writable, type Readable, type Writable } from "svelte/store";
import { normalizeTraceSample } from "./traceUtils";

export type ReplayStatus = "idle" | "loading" | "ready" | "error";

type ReplayRuntimeBindings = {
  graph: Writable<Graph | null>;
  snapshot: Writable<MetricsSnapshot | null>;
  run: Writable<Run | null>;
  nodeInspect: Writable<NodeInspectPayload | null>;
  serverTimelineMs: Writable<number>;
  selectedNodeId: Readable<string | null>;
  visualSpeed: Readable<number>;
  onResetTrace: () => void;
};

const toError = (error: unknown) =>
  error instanceof Error
    ? error
    : new Error("Unknown error loading replay bundle");

const fetchReplayBundle = (source: string) =>
  ResultAsync.fromPromise(fetch(source), toError)
    .andThen((response) =>
      response.ok
        ? ok(response)
        : err(new Error(`Unable to load replay (${response.status})`)),
    )
    .andThen((response) =>
      ResultAsync.fromPromise(response.json(), toError),
    )
    .andThen((raw) => {
      const parsed = parseReplayBundle(raw);
      if (parsed.isErr()) {
        return err(new Error(parsed.error.message));
      }
      if (parsed.value.timeline.length === 0) {
        return err(new Error("Replay file does not include any frames"));
      }
      return ok(parsed.value);
    });

const buildReplaySnapshot = (
  bundle: ReplayBundle,
  frame: ReplayFrame,
  index: number,
): MetricsSnapshot => ({
  runId: bundle.meta.graphId,
  seq: index,
  tServerMs: frame.t,
  nodes: frame.nodes,
  edges: frame.edges,
});

const getReplayDuration = (bundle: ReplayBundle) =>
  bundle.meta.durationMs ||
  bundle.timeline[bundle.timeline.length - 1]?.t ||
  0;

export const createReplayRuntime = (bindings: ReplayRuntimeBindings) => {
  const {
    graph,
    snapshot,
    run,
    nodeInspect,
    serverTimelineMs,
    selectedNodeId,
    visualSpeed,
    onResetTrace,
  } = bindings;

  const replaySource = writable("demos/latest.json");
  const replayStatus = writable<ReplayStatus>("idle");
  const replayError = writable<string | null>(null);
  const replayBundle = writable<ReplayBundle | null>(null);
  const replayTraceSamples = writable<TraceSample[]>([]);
  const currentReplayFrame = writable<ReplayFrame | null>(null);

  let replayAnimationFrame: number | null = null;
  let replayElapsedMs = 0;
  let lastReplayTick: number | null = null;
  let replayFrameIndex = 0;

  const updateReplayInspectFromFrame = (
    nodeId: string,
    frame: ReplayFrame,
  ) => {
    const metrics = frame.nodes.find((node) => node.nodeId === nodeId);
    if (!metrics) return;
    nodeInspect.set({
      nodeId,
      metrics,
      recentTraceIds: [],
      errorTraceIds: [],
      slowTraceIds: [],
    });
  };

  const applyReplayFrame = (
    frame: ReplayFrame,
    index: number,
    bundle: ReplayBundle,
  ) => {
    snapshot.set(buildReplaySnapshot(bundle, frame, index));
    currentReplayFrame.set(frame);
    serverTimelineMs.set(frame.t);
    const nodeId = get(selectedNodeId);
    if (nodeId) {
      updateReplayInspectFromFrame(nodeId, frame);
    }
  };

  const findReplayFrameForTime = (elapsed: number, bundle: ReplayBundle) => {
    const timeline = bundle.timeline;
    if (timeline.length === 0) return null;
    let index = replayFrameIndex;
    if (!timeline[index]) {
      index = 0;
    }
    if (timeline[index].t > elapsed) {
      while (index > 0 && timeline[index - 1].t > elapsed) {
        index -= 1;
      }
    } else {
      while (index < timeline.length - 1 && timeline[index + 1].t <= elapsed) {
        index += 1;
      }
    }
    replayFrameIndex = index;
    return { frame: timeline[index], index };
  };

  const stopPlayback = () => {
    if (replayAnimationFrame !== null) {
      cancelAnimationFrame(replayAnimationFrame);
      replayAnimationFrame = null;
    }
    lastReplayTick = null;
  };

  const stepReplay = (timestamp: number) => {
    const bundle = get(replayBundle);
    if (!bundle) return;
    if (lastReplayTick === null) {
      lastReplayTick = timestamp;
      replayAnimationFrame = requestAnimationFrame(stepReplay);
      return;
    }
    const delta = (timestamp - lastReplayTick) * get(visualSpeed);
    lastReplayTick = timestamp;
    const duration = Math.max(1, getReplayDuration(bundle));
    replayElapsedMs = (replayElapsedMs + delta) % duration;
    const nextFrame = findReplayFrameForTime(replayElapsedMs, bundle);
    if (nextFrame) {
      applyReplayFrame(nextFrame.frame, nextFrame.index, bundle);
    }
    replayAnimationFrame = requestAnimationFrame(stepReplay);
  };

  const startPlayback = () => {
    stopPlayback();
    replayElapsedMs = 0;
    replayFrameIndex = 0;
    const bundle = get(replayBundle);
    if (!bundle || bundle.timeline.length === 0) return;
    applyReplayFrame(bundle.timeline[0], 0, bundle);
    replayAnimationFrame = requestAnimationFrame(stepReplay);
  };

  const loadReplay = async () => {
    replayStatus.set("loading");
    replayError.set(null);
    const result = await fetchReplayBundle(get(replaySource));
    if (result.isErr()) {
      replayStatus.set("error");
      replayError.set(result.error.message);
      replayBundle.set(null);
      replayTraceSamples.set([]);
      stopPlayback();
      return;
    }
    const bundle = result.value;
    replayBundle.set(bundle);
    replayTraceSamples.set((bundle.traceSamples ?? []).map(normalizeTraceSample));
    run.set({
      runId: `replay-${bundle.meta.recordedAt}`,
      status: "running",
      startedAtServerMs: 0,
      config: bundle.meta.config,
    });
    graph.set(CONTINUUM_GRAPH);
    onResetTrace();
    replayElapsedMs = 0;
    replayFrameIndex = 0;
    currentReplayFrame.set(null);
    applyReplayFrame(bundle.timeline[0], 0, bundle);
    replayStatus.set("ready");
    startPlayback();
  };

  const reset = () => {
    stopPlayback();
    replayBundle.set(null);
    replayTraceSamples.set([]);
    replayStatus.set("idle");
    replayError.set(null);
    currentReplayFrame.set(null);
  };

  const start = () => {
    const unsubscribeSelection = selectedNodeId.subscribe((nodeId) => {
      const frame = get(currentReplayFrame);
      if (nodeId && frame) {
        updateReplayInspectFromFrame(nodeId, frame);
      }
    });

    return () => {
      unsubscribeSelection();
      stopPlayback();
    };
  };

  const inspectNode = (nodeId: string) => {
    const frame = get(currentReplayFrame);
    if (frame) {
      updateReplayInspectFromFrame(nodeId, frame);
    }
  };

  return {
    replaySource,
    replayStatus,
    replayError,
    replayBundle,
    replayTraceSamples,
    currentReplayFrame,
    loadReplay,
    reset,
    start,
    startPlayback,
    stopPlayback,
    inspectNode,
  };
};

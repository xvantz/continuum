import { promises as fs } from "node:fs";
import path from "node:path";

import { defineService } from "@server/src/core/modules";
import type { SimulationControls } from "@shared/controls";
import type { MetricsSnapshot } from "@shared/metrics";
import { ReplayBundleSchema, type ReplayBundle } from "@shared/replay";
import type { ReplayFrame, TraceSample } from "@shared/replay";

const DEMOS_DIR = path.resolve(process.cwd(), "demos");
const MAX_TRACE_SAMPLES = 3;

type RecordingState = {
  runId: string;
  graphId: string;
  config: SimulationControls;
  recordedAt: string;
  frames: ReplayFrame[];
};

const ensureDemosDir = async () => {
  await fs.mkdir(DEMOS_DIR, { recursive: true });
};

const buildFrame = (snapshot: MetricsSnapshot): ReplayFrame => ({
  t: snapshot.tServerMs,
  nodes: snapshot.nodes,
  edges: snapshot.edges,
});

export const replayRecorderService = defineService("runtime", async ({ services, logger }) => {
  await ensureDemosDir();

  const runtime = services.runtime;
  const metrics = services.metrics;
  const graphRegistry = services.graph;

  let currentRecording: RecordingState | null = null;
  let latestBundle: ReplayBundle | null = null;

  const snapshotUnsubscribe = metrics.onSnapshot((snapshot) => {
    if (!currentRecording) return;
    currentRecording.frames.push(buildFrame(snapshot));
  });

  runtime.onRunLifecycle({
    onRunStart(run) {
      const graph = graphRegistry.getGraph();
      currentRecording = {
        runId: run.runId,
        graphId: graph.graphId,
        config: run.config,
        recordedAt: new Date().toISOString(),
        frames: [],
      };
    },
    onRunStop() {
      if (!currentRecording) return;
      finalizeRecording();
      currentRecording = null;
    },
  });

  const finalizeRecording = () => {
    if (!currentRecording) return;
    const frames = [...currentRecording.frames];
    if (frames.length === 0) {
      logger.warn("replay recording ended without frames");
      latestBundle = null;
      return;
    }
    const durationMs = frames[frames.length - 1]?.t ?? 0;
    const traceSamples = buildTraceSamples();
    latestBundle = ReplayBundleSchema.parse({
      meta: {
        graphId: currentRecording.graphId,
        recordedAt: currentRecording.recordedAt,
        durationMs,
        config: currentRecording.config,
      },
      timeline: frames,
      traceSamples: traceSamples.length > 0 ? traceSamples : undefined,
    });
    void writeBundle(latestBundle);
  };

  const buildTraceSamples = (): TraceSample[] => {
    const persisted = runtime.getPersistedTraces();
    if (persisted.length === 0) return [];
    const sorted = [...persisted].sort((a, b) => b.completedAt - a.completedAt);
    const selected = sorted.slice(0, MAX_TRACE_SAMPLES);
    const samples: TraceSample[] = [];
    for (const trace of selected) {
      const spans = metrics.getTraceSpans(trace.traceId);
      if (spans.length === 0) continue;
      samples.push({ traceId: trace.traceId, spans });
    }
    return samples;
  };

  const writeBundle = async (bundle: ReplayBundle) => {
    await ensureDemosDir();
    const fileName = `run-${bundle.meta.recordedAt.replace(/[:.]/g, "-")}.json`;
    const latestPath = path.join(DEMOS_DIR, "latest.json");
    const targetPath = path.join(DEMOS_DIR, fileName);
    const json = JSON.stringify(bundle, null, 2);
    await fs.writeFile(latestPath, json, "utf8");
    await fs.writeFile(targetPath, json, "utf8");
    logger.info({ path: targetPath }, "replay bundle written");
  };

  return {
    getLatestBundle(): ReplayBundle | null {
      return latestBundle;
    },
    exportLatestBundle: async () => {
      if (!latestBundle) {
        throw new Error("no replay bundle available");
      }
      await writeBundle(latestBundle);
    },
    dispose() {
      snapshotUnsubscribe();
    },
  };
});


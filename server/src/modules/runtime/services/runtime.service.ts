import { randomUUID } from "node:crypto";

import { defineService } from "@server/src/core/modules";
import {
  DEFAULT_SIMULATION_CONTROLS,
  type SimulationControls,
} from "@shared/controls";
import type { Run } from "@shared/run";
import type { Trace } from "@shared/trace";
import { err, ok, type Result } from "neverthrow";

import { createPipelineHandlers } from "../lib/handlers";
import { PipelineScheduler } from "../lib/scheduler";
import type { PersistedTrace, RuntimeToken } from "../types";

const emptyPayload = {
  matrix: [],
  normalizedVector: [],
  tasks: [],
  digest: "",
};

const pipelineOrder = [
  "receive",
  "validate",
  "transform",
  "router",
  "process-main",
  "process-fallback",
  "persist",
  "sink",
] as const;

type PipelineNodeId = (typeof pipelineOrder)[number];

type RuntimeErrorCode =
  | "run_already_active"
  | "run_not_active"
  | "node_enqueue_failed";

const LOAD_TICK_MS = 50;

export const runtimeService = defineService("runtime", ({ logger, services }) => {
  let currentRun: Run | null = null;
  let issued = 0;
  let loadTimer: NodeJS.Timeout | null = null;
  let controls: SimulationControls = DEFAULT_SIMULATION_CONTROLS;
  let schedulerGraphVersion = services.graph.getGraph();

  const persistStore = new Map<string, PersistedTrace>();
  const activeTokens = new Map<string, RuntimeToken>();

  const getControls = () => controls;

  const scheduler = new PipelineScheduler((token, status, message) => {
    token.trace.status = status === "ok" ? "finished" : "failed";
    token.trace.location = { type: "node", nodeId: "sink" };
    activeTokens.delete(token.trace.traceId);
    if (message) {
      logger.warn(
        { traceId: token.trace.traceId, message },
        "token completed with warning",
      );
    }
  });

  const handlerMap = createPipelineHandlers({
    controls: getControls,
    persistStore,
  });

  pipelineOrder.forEach((nodeId) => {
    scheduler.initializeNode({
      nodeId,
      concurrency: 1,
      handler: handlerMap[nodeId],
    });
  });

  const hydrateGraph = (nextControls: SimulationControls) => {
    const baseGraph = services.graph.getGraph();
    schedulerGraphVersion = {
      ...baseGraph,
      nodes: baseGraph.nodes.map((node) => ({
        ...node,
        concurrency: nextControls.nodeConcurrency,
      })),
    };
    pipelineOrder.forEach((nodeId) => {
      scheduler.setConcurrency(nodeId, nextControls.nodeConcurrency);
    });
  };

  const spawnToken = () => {
    if (!currentRun) return;
    const traceId = randomUUID();
    const seed = controls.seed + issued;
    const trace: Trace = {
      traceId,
      seed,
      createdAtServerMs: Date.now(),
      location: { type: "node", nodeId: "receive" },
      status: "active",
    };
    const token: RuntimeToken = {
      trace,
      seed,
      complexity: controls.payloadComplexity,
      payload: { ...emptyPayload },
      attributes: {},
    };
    issued += 1;
    activeTokens.set(traceId, token);
    const enqueueResult = scheduler.enqueue("receive", token);
    if (enqueueResult.isErr()) {
      activeTokens.delete(traceId);
      logger.error(
        { traceId, error: enqueueResult.error },
        "failed to enqueue token",
      );
    }
  };

  const stopLoadLoop = () => {
    if (loadTimer) {
      clearInterval(loadTimer);
      loadTimer = null;
    }
  };

  const startLoadLoop = () => {
    stopLoadLoop();
    const tickRate = controls.requestRate / (1000 / LOAD_TICK_MS);
    let remainder = 0;
    loadTimer = setInterval(() => {
      if (!currentRun) return;
      const target = tickRate + remainder;
      const spawnCount = Math.floor(target);
      remainder = target - spawnCount;
      for (let i = 0; i < spawnCount; i += 1) {
        spawnToken();
      }
    }, LOAD_TICK_MS);
  };

  const startRun = (
    params: SimulationControls,
  ): Result<Run, RuntimeErrorCode> => {
    if (currentRun?.status === "running") {
      return err("run_already_active");
    }
    controls = params;
    hydrateGraph(params);
    persistStore.clear();
    issued = 0;

    const run: Run = {
      runId: randomUUID(),
      status: "running",
      startedAtServerMs: Date.now(),
      config: params,
    };
    currentRun = run;
    scheduler.start({
      runId: run.runId,
      controls: params,
      graph: schedulerGraphVersion,
    });
    startLoadLoop();
    logger.info({ runId: run.runId }, "runtime started");
    return ok(run);
  };

  const stopRun = (): Result<Run, RuntimeErrorCode> => {
    if (!currentRun) {
      return err("run_not_active");
    }
    stopLoadLoop();
    scheduler.stop();
    const finishedRun: Run = {
      ...currentRun,
      status: "stopped",
    };
    currentRun = null;
    activeTokens.clear();
    logger.info({ runId: finishedRun.runId }, "runtime stopped");
    return ok(finishedRun);
  };

  return {
    startRun,
    stopRun,
    getState() {
      return currentRun;
    },
    getGraph() {
      return schedulerGraphVersion;
    },
    getSchedulerSnapshot: () => scheduler.snapshot(),
    getPersistedTraces: () => [...persistStore.values()],
    getActiveTraceCount: () => activeTokens.size,
  };
});


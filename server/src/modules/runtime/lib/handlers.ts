import { z } from "zod";

import type { SimulationControls } from "@shared/controls";

import type { PersistedTrace, RuntimeToken } from "../types";
import { generatePayload } from "./payload";

const PayloadSchema = z.object({
  matrix: z.array(z.array(z.number().nonnegative())),
  normalizedVector: z.array(z.number()),
  tasks: z.array(
    z.object({
      id: z.string(),
      weight: z.number().min(1),
    }),
  ),
  digest: z.string().min(64),
});

type HandlerDeps = {
  controls: () => SimulationControls;
  persistStore: Map<string, PersistedTrace>;
};

const RANDOM_STATE_KEY = "__rand_state";

const nextRandom = (token: RuntimeToken): number => {
  const attr = token.attributes[RANDOM_STATE_KEY];
  const current = typeof attr === "number" ? attr : token.seed;
  const next = (1664525 * current + 1013904223) >>> 0;
  token.attributes[RANDOM_STATE_KEY] = next;
  return next / 0xffffffff;
};

const heavyLoop = (values: number[]): number => {
  let acc = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    acc += Math.sin(value) + Math.cos(value / 2);
  }
  return acc;
};

const updateTasks = (token: RuntimeToken) => {
  const tasks = token.payload.matrix.map((row, rowIndex) => {
    const weight = heavyLoop(row);
    return {
      id: `${token.trace.traceId}:${rowIndex}`,
      weight: Math.abs(Math.round(weight * 1000)),
    };
  });
  token.payload.tasks = tasks;
};

export const createPipelineHandlers = (deps: HandlerDeps) => {
  const handleReceive = async (token: RuntimeToken) => {
    const payload = generatePayload(token.seed, token.complexity);
    token.payload = payload;
    return { type: "next", nextNodeId: "validate" } as const;
  };

  const handleValidate = async (token: RuntimeToken) => {
    const controls = deps.controls();
    const shouldFail =
      nextRandom(token) < Math.max(0, Math.min(controls.failureRate, 20)) / 100;
    if (shouldFail) {
      return {
        type: "complete",
        status: "error",
        errorMessage: "validation_failure",
      } as const;
    }

    const parsed = PayloadSchema.safeParse(token.payload);
    if (!parsed.success) {
      return {
        type: "complete",
        status: "error",
        errorMessage: "schema_invalid",
      } as const;
    }
    token.payload = parsed.data;
    return { type: "next", nextNodeId: "transform" } as const;
  };

  const handleTransform = async (token: RuntimeToken) => {
    updateTasks(token);
    return { type: "next", nextNodeId: "router" } as const;
  };

    const handleRouter = async (token: RuntimeToken) => {
      const ratio = nextRandom(token);
      const branch = ratio > 0.2 ? "main" : "fallback";
      token.attributes.route = branch === "main" ? 1 : 0;
      return {
      type: "next",
      nextNodeId: branch === "main" ? "process-main" : "process-fallback",
    } as const;
  };

  const handleProcess = async (token: RuntimeToken) => {
    for (const task of token.payload.tasks) {
      // Simulate CPU-heavy aggregation.
      const work = heavyLoop(token.payload.matrix[task.weight % token.payload.matrix.length]);
      token.attributes[task.id] = work;
    }
    return { type: "next", nextNodeId: "persist" } as const;
  };

    const handlePersist = async (token: RuntimeToken) => {
      const routeFlag = Number(token.attributes.route ?? 1);
      const route = routeFlag === 1 ? "main" : "fallback";
    const serialized = JSON.stringify({
      digest: token.payload.digest,
      tasks: token.payload.tasks,
    });
    const payloadSize = Buffer.byteLength(serialized, "utf8");

    deps.persistStore.set(token.trace.traceId, {
      traceId: token.trace.traceId,
      digest: token.payload.digest,
      route,
      payloadSize,
      completedAt: Date.now(),
    });

    return { type: "next", nextNodeId: "sink" } as const;
  };

  const handleSink = async () => {
    return {
      type: "complete",
      status: "ok",
    } as const;
  };

  return {
    receive: handleReceive,
    validate: handleValidate,
    transform: handleTransform,
    router: handleRouter,
    "process-main": handleProcess,
    "process-fallback": handleProcess,
    persist: handlePersist,
    sink: handleSink,
  };
};

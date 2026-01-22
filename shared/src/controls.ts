import { z } from "zod";

import { makeParser } from "./parser";

export const SimulationControlsSchema = z.object({
  requestRate: z.number().int().min(20).max(200),
  payloadComplexity: z.number().int().min(1).max(5),
  nodeConcurrency: z.number().int().min(1).max(8),
  failureRate: z.number().min(0).max(20),
  seed: z.number().int(),
  runDurationMs: z
    .number()
    .int()
    .min(5 * 1000)
    .max(60 * 60 * 1000)
    .default(5 * 60 * 1000),
});

export type SimulationControls = z.infer<typeof SimulationControlsSchema>;

export const DEFAULT_SIMULATION_CONTROLS: SimulationControls = {
  requestRate: 40,
  payloadComplexity: 2,
  nodeConcurrency: 2,
  failureRate: 2,
  seed: 1,
  runDurationMs: 5 * 60 * 1000,
};

export const parseSimulationControls = makeParser(SimulationControlsSchema);

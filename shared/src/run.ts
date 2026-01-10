import { z } from "zod";

import { SimulationControlsSchema } from "./controls";
import { makeParser } from "./parser";

export const RunStatusSchema = z.enum(["idle", "running", "stopped"]);

export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunSchema = z.object({
  runId: z.string().uuid(),
  status: RunStatusSchema,
  startedAtServerMs: z.number().min(0),
  config: SimulationControlsSchema,
});

export type Run = z.infer<typeof RunSchema>;

export const parseRun = makeParser(RunSchema);


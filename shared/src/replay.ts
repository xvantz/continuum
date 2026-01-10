import { z } from "zod";

import { SimulationControlsSchema } from "./controls";
import { EdgeMetricsSchema, NodeMetricsSchema } from "./metrics";
import { makeParser } from "./parser";
import { SpanSchema } from "./trace";

export const ReplayMetaSchema = z.object({
  graphId: z.string().min(1),
  recordedAt: z.string().datetime(),
  durationMs: z.number().min(0),
  config: SimulationControlsSchema,
});

export type ReplayMeta = z.infer<typeof ReplayMetaSchema>;

export const ReplayFrameSchema = z.object({
  t: z.number().min(0),
  nodes: z.array(NodeMetricsSchema),
  edges: z.array(EdgeMetricsSchema),
});

export type ReplayFrame = z.infer<typeof ReplayFrameSchema>;

export const TraceSampleSchema = z.object({
  traceId: z.string().min(1),
  spans: z.array(SpanSchema),
});

export type TraceSample = z.infer<typeof TraceSampleSchema>;

export const ReplayBundleSchema = z.object({
  meta: ReplayMetaSchema,
  timeline: z.array(ReplayFrameSchema).min(1),
  traceSamples: z.array(TraceSampleSchema).max(3).optional(),
});

export type ReplayBundle = z.infer<typeof ReplayBundleSchema>;

export const parseReplayBundle = makeParser(ReplayBundleSchema);


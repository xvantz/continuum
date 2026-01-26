import { z } from "zod";

import { makeParser } from "./parser";

export const NodeMetricsSchema = z.object({
  nodeId: z.string().min(1),
  inflight: z.number().int().min(0),
  queueLen: z.number().int().min(0),
  throughput: z.number().min(0),
  avgLatencyMs: z.number().min(0),
  errorRate: z.number().min(0).max(1),
});

export type NodeMetrics = z.infer<typeof NodeMetricsSchema>;

export const EdgeMetricsSchema = z.object({
  edgeId: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  rate: z.number().min(0),
  errorRate: z.number().min(0).max(1),
});

export type EdgeMetrics = z.infer<typeof EdgeMetricsSchema>;

export const EndToEndLatencySchema = z.object({
  sampleCount: z.number().int().min(0),
  avgMs: z.number().min(0),
  p50Ms: z.number().min(0),
  p95Ms: z.number().min(0),
  p99Ms: z.number().min(0),
  maxMs: z.number().min(0),
});

export type EndToEndLatency = z.infer<typeof EndToEndLatencySchema>;

export const MetricsSnapshotSchema = z.object({
  runId: z.string().min(1),
  seq: z.number().int().min(0),
  tServerMs: z.number().min(0),
  nodes: z.array(NodeMetricsSchema),
  edges: z.array(EdgeMetricsSchema),
  endToEndLatency: EndToEndLatencySchema.optional(),
});

export type MetricsSnapshot = z.infer<typeof MetricsSnapshotSchema>;

const TraceListSchema = z.array(z.string().min(1)).max(50);

export const NodeInspectPayloadSchema = z.object({
  nodeId: z.string().min(1),
  metrics: NodeMetricsSchema,
  recentTraceIds: TraceListSchema,
  errorTraceIds: TraceListSchema,
  slowTraceIds: TraceListSchema,
});

export type NodeInspectPayload = z.infer<typeof NodeInspectPayloadSchema>;

export const parseMetricsSnapshot = makeParser(MetricsSnapshotSchema);
export const parseNodeInspectPayload = makeParser(NodeInspectPayloadSchema);

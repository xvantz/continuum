import { z } from "zod";

import { makeParser } from "./parser";

export const TraceStatusSchema = z.enum(["active", "finished", "failed"]);

export type TraceStatus = z.infer<typeof TraceStatusSchema>;

export const TraceLocationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("node"),
    nodeId: z.string().min(1),
  }),
  z.object({
    type: z.literal("edge"),
    edgeId: z.string().min(1),
  }),
]);

export type TraceLocation = z.infer<typeof TraceLocationSchema>;

export const TraceSchema = z.object({
  traceId: z.string().min(1),
  seed: z.number().int(),
  createdAtServerMs: z.number().nonnegative(),
  location: TraceLocationSchema,
  status: TraceStatusSchema,
});

export type Trace = z.infer<typeof TraceSchema>;

export const SpanStatusSchema = z.enum(["running", "ok", "error"]);

export type SpanStatus = z.infer<typeof SpanStatusSchema>;

export const SpanErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export type SpanError = z.infer<typeof SpanErrorSchema>;

export const SpanPayloadSchema = z.object({
  digest: z.string().min(1),
  taskCount: z.number().int().nonnegative(),
  matrixRows: z.number().int().nonnegative(),
  matrixCols: z.number().int().nonnegative(),
  vectorSize: z.number().int().nonnegative(),
});

export type SpanPayload = z.infer<typeof SpanPayloadSchema>;

export const SpanSchema = z.object({
  spanId: z.string().min(1),
  traceId: z.string().min(1),
  nodeId: z.string().min(1),
  name: z.string().min(1),
  startTime: z.number().nonnegative(),
  endTime: z.number().nonnegative().nullable(),
  status: SpanStatusSchema,
  error: SpanErrorSchema.optional(),
  payload: SpanPayloadSchema.optional(),
});

export type Span = z.infer<typeof SpanSchema>;

export const SpanEventSchema = z.object({
  type: z.enum(["trace.span.started", "trace.span.ended"]),
  span: SpanSchema,
});

export type SpanEvent = z.infer<typeof SpanEventSchema>;

export const parseTrace = makeParser(TraceSchema);
export const parseSpan = makeParser(SpanSchema);
export const parseSpanEvent = makeParser(SpanEventSchema);

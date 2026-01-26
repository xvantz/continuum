import { z } from "zod";

import { makeParser } from "./parser";

export const NodeKindSchema = z.enum([
  "receive",
  "validate",
  "transform",
  "router",
  "db",
  "persist",
  "sink",
]);

export type NodeKind = z.infer<typeof NodeKindSchema>;

export const NodePositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});

export type NodePosition = z.infer<typeof NodePositionSchema>;

export const GraphNodeSchema = z.object({
  nodeId: z.string().min(1),
  kind: NodeKindSchema,
  concurrency: z.number().int().min(1),
  label: z.string().min(1).optional(),
});

export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  edgeId: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().min(1).optional(),
});

export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const GraphLayoutSchema = z.object({
  nodes: z.record(z.string(), NodePositionSchema),
});

export type GraphLayout = z.infer<typeof GraphLayoutSchema>;

export const GraphSchema = z.object({
  graphId: z.string().min(1),
  nodes: z.array(GraphNodeSchema).min(1),
  edges: z.array(GraphEdgeSchema),
  layout: GraphLayoutSchema.optional(),
});

export type Graph = z.infer<typeof GraphSchema>;

export const parseGraph = makeParser(GraphSchema);

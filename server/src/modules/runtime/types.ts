import type { SimulationControls } from "@shared/controls";
import type { Graph, GraphNode } from "@shared/graph";
import type { Trace } from "@shared/trace";

export type RuntimeTask = {
  id: string;
  weight: number;
};

export type RuntimePayload = {
  matrix: number[][];
  normalizedVector: number[];
  tasks: RuntimeTask[];
  digest: string;
};

export type RuntimeToken = {
  trace: Trace;
  seed: number;
  complexity: number;
  payload: RuntimePayload;
  attributes: Record<string, number | string>;
};

export type RuntimeGraph = Graph & {
  nodes: GraphNode[];
};

export type RuntimeContext = {
  runId: string;
  controls: SimulationControls;
  graph: RuntimeGraph;
};

export type PersistedTrace = {
  traceId: string;
  digest: string;
  route: "main" | "fallback";
  payloadSize: number;
  completedAt: number;
};

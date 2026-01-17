import type { Graph } from "./graph";

export const CONTINUUM_GRAPH: Graph = {
  graphId: "continuum-v1",
  nodes: [
    { nodeId: "receive", kind: "receive", concurrency: 1 },
    { nodeId: "validate", kind: "validate", concurrency: 1 },
    { nodeId: "transform", kind: "transform", concurrency: 1 },
    { nodeId: "router", kind: "router", concurrency: 1 },
    { nodeId: "process-main", kind: "transform", concurrency: 1 },
    { nodeId: "process-fallback", kind: "transform", concurrency: 1 },
    { nodeId: "persist", kind: "persist", concurrency: 1 },
    { nodeId: "sink", kind: "sink", concurrency: 1 },
  ],
  edges: [
    { edgeId: "receive-validate", from: "receive", to: "validate" },
    { edgeId: "validate-transform", from: "validate", to: "transform" },
    { edgeId: "transform-router", from: "transform", to: "router" },
    { edgeId: "router-main", from: "router", to: "process-main" },
    { edgeId: "router-fallback", from: "router", to: "process-fallback" },
    { edgeId: "main-persist", from: "process-main", to: "persist" },
    { edgeId: "fallback-persist", from: "process-fallback", to: "persist" },
    { edgeId: "persist-sink", from: "persist", to: "sink" },
  ],
  layout: {
    nodes: {
      receive: { x: 0, y: 0, z: 0 },
      validate: { x: 200, y: 0, z: 0 },
      transform: { x: 400, y: 0, z: 0 },
      router: { x: 600, y: 0, z: 0 },
      "process-main": { x: 800, y: 150, z: 0 },
      "process-fallback": { x: 800, y: -150, z: 0 },
      persist: { x: 1000, y: 0, z: 0 },
      sink: { x: 1200, y: 0, z: 0 },
    },
  },
};

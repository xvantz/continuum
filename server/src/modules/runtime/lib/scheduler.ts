import { err, ok, type Result } from "neverthrow";

import type { RuntimeContext, RuntimeToken } from "../types";

export type SchedulerObserver = {
  onNodeQueued?(args: { nodeId: string; token: RuntimeToken }): void;
  onNodeStart?(args: {
    nodeId: string;
    token: RuntimeToken;
    startTime: number;
  }): void;
  onNodeComplete?(args: {
    nodeId: string;
    token: RuntimeToken;
    startTime: number;
    endTime: number;
    durationMs: number;
    status: "ok" | "error";
    errorMessage?: string;
  }): void;
  onEdgeTransfer?(args: {
    fromNodeId: string;
    toNodeId: string;
    token: RuntimeToken;
  }): void;
};

export type NodeHandlerResult =
  | {
      type: "next";
      nextNodeId: string;
    }
  | {
      type: "complete";
      status: "ok" | "error";
      errorMessage?: string;
    };

export type NodeHandler = (
  token: RuntimeToken,
  context: RuntimeContext,
) => Promise<NodeHandlerResult>;

export type PipelineNodeState = {
  nodeId: string;
  concurrency: number;
  inflight: number;
  processed: number;
  failed: number;
  queue: RuntimeToken[];
  handler: NodeHandler;
};

export type SchedulerSnapshot = Array<{
  nodeId: string;
  queueLength: number;
  inflight: number;
  processed: number;
  failed: number;
}>;

export class PipelineScheduler {
  private readonly nodes = new Map<string, PipelineNodeState>();
  private context: RuntimeContext | null = null;
  private observer: SchedulerObserver | null = null;

  constructor(
    private readonly onComplete: (
      token: RuntimeToken,
      status: "ok" | "error",
      message?: string,
    ) => void,
  ) {}

  setObserver(observer: SchedulerObserver | null) {
    this.observer = observer;
  }

  initializeNode(args: {
    nodeId: string;
    concurrency: number;
    handler: NodeHandler;
  }) {
    this.nodes.set(args.nodeId, {
      nodeId: args.nodeId,
      concurrency: args.concurrency,
      handler: args.handler,
      inflight: 0,
      processed: 0,
      failed: 0,
      queue: [],
    });
  }

  start(context: RuntimeContext) {
    this.context = context;
    for (const node of this.nodes.values()) {
      node.queue.splice(0, node.queue.length);
      node.inflight = 0;
      node.processed = 0;
      node.failed = 0;
    }
  }

  stop() {
    for (const node of this.nodes.values()) {
      node.queue.splice(0, node.queue.length);
      node.inflight = 0;
    }
    this.context = null;
  }

  setConcurrency(nodeId: string, concurrency: number) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.concurrency = Math.max(1, concurrency);
    }
  }

  enqueue(nodeId: string, token: RuntimeToken): Result<void, string> {
    const node = this.nodes.get(nodeId);
    if (!node || !this.context) {
      return err("node_not_initialized");
    }
    token.trace.location = { type: "node", nodeId };
    this.observer?.onNodeQueued?.({ nodeId, token });
    node.queue.push(token);
    this.drain(node);
    return ok(undefined);
  }

  snapshot(): SchedulerSnapshot {
    const rows: SchedulerSnapshot = [];
    for (const node of this.nodes.values()) {
      rows.push({
        nodeId: node.nodeId,
        queueLength: node.queue.length,
        inflight: node.inflight,
        processed: node.processed,
        failed: node.failed,
      });
    }
    return rows;
  }

  private drain(node: PipelineNodeState) {
    while (
      node.queue.length > 0 &&
      node.inflight < node.concurrency &&
      this.context
    ) {
      const token = node.queue.shift();
      if (!token) break;
      node.inflight += 1;
      const startTime = Date.now();
      this.observer?.onNodeStart?.({
        nodeId: node.nodeId,
        token,
        startTime,
      });
      void this.runHandler(token, node, startTime);
    }
  }

  private async runHandler(
    token: RuntimeToken,
    node: PipelineNodeState,
    startedAt: number,
  ) {
    if (!this.context) return;
    const context = this.context;
    const result = await node
      .handler(token, context)
      .catch((): NodeHandlerResult => ({
        type: "complete",
        status: "error",
        errorMessage: "handler_failed",
      }));
    const endTime = Date.now();
    const durationMs = endTime - startedAt;

    if (result.type === "next") {
      node.processed += 1;
      node.inflight -= 1;
      if (node.inflight < 0) node.inflight = 0;
      this.drain(node);
      this.observer?.onNodeComplete?.({
        nodeId: node.nodeId,
        token,
        startTime: startedAt,
        endTime,
        durationMs,
        status: "ok",
      });
      const nextNode = this.nodes.get(result.nextNodeId);
      if (nextNode) {
        nextNode.queue.push(token);
        this.observer?.onEdgeTransfer?.({
          fromNodeId: node.nodeId,
          toNodeId: result.nextNodeId,
          token,
        });
        this.drain(nextNode);
      } else {
        this.onComplete(token, "error", "next_node_missing");
      }
      return;
    }

    node.inflight -= 1;
    if (result.status === "ok") {
      node.processed += 1;
    } else {
      node.failed += 1;
    }
    if (node.inflight < 0) node.inflight = 0;
    this.drain(node);
    this.observer?.onNodeComplete?.({
      nodeId: node.nodeId,
      token,
      startTime: startedAt,
      endTime,
      durationMs,
      status: result.status,
      errorMessage: result.errorMessage,
    });
    this.onComplete(token, result.status, result.errorMessage);
  }
}

import type { Graph } from "@shared/graph";
import type { MetricsSnapshot, NodeInspectPayload } from "@shared/metrics";
import type { Run } from "@shared/run";
import type { Span } from "@shared/trace";

type RuntimeEnvelope<TPayload> = {
  type: string;
  runId: string;
  seq: number;
  tServerMs: number;
  payload: TPayload;
};

type RuntimeStatePayload = {
  run: Run | null;
};

type GraphDefinitionPayload = {
  graph: Graph;
};

type ErrorPayload = {
  code: string;
  message: string;
};

type TraceSnapshotPayload = {
  traceId: string;
  spans: Span[];
};

type TraceUnsubscribePayload = {
  traceId: string;
};

type RuntimeEvents = {
  open: Event;
  close: CloseEvent;
  error: Event;
  snapshot: CustomEvent<MetricsSnapshot>;
  graph: CustomEvent<Graph>;
  state: CustomEvent<RuntimeStatePayload>;
  wsError: CustomEvent<ErrorPayload>;
  nodeInspect: CustomEvent<NodeInspectPayload>;
  traceSnapshot: CustomEvent<TraceSnapshotPayload>;
  traceSpan: CustomEvent<{ type: "trace.span.started" | "trace.span.ended"; span: Span }>;
  traceUnsubscribed: CustomEvent<TraceUnsubscribePayload>;
};

export type RuntimeEventName = keyof RuntimeEvents;

export class RuntimeClient extends EventTarget {
  private socket: WebSocket | null = null;
  private readonly url: string;

  constructor(url: string) {
    super();
    this.url = url;
  }

  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.addEventListener("open", () => {
      if (socket !== this.socket) return;
      this.dispatchEvent(new Event("open"));
    });
    socket.addEventListener("close", (event) => {
      if (socket !== this.socket) return;
      this.dispatchEvent(
        new CloseEvent("close", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        }),
      );
      if (this.socket === socket) {
        this.socket = null;
      }
    });
    socket.addEventListener("error", () => {
      if (socket !== this.socket) return;
      this.dispatchEvent(new Event("error"));
    });
    socket.addEventListener("message", (event) => {
      if (socket !== this.socket) return;
      this.handleMessage(event.data);
    });
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.close();
  }

  reconnect() {
    if (this.socket) {
      this.socket.close();
    }
    this.connect();
  }

  send(data: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(data));
  }

  inspectNode(nodeId: string) {
    this.send({ type: "node.inspect", nodeId });
  }

  subscribeTrace(traceId: string) {
    this.send({ type: "trace.subscribe", traceId });
  }

  unsubscribeTrace(traceId: string) {
    this.send({ type: "trace.unsubscribe", traceId });
  }

  private handleMessage(data: unknown) {
    if (typeof data !== "string") return;
    let parsed: RuntimeEnvelope<unknown>;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    switch (parsed.type) {
      case "metrics.snapshot": {
        const payload = parsed.payload as MetricsSnapshot;
        this.dispatchEvent(
          new CustomEvent("snapshot", { detail: payload }),
        );
        break;
      }
      case "graph.definition": {
        const payload = parsed.payload as GraphDefinitionPayload;
        this.dispatchEvent(
          new CustomEvent("graph", { detail: payload.graph }),
        );
        break;
      }
      case "runtime.state": {
        const payload = parsed.payload as RuntimeStatePayload;
        this.dispatchEvent(new CustomEvent("state", { detail: payload }));
        break;
      }
      case "error": {
        const payload = parsed.payload as ErrorPayload;
        this.dispatchEvent(
          new CustomEvent("wsError", { detail: payload }),
        );
        break;
      }
      case "node.inspect.response": {
        const payload = parsed.payload as { node: NodeInspectPayload };
        this.dispatchEvent(
          new CustomEvent("nodeInspect", { detail: payload.node }),
        );
        break;
      }
      case "trace.snapshot": {
        const payload = parsed.payload as TraceSnapshotPayload;
        this.dispatchEvent(
          new CustomEvent("traceSnapshot", { detail: payload }),
        );
        break;
      }
      case "trace.span.started":
      case "trace.span.ended": {
        const payload = parsed.payload as { span: Span };
        this.dispatchEvent(
          new CustomEvent("traceSpan", {
            detail: { type: parsed.type, span: payload.span },
          }),
        );
        break;
      }
      case "trace.unsubscribe.ack": {
        const payload = parsed.payload as TraceUnsubscribePayload;
        this.dispatchEvent(
          new CustomEvent("traceUnsubscribed", { detail: payload }),
        );
        break;
      }
      default:
        break;
    }
  }

  override addEventListener<K extends RuntimeEventName>(
    type: K,
    listener: (event: RuntimeEvents[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super.addEventListener(type, listener as any, options);
  }

  override removeEventListener<K extends RuntimeEventName>(
    type: K,
    listener: (event: RuntimeEvents[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super.removeEventListener(type, listener as any, options);
  }
}

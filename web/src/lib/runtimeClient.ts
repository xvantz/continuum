import type { Graph } from "@shared/graph";
import type { MetricsSnapshot } from "@shared/metrics";
import type { Run } from "@shared/run";

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

type RuntimeEvents = {
  open: Event;
  close: CloseEvent;
  error: Event;
  snapshot: CustomEvent<MetricsSnapshot>;
  graph: CustomEvent<Graph>;
  state: CustomEvent<RuntimeStatePayload>;
  wsError: CustomEvent<ErrorPayload>;
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
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("open", (event) => {
      this.dispatchEvent(event);
    });
    this.socket.addEventListener("close", (event) => {
      this.dispatchEvent(event);
    });
    this.socket.addEventListener("error", (event) => {
      this.dispatchEvent(event);
    });
    this.socket.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.close();
    this.socket = null;
  }

  send(data: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(data));
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


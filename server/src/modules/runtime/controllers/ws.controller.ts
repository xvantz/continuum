import websocket from "@fastify/websocket";
import type { FastifyBaseLogger } from "fastify";
import { defineController, type ServiceInstance } from "@server/src/core/modules";
import {
  DEFAULT_SIMULATION_CONTROLS,
  SimulationControlsSchema,
} from "@shared/controls";
import type { MetricsSnapshot } from "@shared/metrics";
import type { Span } from "@shared/trace";
import { graphRegistryService } from "../services/graphRegistry.service";
import { metricsService } from "../services/metrics.service";
import { runtimeService } from "../services/runtime.service";
import WebSocket, { type RawData } from "ws";
import { z } from "zod";

const RunStartCommandSchema = z.object({
  type: z.literal("run.start"),
  controls: SimulationControlsSchema.partial().optional().default({}),
});

const RunStopCommandSchema = z.object({
  type: z.literal("run.stop"),
});

const NodeInspectCommandSchema = z.object({
  type: z.literal("node.inspect"),
  nodeId: z.string().min(1),
});

const TraceSubscribeCommandSchema = z.object({
  type: z.literal("trace.subscribe"),
  traceId: z.string().min(1),
});

const TraceUnsubscribeCommandSchema = z.object({
  type: z.literal("trace.unsubscribe"),
  traceId: z.string().min(1),
});

const ClientCommandSchema = z.discriminatedUnion("type", [
  RunStartCommandSchema,
  RunStopCommandSchema,
  NodeInspectCommandSchema,
  TraceSubscribeCommandSchema,
  TraceUnsubscribeCommandSchema,
]);

let websocketRegistered = false;

export const wsController = defineController<"runtime">(
  "runtime",
  async ({ server, services }) => {
    if (!websocketRegistered) {
      await server.register(websocket);
      websocketRegistered = true;
    }

    server.get("/ws", { websocket: true }, (connection) => {
      const sessionLogger = server.log.child({ scope: "ws" });
      const serviceBag: RuntimeControllerServices = {
        runtime: services.runtime,
        metrics: services.metrics,
        graph: services.graph,
      };
      createSession(connection, serviceBag, sessionLogger);
    });
  },
);

type RuntimeControllerServices = Pick<
  {
    graph: ServiceInstance<typeof graphRegistryService>;
    runtime: ServiceInstance<typeof runtimeService>;
    metrics: ServiceInstance<typeof metricsService>;
  },
  "runtime" | "metrics" | "graph"
>;

type TraceEventPayload = {
  type: "trace.span.started" | "trace.span.ended";
  span: Span;
};

const createSession = (
  socket: WebSocket,
  services: RuntimeControllerServices,
  logger: FastifyBaseLogger,
) => {
  const metrics = services.metrics;
  const runtime = services.runtime;
  const traceSubscriptions = new Map<string, () => void>();
  let seqCounter = 0;

  const sendJson = (payload: unknown) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  };

  const sendEnvelope = <Payload>(
    type: string,
    payload: Payload,
    options?: { seq?: number; snapshot?: MetricsSnapshot },
  ) => {
    const snapshot = options?.snapshot ?? metrics.getSnapshot();
    const seq =
      typeof options?.seq === "number" ? options.seq : seqCounter++;
    sendJson({
      type,
      runId: snapshot.runId,
      seq,
      tServerMs: snapshot.tServerMs,
      payload,
    });
  };

  const sendMetricsSnapshot = (snapshot: MetricsSnapshot) => {
    sendJson({
      type: "metrics.snapshot",
      runId: snapshot.runId,
      seq: snapshot.seq,
      tServerMs: snapshot.tServerMs,
      payload: snapshot,
    });
  };

  const sendError = (code: string, message: string, details?: unknown) => {
    logger.warn({ code, message, details }, "ws error");
    sendEnvelope("error", { code, message, details });
  };

  const unsubscribeSnapshot = metrics.onSnapshot(sendMetricsSnapshot);
  const unsubscribeRun = runtime.onRunLifecycle({
    onRunStart(run) {
      sendEnvelope("runtime.state", { run });
    },
    onRunStop(run) {
      sendEnvelope("runtime.state", { run });
    },
  });

  const cleanup = () => {
    unsubscribeSnapshot();
    unsubscribeRun();
    for (const unsubscribe of traceSubscriptions.values()) {
      unsubscribe();
    }
    traceSubscriptions.clear();
  };

  socket.on("close", cleanup);
  socket.on("error", (error: Error) => {
    logger.warn({ error }, "ws socket error");
    cleanup();
  });

  const handleCommand = (command: z.infer<typeof ClientCommandSchema>) => {
    switch (command.type) {
      case "run.start":
        runtime.startRun({
          ...DEFAULT_SIMULATION_CONTROLS,
          ...command.controls,
        }).match(
          (run) => {
            sendEnvelope("runtime.state", { run });
          },
          (error) => {
            const reason =
              error === "run_already_active"
                ? "Simulation already running"
                : "Unable to start run";
            sendError(error, reason);
          },
        );
        break;
      case "run.stop":
        runtime.stopRun().match(
          (run) => {
            sendEnvelope("runtime.state", { run });
          },
          (error) => {
            sendError(error, "No active run to stop");
          },
        );
        break;
      case "node.inspect": {
        const inspect = metrics.getNodeInspect(command.nodeId);
        if (!inspect) {
          sendError("node_not_found", `Node ${command.nodeId} not found`);
          return;
        }
        sendEnvelope("node.inspect.response", { node: inspect });
        break;
      }
      case "trace.subscribe": {
        if (traceSubscriptions.has(command.traceId)) {
          sendError(
            "trace_already_subscribed",
            `Trace ${command.traceId} already subscribed`,
          );
          return;
        }
        const listener = (event: TraceEventPayload) => {
          sendEnvelope(event.type, { span: event.span });
        };
        const unsubscribe = metrics.subscribeTrace(
          command.traceId,
          listener,
        );
        traceSubscriptions.set(command.traceId, unsubscribe);
        const spans = metrics.getTraceSpans(command.traceId);
        sendEnvelope("trace.snapshot", {
          traceId: command.traceId,
          spans,
        });
        break;
      }
      case "trace.unsubscribe": {
        const unsubscribe = traceSubscriptions.get(command.traceId);
        if (!unsubscribe) {
          sendError(
            "trace_not_subscribed",
            `Trace ${command.traceId} not subscribed`,
          );
          return;
        }
        unsubscribe();
        traceSubscriptions.delete(command.traceId);
        sendEnvelope("trace.unsubscribe.ack", { traceId: command.traceId });
        break;
      }
    }
  };

  socket.on("message", (data: RawData) => {
    try {
      const parsed = JSON.parse(
        typeof data === "string" ? data : data.toString(),
      );
      const validated = ClientCommandSchema.safeParse(parsed);
      if (!validated.success) {
        sendError(
          "invalid_payload",
          "Invalid payload",
          validated.error.issues,
        );
        return;
      }
      handleCommand(validated.data);
    } catch (error) {
      sendError("invalid_json", "Unable to parse incoming message");
    }
  });

  sendEnvelope("graph.definition", { graph: runtime.getGraph() });
  sendEnvelope("runtime.state", { run: runtime.getState() });
  sendMetricsSnapshot(metrics.getSnapshot());
};

import fastify from "fastify";
import type pino from "pino";

export function createServer(loggerInstance: pino.Logger) {
  const app = fastify({
    loggerInstance,
  });

  return app;
}

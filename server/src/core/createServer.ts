import fastify from "fastify";
import type pino from "pino";

export function createServer(logger: pino.Logger) {
  const app = fastify({
    logger,
  });

  return app;
}

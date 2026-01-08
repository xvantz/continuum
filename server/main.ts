import { createEventBus } from "@server/src/core/createEventBus";
import { createLogger } from "@server/src/core/createLogger";
import { createServer } from "@server/src/core/createServer";
import { modules } from "@server/src/modules";

async function bootstrap() {
  const logger = createLogger();
  const server = createServer(logger);
  const bus = createEventBus({
    onHandlerError: ({ key, cause }) =>
      logger.error({ key, cause }, "event handler failed"),
  });

  for (const moduleDef of modules) {
    await moduleDef.init({ logger, server, bus });
    logger.info({ module: moduleDef.name }, "module initialized");
  }

  const port = Number(process.env.PORT ?? 4000);
  await server.listen({ port, host: "0.0.0.0" });
  logger.info({ port }, "server listening");
}

bootstrap();

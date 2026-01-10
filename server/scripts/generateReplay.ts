import { setTimeout as delay } from "node:timers/promises";

import { createEventBus } from "@server/src/core/createEventBus";
import { createLogger } from "@server/src/core/createLogger";
import { createServer } from "@server/src/core/createServer";
import { modules } from "@server/src/modules";
import { DEFAULT_SIMULATION_CONTROLS } from "@shared/controls";

const DURATION_MS = Number(process.env.REPLAY_DURATION_MS ?? 10000);

async function main() {
  const logger = createLogger();
  const server = createServer(logger);
  const bus = createEventBus({
    onHandlerError: ({ key, cause }) =>
      logger.error({ key, cause }, "event bus handler failed"),
  });

  let runtimeServices: ModuleContracts["runtime"]["services"] | null = null;

  for (const moduleDef of modules) {
    const services = await moduleDef.init({ logger, server, bus });
    if (moduleDef.name === "runtime") {
      runtimeServices = services as ModuleContracts["runtime"]["services"];
    }
    logger.info({ module: moduleDef.name }, "module initialized for replay recording");
  }

  if (!runtimeServices) {
    throw new Error("runtime services not initialized");
  }

  const runtime = runtimeServices.runtime;
  const replay = runtimeServices.replay;

  logger.info({ durationMs: DURATION_MS }, "starting replay recording run");

  const startResult = runtime.startRun(DEFAULT_SIMULATION_CONTROLS);
  if (startResult.isErr()) {
    throw new Error(`Failed to start run: ${startResult.error}`);
  }
  await delay(DURATION_MS);
  const stopResult = runtime.stopRun();
  if (stopResult.isErr()) {
    throw new Error(`Failed to stop run: ${stopResult.error}`);
  }

  await replay.exportLatestBundle();

  logger.info("replay bundle exported");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

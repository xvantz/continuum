import { promises as fs } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { createEventBus } from "@server/src/core/createEventBus";
import { createLogger } from "@server/src/core/createLogger";
import { createServer } from "@server/src/core/createServer";
import { modules } from "@server/src/modules";
import {
  DEFAULT_SIMULATION_CONTROLS,
  type SimulationControls,
} from "@shared/controls";

const DURATION_MS = Number(process.env.REPLAY_DURATION_MS ?? 10000);
const DEMOS_DIR = path.resolve(process.cwd(), "demos");

type Preset = {
  id: string;
  controls: SimulationControls;
};

const buildControls = (overrides: Partial<SimulationControls>) => ({
  ...DEFAULT_SIMULATION_CONTROLS,
  runDurationMs: DURATION_MS,
  ...overrides,
});

const PRESETS: Preset[] = [
  {
    id: "easy",
    controls: buildControls({
      requestRate: 30,
      payloadComplexity: 1,
      nodeConcurrency: 1,
      failureRate: 1,
      seed: 1,
    }),
  },
  {
    id: "mid",
    controls: buildControls({
      requestRate: 80,
      payloadComplexity: 3,
      nodeConcurrency: 3,
      failureRate: 5,
      seed: 2,
    }),
  },
  {
    id: "hard",
    controls: buildControls({
      requestRate: 160,
      payloadComplexity: 5,
      nodeConcurrency: 6,
      failureRate: 10,
      seed: 3,
    }),
  },
];

async function main() {
  await fs.mkdir(DEMOS_DIR, { recursive: true });

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
    logger.info(
      { module: moduleDef.name },
      "module initialized for replay recording",
    );
  }

  if (!runtimeServices) {
    throw new Error("runtime services not initialized");
  }

  const runtime = runtimeServices.runtime;
  const replay = runtimeServices.replay;

  for (const preset of PRESETS) {
    logger.info({ preset: preset.id }, "starting replay preset recording");
    const startResult = runtime.startRun(preset.controls);
    if (startResult.isErr()) {
      throw new Error(`Failed to start run: ${startResult.error}`);
    }
    await delay(DURATION_MS);
    if (runtime.getState()?.status === "running") {
      const stopResult = runtime.stopRun();
      if (stopResult.isErr()) {
        throw new Error(`Failed to stop run: ${stopResult.error}`);
      }
    }
    const bundle = replay.getLatestBundle();
    if (!bundle) {
      throw new Error("no replay bundle available");
    }
    const targetPath = path.join(DEMOS_DIR, `${preset.id}.json`);
    await fs.writeFile(targetPath, JSON.stringify(bundle, null, 2), "utf8");
    logger.info({ path: targetPath }, "replay preset bundle written");
  }

  logger.info("replay presets exported");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

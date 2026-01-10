import { defineModule, type ServiceInstance } from "@server/src/core/modules";

import { graphRegistryService } from "./services/graphRegistry.service";
import { metricsService } from "./services/metrics.service";
import { runtimeService } from "./services/runtime.service";
import { wsController } from "./controllers/ws.controller";
import { replayRecorderService } from "./services/replayRecorder.service";

type RuntimeServices = {
  graph: ServiceInstance<typeof graphRegistryService>;
  runtime: ServiceInstance<typeof runtimeService>;
  metrics: ServiceInstance<typeof metricsService>;
  replay: ServiceInstance<typeof replayRecorderService>;
};

type RuntimeControllers = {
  ws: typeof wsController;
};

declare global {
  interface ModuleContracts {
    runtime: {
      services: RuntimeServices;
      controllers: RuntimeControllers;
      events: Record<string, never>;
    };
  }
}

export const runtimeModule = defineModule({
  name: "runtime",
  services: {
    graph: graphRegistryService,
    runtime: runtimeService,
    metrics: metricsService,
    replay: replayRecorderService,
  },
  controllers: {
    ws: wsController,
  },
  events: {},
});

import { defineModule, type ServiceInstance } from "@server/src/core/modules";

import { graphRegistryService } from "./services/graphRegistry.service";
import { metricsService } from "./services/metrics.service";
import { runtimeService } from "./services/runtime.service";
import { wsController } from "./controllers/ws.controller";

type RuntimeServices = {
  graph: ServiceInstance<typeof graphRegistryService>;
  runtime: ServiceInstance<typeof runtimeService>;
  metrics: ServiceInstance<typeof metricsService>;
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
  },
  controllers: {
    ws: wsController,
  },
  events: {},
});

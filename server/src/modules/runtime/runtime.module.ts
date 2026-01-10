import { defineModule, type ServiceInstance } from "@server/src/core/modules";

import { graphRegistryService } from "./services/graphRegistry.service";
import { metricsService } from "./services/metrics.service";
import { runtimeService } from "./services/runtime.service";

type RuntimeServices = {
  graph: ServiceInstance<typeof graphRegistryService>;
  runtime: ServiceInstance<typeof runtimeService>;
  metrics: ServiceInstance<typeof metricsService>;
};

declare global {
  interface ModuleContracts {
    runtime: {
      services: RuntimeServices;
      controllers: Record<string, never>;
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
  controllers: {},
  events: {},
});

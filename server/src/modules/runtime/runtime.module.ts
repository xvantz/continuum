import { defineModule, type ServiceInstance } from "@server/src/core/modules";

import { graphRegistryService } from "./services/graphRegistry.service";
import { runtimeService } from "./services/runtime.service";

type RuntimeServices = {
  graph: ServiceInstance<typeof graphRegistryService>;
  runtime: ServiceInstance<typeof runtimeService>;
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
  },
  controllers: {},
  events: {},
});


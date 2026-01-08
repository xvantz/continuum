import { defineModule, type ServiceInstance } from "@server/src/core/modules";
import {
  activityService,
  eventGatewayService,
  greetingService,
  metricsService,
} from "./services";
import { httpController } from "./controllers";
import { busEvents } from "./events";

type DemoServiceContract = {
  metrics: ServiceInstance<typeof metricsService>;
  greetings: ServiceInstance<typeof greetingService>;
  activity: ServiceInstance<typeof activityService>;
  gateway: ServiceInstance<typeof eventGatewayService>;
};

type DemoControllerContract = {
  http: typeof httpController;
};

type DemoEventContract = {
  bus: typeof busEvents;
};

declare global {
  interface ModuleContracts {
    demo: {
      services: DemoServiceContract;
      controllers: DemoControllerContract;
      events: DemoEventContract;
    };
  }
}

export const demoModule = defineModule({
  name: "demo",
  services: {
    metrics: metricsService,
    greetings: greetingService,
    activity: activityService,
    gateway: eventGatewayService,
  },
  controllers: {
    http: httpController,
  },
  events: {
    bus: busEvents,
  },
});

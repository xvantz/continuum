import { defineService } from "@server/src/core/modules";

export const eventGatewayService = defineService("demo", ({ bus }) => ({
  requestGreeting(name: string) {
    return bus.request("demo", "greet.request", name);
  },
}));

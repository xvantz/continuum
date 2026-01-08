import { defineService } from "@server/src/core/modules";
import type { GreetingPayload, GreetingSource } from "../types";

export const greetingService = defineService("demo", ({ services, logger, bus }) => {
  return {
    greet(name: string, source: GreetingSource): GreetingPayload {
      const message = `Hello, ${name}!`;
      const stats = services.metrics.record(source);
      const payload: GreetingPayload = {
        name,
        message,
        source,
        total: stats.total,
      };

      logger.info({ payload }, "greeting prepared");
      bus.publish("demo", "greet.broadcast", payload);

      return payload;
    },
  };
});

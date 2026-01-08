import type { BusError } from "@server/src/core/createEventBus";
import { defineService } from "@server/src/core/modules";
import type { GreetingPayload, GreetingTimelineEntry } from "../types";

export const activityService = defineService("demo", ({ logger }) => {
  const timeline: GreetingTimelineEntry[] = [];
  const errors: BusError[] = [];

  return {
    recordBroadcast(payload: GreetingPayload) {
      const entry: GreetingTimelineEntry = {
        ...payload,
        at: new Date().toISOString(),
      };
      timeline.push(entry);
      logger.info({ entry }, "broadcast handled");
      return entry;
    },
    recordBusError(error: BusError) {
      errors.push(error);
      logger.warn({ error }, "event handler registration issue");
    },
    timeline() {
      return [...timeline];
    },
    errors() {
      return [...errors];
    },
  };
});

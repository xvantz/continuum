import { defineEvents } from "@server/src/core/modules";
import type { GreetingPayload } from "../types";

declare global {
  interface BusEvents {
    demo: {
      "greet.request": [name: string];
      "greet.broadcast": [payload: GreetingPayload];
    };
  }
}

export const busEvents = defineEvents("demo", ({ bus, services }) => {
  const registration = bus.reply("demo", "greet.request", async (name) =>
    services.greetings.greet(name, "events"),
  );

  if (registration.isErr()) {
    services.activity.recordBusError(registration.error);
  }

  bus.sub("demo", "greet.broadcast", async (payload) => {
    services.activity.recordBroadcast(payload);
  });
});

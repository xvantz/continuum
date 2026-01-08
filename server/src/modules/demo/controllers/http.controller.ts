import { defineController } from "@server/src/core/modules";

export const httpController = defineController("demo", ({ server, services }) => {
  server.get<{ Params: { name: string } }>(
    "/demo/greet/:name",
    async (request) => {
      return services.greetings.greet(request.params.name, "http");
    },
  );

  server.get<{ Params: { name: string } }>(
    "/demo/event/:name",
    async (request, reply) => {
      return services.gateway.requestGreeting(request.params.name).match(
        (payload) => payload,
        (error) => {
          reply.status(503);
          return { error };
        },
      );
    },
  );

  server.get("/demo/activity", async () => ({
    timeline: services.activity.timeline(),
    errors: services.activity.errors(),
  }));

  server.get("/demo/stats", async () => services.metrics.snapshot());
});

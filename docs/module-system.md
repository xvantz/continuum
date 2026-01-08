# Module System Guide

This architecture lets us assemble the server from independent modules. Each module bundles services, HTTP controllers, and event handlers, and the shared context types come from `ModuleContracts`. Declare a contract once (usually next to the module) and every `define*("moduleName", …)` automatically receives the correct service API.

## Core building blocks

- `defineService("module", fn)` describes a service. The callback receives the module context (`logger`, `bus`, `services`) and returns the service instance. Neighboring services are already available in `services`, so cross-service calls stay type-safe.
- `defineController("module", fn)` registers HTTP routes. Controllers see the Fastify instance plus the typed service map declared in the contract.
- `defineEvents("module", fn)` wires event handlers into the bus, also using the same context.
- `defineModule` ties everything together by instantiating services first, then running controllers/events with the shared runtime context (`logger`, `server`, `bus`).

> Import aliases: `@server/*` points to `server/` and `@web/*` to `web/`, so we avoid deep relative paths (see `server/main.ts`).

## Module lifecycle

1. **Create services.** Each service gets a child logger (`{ module, service }`), the event bus, and the already-initialized service map.
2. **Register controllers.** Once services exist, controllers attach routes and delegate to the service layer.
3. **Register events.** Lastly, the module subscribes to bus events or request/reply channels that trigger service logic outside HTTP.

## Minimal example

```ts
// hello/services/greeter.service.ts
import { defineService } from "@server/src/core/modules";

export const greeterService = defineService("hello", () => ({
  greet(name: string) {
    return `Hello, ${name}!`;
  },
}));

// hello/controllers/rest.controller.ts
import { defineController } from "@server/src/core/modules";

export const restController = defineController("hello", ({ server, services }) => {
  server.get("/hello/:name", async (req) => ({
    message: services.greeter.greet(req.params.name),
  }));
});

// hello/events/greet.events.ts
import { defineEvents } from "@server/src/core/modules";

export const greetEvents = defineEvents("hello", ({ bus, services }) => {
  bus.reply("hello", "greet", async (name: string) =>
    services.greeter.greet(name),
  );
});

// hello/hello.module.ts
import {
  defineModule,
  type ServiceInstance,
} from "@server/src/core/modules";
import { greeterService } from "./services/greeter.service";
import { restController } from "./controllers/rest.controller";
import { greetEvents } from "./events/greet.events";

type HelloServices = {
  greeter: ServiceInstance<typeof greeterService>;
};

type HelloControllers = {
  rest: typeof restController;
};

type HelloEvents = {
  greetRequests: typeof greetEvents;
};

declare global {
  interface ModuleContracts {
    hello: {
      services: HelloServices;
      controllers: HelloControllers;
      events: HelloEvents;
    };
  }
}

export const helloModule = defineModule({
  name: "hello",
  services: { greeter: greeterService },
  controllers: {
    rest: restController,
  },
  events: {
    greetRequests: greetEvents,
  },
});
```

The contract lives next to the module and references the actual factories (`ServiceInstance<typeof greeterService>`, `typeof restController`, etc.), so it always reflects the real entry points.

## Bootstrap

Call `module.init` during bootstrap and pass the shared runtime context so each module can spin up:

```ts
import { modules } from "./src/modules";

for (const moduleDef of modules) {
  await moduleDef.init({ logger, server, bus });
}
```

Each `init` returns a map of instantiated services. You can pass it into tests or other systems if needed.

## Tips

- Keep services dependent on each other’s API rather than implementation details; the contract enforces that interface.
- Use events for background or cross-transport flows so business logic isn’t tied to HTTP.
- Controllers should stay thin—business logic belongs in services.
- If a module needs configuration, capture it via closures when calling `defineModule` or add a dedicated config service.

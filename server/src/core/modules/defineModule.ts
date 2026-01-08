import type {
  DefinedModule,
  InferServiceInstances,
  ModuleDefinition,
  ModuleEventDefinitions,
  ModuleName,
  ModuleRuntimeContext,
  ModuleControllerDefinitions,
  ModuleServiceDefinitions,
  ModuleServices,
  ServiceDefinitionRecord,
} from "./types";

export function defineModule<
  const Name extends ModuleName,
  const Services extends ModuleServiceDefinitions<Name>,
  const Controllers extends ModuleControllerDefinitions<Name> = ModuleControllerDefinitions<Name>,
  const Events extends ModuleEventDefinitions<Name> = ModuleEventDefinitions<Name>,
>(
  definition: ModuleDefinition<Name, Services, Controllers, Events>,
): DefinedModule<Name, Services, Controllers, Events> {
  const init = async (ctx: ModuleRuntimeContext) => {
    const services = await instantiateServices<Name, Services>(
      definition.name,
      definition.services,
      ctx,
    );
    await registerControllers<Name, Services>(definition.controllers, ctx, services);
    await registerEvents<Name, Services>(definition.events, ctx, services);
    return services;
  };

  return {
    ...definition,
    init,
  };
}

async function instantiateServices<
  Name extends ModuleName,
  Services extends ServiceDefinitionRecord<Name>,
>(
  moduleName: Name,
  definitions: Services,
  ctx: ModuleRuntimeContext,
): Promise<InferServiceInstances<Services>> {
  const moduleLogger = ctx.logger.child({ module: moduleName });
  const instances = {} as InferServiceInstances<Services>;
  const serviceKeys = Object.keys(definitions) as Array<keyof Services>;

  for (const key of serviceKeys) {
    const definition = definitions[key];
    const logger = moduleLogger.child({ service: String(key) });
    const instance = await definition.create({
      logger,
      bus: ctx.bus,
      services: instances as unknown as ModuleServices<Name>,
    });
    instances[key] = instance as InferServiceInstances<Services>[typeof key];
  }

  return instances;
}

async function registerControllers<
  Name extends ModuleName,
  Services extends ServiceDefinitionRecord<Name>,
>(
  controllers: ModuleControllerDefinitions<Name> | undefined,
  ctx: ModuleRuntimeContext,
  services: InferServiceInstances<Services>,
) {
  if (!controllers) return;

  for (const controller of Object.values(controllers)) {
    await controller.register({
      server: ctx.server,
      services: services as unknown as ModuleServices<Name>,
    });
  }
}

async function registerEvents<
  Name extends ModuleName,
  Services extends ServiceDefinitionRecord<Name>,
>(
  events: ModuleEventDefinitions<Name> | undefined,
  ctx: ModuleRuntimeContext,
  services: InferServiceInstances<Services>,
) {
  if (!events) return;

  for (const handler of Object.values(events)) {
    await handler.register({
      bus: ctx.bus,
      services: services as unknown as ModuleServices<Name>,
    });
  }
}

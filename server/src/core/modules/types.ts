import type { FastifyInstance } from "fastify";
import type pino from "pino";
import type { EventBus } from "../createEventBus";

declare global {
  interface ModuleContracts {}
}

type ModuleContractName = keyof ModuleContracts;

export type ModuleName = [ModuleContractName] extends [never]
  ? string
  : ModuleContractName & string;

type ModuleContract<Name extends ModuleName> = Name extends ModuleContractName
  ? ModuleContracts[Name]
  : {
      services: Record<string, unknown>;
      controllers?: Record<string, ControllerDefinition<Name>>;
      events?: Record<string, EventDefinition<Name>>;
    };

export type ModuleServices<Name extends ModuleName> =
  ModuleContract<Name>["services"];

export type ModuleLogger = pino.Logger;
export type ModuleServer = FastifyInstance<any, any, any, any>;

export type ModuleRuntimeContext = {
  logger: ModuleLogger;
  server: ModuleServer;
  bus: EventBus;
};

export type MaybePromise<T> = T | Promise<T>;

export type ServiceContext<Name extends ModuleName> = {
  logger: ModuleLogger;
  bus: EventBus;
  services: ModuleServices<Name>;
};

export type ControllerContext<Name extends ModuleName> = {
  server: ModuleServer;
  services: ModuleServices<Name>;
};

export type EventContext<Name extends ModuleName> = {
  bus: EventBus;
  services: ModuleServices<Name>;
};

export type ServiceBuilder<Name extends ModuleName, TService = unknown> = (
  ctx: ServiceContext<Name>,
) => MaybePromise<TService>;

export type ControllerBuilder<Name extends ModuleName> = (
  ctx: ControllerContext<Name>,
) => void | Promise<void>;

export type EventBuilder<Name extends ModuleName> = (
  ctx: EventContext<Name>,
) => void | Promise<void>;

export type ServiceDefinition<
  Name extends ModuleName,
  Builder extends ServiceBuilder<Name>,
> = {
  kind: "service";
  create: Builder;
};

export type ControllerDefinition<Name extends ModuleName> = {
  kind: "controller";
  register: ControllerBuilder<Name>;
};

export type EventDefinition<Name extends ModuleName> = {
  kind: "events";
  register: EventBuilder<Name>;
};

export type ServiceDefinitionRecord<Name extends ModuleName> = Record<
  string,
  ServiceDefinition<Name, ServiceBuilder<Name>>
>;

export type ControllerDefinitionRecord<Name extends ModuleName> = Record<
  string,
  ControllerDefinition<Name>
>;

export type EventDefinitionRecord<Name extends ModuleName> = Record<
  string,
  EventDefinition<Name>
>;

export type ServiceInstance<
  Def extends ServiceDefinition<ModuleName, ServiceBuilder<ModuleName>>,
> = Awaited<ReturnType<Def["create"]>>;

export type InferServiceInstances<
  Defs extends ServiceDefinitionRecord<ModuleName>,
> = {
  [K in keyof Defs]: ServiceInstance<Defs[K]>;
};

type ContractedServiceDefinitions<Name extends ModuleName> =
  Name extends ModuleContractName
    ? {
        [K in keyof ModuleContracts[Name]["services"]]: ServiceDefinition<
          Name,
          ServiceBuilder<Name, ModuleContracts[Name]["services"][K]>
        >;
      }
    : Record<string, never>;

export type ModuleServiceDefinitions<Name extends ModuleName> =
  ServiceDefinitionRecord<Name> & ContractedServiceDefinitions<Name>;

type ContractedControllerDefinitions<Name extends ModuleName> =
  Name extends ModuleContractName
    ? ModuleContract<Name> extends { controllers: infer Controllers }
      ? Controllers extends Record<string, ControllerDefinition<Name>>
        ? Controllers
        : {}
      : {}
    : {};

export type ModuleControllerDefinitions<Name extends ModuleName> =
  ControllerDefinitionRecord<Name> & ContractedControllerDefinitions<Name>;

type ContractedEventDefinitions<Name extends ModuleName> =
  Name extends ModuleContractName
    ? ModuleContract<Name> extends { events: infer Events }
      ? Events extends Record<string, EventDefinition<Name>>
        ? Events
        : {}
      : {}
    : {};

export type ModuleEventDefinitions<Name extends ModuleName> =
  EventDefinitionRecord<Name> & ContractedEventDefinitions<Name>;

type RequireControllers<
  Name extends ModuleName,
  Controllers,
> = keyof ContractedControllerDefinitions<Name> extends never
  ? { controllers?: Controllers }
  : { controllers: Controllers };

type RequireEvents<
  Name extends ModuleName,
  Events,
> = keyof ContractedEventDefinitions<Name> extends never
  ? { events?: Events }
  : { events: Events };

export type ModuleDefinition<
  Name extends ModuleName,
  Services extends ModuleServiceDefinitions<Name>,
  Controllers extends ModuleControllerDefinitions<Name>,
  Events extends ModuleEventDefinitions<Name>,
> = {
  name: Name;
  services: Services;
} & RequireControllers<Name, Controllers> &
  RequireEvents<Name, Events>;

export type DefinedModule<
  Name extends ModuleName,
  Services extends ModuleServiceDefinitions<Name>,
  Controllers extends ModuleControllerDefinitions<Name>,
  Events extends ModuleEventDefinitions<Name>,
> = ModuleDefinition<Name, Services, Controllers, Events> & {
  init: (ctx: ModuleRuntimeContext) => Promise<InferServiceInstances<Services>>;
};

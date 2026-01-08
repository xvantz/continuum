import type {
  ModuleName,
  ServiceBuilder,
  ServiceDefinition,
} from "./types";

export function defineService<Name extends ModuleName, Builder extends ServiceBuilder<Name>>(
  moduleName: Name,
  create: Builder,
): ServiceDefinition<Name, Builder> {
  void moduleName;
  return { kind: "service", create };
}

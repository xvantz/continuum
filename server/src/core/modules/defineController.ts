import type {
  ControllerBuilder,
  ControllerDefinition,
  ModuleName,
} from "./types";

export function defineController<Name extends ModuleName>(
  moduleName: Name,
  register: ControllerBuilder<Name>,
): ControllerDefinition<Name> {
  void moduleName;
  return { kind: "controller", register };
}

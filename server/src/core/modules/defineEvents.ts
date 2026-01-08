import type { EventBuilder, EventDefinition, ModuleName } from "./types";

export function defineEvents<Name extends ModuleName>(
  moduleName: Name,
  register: EventBuilder<Name>,
): EventDefinition<Name> {
  void moduleName;
  return { kind: "events", register };
}

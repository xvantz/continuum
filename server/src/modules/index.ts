import { demoModule } from "./demo/demo.module";
import { runtimeModule } from "./runtime/runtime.module";

export { demoModule, runtimeModule };

export const modules = [runtimeModule, demoModule] as const;

import "./app.css";
import { err, ok, Result } from "neverthrow";
import { mount } from "svelte";
import App from "./App.svelte";

type MountError = {
  message: string;
};

const findMountTarget = (): Result<HTMLElement, MountError> => {
  const target = document.getElementById("app");

  if (!target) {
    return err({ message: "Failed to find #app container" });
  }

  return ok(target);
};

const mountTargetResult = findMountTarget();

if (mountTargetResult.isErr()) console.error(mountTargetResult.error.message);

const app = mountTargetResult.isOk()
  ? mount(App, {
      target: mountTargetResult.value,
    })
  : undefined;

export default app;

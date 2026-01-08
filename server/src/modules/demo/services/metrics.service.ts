import { defineService } from "@server/src/core/modules";
import type { GreetingSource, GreetingStats } from "../types";

export const metricsService = defineService("demo", () => {
  const totals: Record<GreetingSource, number> = {
    http: 0,
    events: 0,
    internal: 0,
  };

  const snapshot = (): GreetingStats => ({
    totals: { ...totals },
    total: totals.http + totals.events + totals.internal,
  });

  return {
    record(source: GreetingSource) {
      totals[source] += 1;
      return snapshot();
    },
    snapshot,
  };
});

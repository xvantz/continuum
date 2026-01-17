import { defineService } from "@server/src/core/modules";
import type { Graph } from "@shared/graph";
import { CONTINUUM_GRAPH } from "@shared/graphPresets";

const cloneGraph = (): Graph => JSON.parse(JSON.stringify(CONTINUUM_GRAPH));

export const graphRegistryService = defineService("runtime", () => {
  return {
    getGraph(): Graph {
      return cloneGraph();
    },
  };
});

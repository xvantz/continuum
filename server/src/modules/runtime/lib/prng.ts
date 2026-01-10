export type PRNG = () => number;

/**
 * Linear congruential generator to guarantee deterministic randomness across
 * runs. All math stays in the 32-bit range for reproducibility.
 */
export const createPrng = (seed: number): PRNG => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};


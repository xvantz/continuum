import { createHash } from "node:crypto";

import type { RuntimePayload } from "../types";
import { createPrng } from "./prng";

const BLOCK_BASE = 32;

const buildMatrix = (seed: number, complexity: number): number[][] => {
  const prng = createPrng(seed);
  const rows = complexity + 2;
  const cols = BLOCK_BASE * complexity;

  const matrix: number[][] = [];
  for (let r = 0; r < rows; r += 1) {
    const row: number[] = [];
    for (let c = 0; c < cols; c += 1) {
      const value = Math.floor(prng() * 1_000_000);
      row.push(value);
    }
    matrix.push(row);
  }
  return matrix;
};

const normalizeRow = (row: number[]): number => {
  const sum = row.reduce((acc, value) => acc + value, 0);
  return sum / row.length;
};

const deriveDigest = (matrix: number[][]): string => {
  const hash = createHash("sha256");
  for (const row of matrix) {
    for (const value of row) {
      hash.update(value.toString(16));
    }
  }
  return hash.digest("hex");
};

export const generatePayload = (
  seed: number,
  complexity: number,
): RuntimePayload => {
  const matrix = buildMatrix(seed, complexity);
  const normalizedVector = matrix.map(normalizeRow);

  const digest = deriveDigest(matrix);

  const tasks = normalizedVector.map((value, index) => ({
    id: `${index}`,
    weight: Math.max(1, Math.round(value % 1000)),
  }));

  return {
    matrix,
    normalizedVector,
    tasks,
    digest,
  };
};


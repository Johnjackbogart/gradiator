import { clamp } from "../utils/math.js";
import { decodeUrlState, encodeUrlState } from "../utils/url-state.js";
import type { GradientPoint, SerializedGradiatorState } from "./types";

type SerializeGradiatorStateInput = {
  rows: number;
  cols: number;
  flowModeIndex: number;
  aspectModeKey: SerializedGradiatorState["aspect"];
  grid: GradientPoint[][];
  roundValue: (value: number) => number;
};

export type RestoredGradiatorState = {
  rows: number;
  cols: number;
  flowModeIndex: number | null;
  aspectModeKey: string | null;
  grid: GradientPoint[][];
};

export function serializeGradiatorState({
  rows,
  cols,
  flowModeIndex,
  aspectModeKey,
  grid,
  roundValue,
}: SerializeGradiatorStateInput) {
  return encodeUrlState({
    v: 2,
    rows,
    cols,
    flow: flowModeIndex,
    aspect: aspectModeKey,
    points: grid.flatMap((row) =>
      row.flatMap((point) => [
        roundValue(point.x),
        roundValue(point.y),
        roundValue(point.r),
        roundValue(point.g),
        roundValue(point.b),
      ]),
    ),
  } satisfies SerializedGradiatorState);
}

export function parseGradiatorState(encoded: string): RestoredGradiatorState | null {
  const state = decodeUrlState(encoded);
  const rows = state?.rows;
  const cols = state?.cols;
  const points = state?.points;
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) return null;
  if (!Array.isArray(points) || points.length !== rows * cols * 5) return null;

  const grid: GradientPoint[][] = [];
  let index = 0;
  for (let row = 0; row < rows; row++) {
    const nextRow: GradientPoint[] = [];
    for (let col = 0; col < cols; col++) {
      const x = points[index++];
      const y = points[index++];
      const r = points[index++];
      const g = points[index++];
      const b = points[index++];
      if (![x, y, r, g, b].every(Number.isFinite)) return null;
      nextRow.push({
        x: clamp(x, 0, 1),
        y: clamp(y, 0, 1),
        r: clamp(r, 0, 1),
        g: clamp(g, 0, 1),
        b: clamp(b, 0, 1),
      });
    }
    grid.push(nextRow);
  }

  return {
    rows,
    cols,
    flowModeIndex: Number.isInteger(state.flow) ? state.flow : null,
    aspectModeKey: typeof state?.aspect === "string" ? state.aspect : null,
    grid,
  };
}

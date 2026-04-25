import { clamp } from "../utils/math.js";
import { decodeUrlState, encodeUrlState } from "../utils/url-state.js";
import type {
  AnimationEasing,
  GradientPoint,
  PointAnimationPath,
  SerializedGradiatorState,
  SerializedPointAnimationPath,
} from "./types";

type SerializeGradiatorStateInput = {
  rows: number;
  cols: number;
  flowModeGrid: number[][];
  aspectModeKey: SerializedGradiatorState["aspect"];
  grid: GradientPoint[][];
  animations: PointAnimationPath[];
  roundValue: (value: number) => number;
};

export type RestoredGradiatorState = {
  rows: number;
  cols: number;
  flowModeIndex: number | null;
  flowModeGrid: number[][] | null;
  aspectModeKey: string | null;
  grid: GradientPoint[][];
  animations: PointAnimationPath[];
};

function isAnimationEasing(value: unknown): value is AnimationEasing {
  return value === "linear" || value === "ease-in" || value === "ease-out" || value === "ease-in-out";
}

export function serializeGradiatorState({
  rows,
  cols,
  flowModeGrid,
  aspectModeKey,
  grid,
  animations,
  roundValue,
}: SerializeGradiatorStateInput) {
  return encodeUrlState({
    v: 4,
    rows,
    cols,
    flow: flowModeGrid[0]?.[0] ?? 0,
    flows: flowModeGrid.flatMap((row) => row.map((modeIndex) => Math.round(modeIndex))),
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
    animations: animations.map((animation) => ({
      id: animation.id,
      row: animation.point.row,
      col: animation.point.col,
      duration: Math.round(animation.durationMs),
      easing: animation.easing,
      points: animation.points.flatMap((point) => [roundValue(point.x), roundValue(point.y)]),
    })),
  } satisfies SerializedGradiatorState);
}

export function parseGradiatorState(encoded: string): RestoredGradiatorState | null {
  const state = decodeUrlState(encoded);
  const rows = state?.rows;
  const cols = state?.cols;
  const points = state?.points;
  const flowCount = Math.max(0, (rows ?? 0) - 1) * Math.max(0, (cols ?? 0) - 1);
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

  let flowModeGrid: number[][] | null = null;
  if (Array.isArray(state?.flows) && state.flows.length === flowCount) {
    flowModeGrid = [];
    let flowIndex = 0;
    for (let row = 0; row < rows - 1; row++) {
      const nextRow: number[] = [];
      for (let col = 0; col < cols - 1; col++) {
        const value = state.flows[flowIndex++];
        nextRow.push(Number.isFinite(value) ? Math.round(value) : 0);
      }
      flowModeGrid.push(nextRow);
    }
  }

  const animations = parseAnimations(state?.animations, rows, cols);

  return {
    rows,
    cols,
    flowModeIndex: Number.isInteger(state.flow) ? state.flow : null,
    flowModeGrid,
    aspectModeKey: typeof state?.aspect === "string" ? state.aspect : null,
    grid,
    animations,
  };
}

function parseAnimations(value: unknown, rows: number, cols: number) {
  if (!Array.isArray(value)) return [];

  const animations: PointAnimationPath[] = [];
  for (let index = 0; index < value.length; index++) {
    const raw = value[index] as Partial<SerializedPointAnimationPath>;
    if (!raw || typeof raw !== "object") continue;
    if (!Number.isInteger(raw.row) || !Number.isInteger(raw.col)) continue;
    if (raw.row < 0 || raw.row >= rows || raw.col < 0 || raw.col >= cols) continue;
    if (!Array.isArray(raw.points) || raw.points.length < 4 || raw.points.length % 2 !== 0) continue;
    if (!isAnimationEasing(raw.easing)) continue;

    const points = [];
    let validPoints = true;
    for (let pointIndex = 0; pointIndex < raw.points.length; pointIndex += 2) {
      const x = raw.points[pointIndex];
      const y = raw.points[pointIndex + 1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        validPoints = false;
        break;
      }
      points.push({ x: clamp(x, -1, 1), y: clamp(y, -1, 1) });
    }
    if (!validPoints) continue;

    animations.push({
      id: typeof raw.id === "string" && raw.id ? raw.id : `path-${index + 1}`,
      point: { row: raw.row, col: raw.col },
      points,
      durationMs: clamp(Number(raw.duration) || 2400, 500, 12000),
      easing: raw.easing,
    });
  }

  return animations;
}

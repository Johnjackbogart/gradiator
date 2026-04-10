import { bilerp, mixPoint } from "../../utils/interpolation.js";
import { catmullRom, clamp } from "../../utils/math.js";
import type { GradientPoint } from "../types";

type ColorSample = {
  r: number;
  g: number;
  b: number;
};

export function sampleInterpolatedField(grid: GradientPoint[][], u: number, v: number, blend: number) {
  const linear = sampleLinearField(grid, u, v);
  const smooth = sampleSmoothField(grid, u, v);
  return mixPoint(linear, smooth, blend);
}

export function sampleLinearField(grid: GradientPoint[][], u: number, v: number) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const x = clamp(u * (cols - 1), 0, cols - 1);
  const y = clamp(v * (rows - 1), 0, rows - 1);
  const pointCol = clamp(Math.floor(x), 0, cols - 2);
  const pointRow = clamp(Math.floor(y), 0, rows - 2);
  const localU = x - pointCol;
  const localV = y - pointRow;

  return bilerp(
    grid[pointRow][pointCol],
    grid[pointRow][pointCol + 1],
    grid[pointRow + 1][pointCol],
    grid[pointRow + 1][pointCol + 1],
    localU,
    localV,
  );
}

export function sampleSmoothField(grid: GradientPoint[][], u: number, v: number) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const x = clamp(u * (cols - 1), 0, cols - 1);
  const y = clamp(v * (rows - 1), 0, rows - 1);
  const pointCol = clamp(Math.floor(x), 0, cols - 2);
  const pointRow = clamp(Math.floor(y), 0, rows - 2);
  const localU = x - pointCol;
  const localV = y - pointRow;

  const samplePoint = (row: number, col: number) => {
    const safeRow = clamp(row, 0, rows - 1);
    const safeCol = clamp(col, 0, cols - 1);
    return grid[safeRow][safeCol];
  };

  const cubicBlend = (key: keyof GradientPoint) => {
    const blendedRows = [];
    for (let row = -1; row <= 2; row++) {
      const p0 = samplePoint(pointRow + row, pointCol - 1)[key];
      const p1 = samplePoint(pointRow + row, pointCol)[key];
      const p2 = samplePoint(pointRow + row, pointCol + 1)[key];
      const p3 = samplePoint(pointRow + row, pointCol + 2)[key];
      blendedRows.push(catmullRom(p0, p1, p2, p3, localU));
    }
    return catmullRom(blendedRows[0], blendedRows[1], blendedRows[2], blendedRows[3], localV);
  };

  return {
    x: clamp(cubicBlend("x"), 0, 1),
    y: clamp(cubicBlend("y"), 0, 1),
    r: clamp(cubicBlend("r"), 0, 1),
    g: clamp(cubicBlend("g"), 0, 1),
    b: clamp(cubicBlend("b"), 0, 1),
  };
}

export function sampleTensorDirection(
  sampleColor: (u: number, v: number) => ColorSample,
  u: number,
  v: number,
  orthogonal = false,
) {
  const epsilon = 0.014;
  const left = sampleColor(clamp(u - epsilon, 0, 1), v);
  const right = sampleColor(clamp(u + epsilon, 0, 1), v);
  const top = sampleColor(u, clamp(v - epsilon, 0, 1));
  const bottom = sampleColor(u, clamp(v + epsilon, 0, 1));

  const dxr = right.r - left.r;
  const dxg = right.g - left.g;
  const dxb = right.b - left.b;
  const dyr = bottom.r - top.r;
  const dyg = bottom.g - top.g;
  const dyb = bottom.b - top.b;

  const a = dxr * dxr + dxg * dxg + dxb * dxb;
  const b = dxr * dyr + dxg * dyg + dxb * dyb;
  const c = dyr * dyr + dyg * dyg + dyb * dyb;
  if (a + c < 1e-5) return null;

  const angle = 0.5 * Math.atan2(2 * b, a - c);
  let du = Math.cos(angle);
  let dv = Math.sin(angle);
  if (orthogonal) [du, dv] = [-dv, du];
  return { du, dv };
}

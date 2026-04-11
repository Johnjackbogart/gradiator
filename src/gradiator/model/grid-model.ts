import { bilerp, inverseBilinear } from "../../utils/interpolation.js";
import { clamp, lerp } from "../../utils/math.js";
import type { GradientPoint, GridAreaIndex, GridIndex, Point2D } from "../types";

type GridColorSample = {
  r: number;
  g: number;
  b: number;
};

type AddGridPointOptions = {
  grid: GradientPoint[][];
  x: number;
  y: number;
  width: number;
  height: number;
  sampleColor: (u: number, v: number) => GridColorSample;
};

export type AddGridPointResult = {
  insertedPoint: GridIndex;
  splitCell: GridAreaIndex;
};

type GridCellHit = {
  row: number;
  col: number;
  u: number;
  v: number;
  error: number;
  tl: GradientPoint;
  tr: GradientPoint;
  bl: GradientPoint;
  br: GradientPoint;
};

const DEFAULT_GRAYSCALE_STOPS = [0.04, 0.16, 0.32, 0.48, 0.64, 0.8, 0.96];

export function createInitialGrid(rows: number, cols: number, grayscaleStops = DEFAULT_GRAYSCALE_STOPS) {
  const grid: GradientPoint[][] = [];

  for (let row = 0; row < rows; row++) {
    const nextRow: GradientPoint[] = [];
    for (let col = 0; col < cols; col++) {
      const u = col / (cols - 1);
      const v = row / (rows - 1);
      const shade = grayscaleStops[Math.floor(Math.random() * grayscaleStops.length)];
      nextRow.push({ x: u, y: v, r: shade, g: shade, b: shade });
    }
    grid.push(nextRow);
  }

  return grid;
}

export function getGridPoint(grid: GradientPoint[][], row: number, col: number) {
  return grid[row][col];
}

export function averageGridColumn(grid: GradientPoint[][], col: number): Point2D {
  let x = 0;
  let y = 0;

  for (let row = 0; row < grid.length; row++) {
    x += grid[row][col].x;
    y += grid[row][col].y;
  }

  return { x: x / grid.length, y: y / grid.length };
}

export function insertGridRow(grid: GradientPoint[][], afterRow: number, t = 0.5) {
  const cols = grid[0]?.length ?? 0;
  const newRow: GradientPoint[] = [];

  for (let col = 0; col < cols; col++) {
    const a = grid[afterRow][col];
    const b = grid[afterRow + 1][col];
    newRow.push({
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      r: lerp(a.r, b.r, t),
      g: lerp(a.g, b.g, t),
      b: lerp(a.b, b.b, t),
    });
  }

  grid.splice(afterRow + 1, 0, newRow);
}

export function insertGridCol(grid: GradientPoint[][], afterCol: number, t = 0.5) {
  for (let row = 0; row < grid.length; row++) {
    const a = grid[row][afterCol];
    const b = grid[row][afterCol + 1];
    grid[row].splice(afterCol + 1, 0, {
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      r: lerp(a.r, b.r, t),
      g: lerp(a.g, b.g, t),
      b: lerp(a.b, b.b, t),
    });
  }
}

export function removeGridPoint(grid: GradientPoint[][], row: number, col: number) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  if (rows <= 2 || cols <= 2) return false;

  grid.splice(row, 1);
  for (let r = 0; r < grid.length; r++) {
    grid[r].splice(col, 1);
  }

  return true;
}

export function findGridPointAt(
  grid: GradientPoint[][],
  width: number,
  height: number,
  mx: number,
  my: number,
  radius = 14,
): GridIndex | null {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isCorner = (row === 0 || row === rows - 1) && (col === 0 || col === cols - 1);
      const isEdge = !isCorner && (row === 0 || row === rows - 1 || col === 0 || col === cols - 1);
      const hitRadius = isCorner ? radius + 10 : isEdge ? radius + 5 : radius;
      const dx = mx - grid[row][col].x * width;
      const dy = my - grid[row][col].y * height;
      if (dx * dx + dy * dy < hitRadius * hitRadius) return { row, col };
    }
  }

  return null;
}

export function addGridPointAt({
  grid,
  x,
  y,
  width,
  height,
  sampleColor,
}: AddGridPointOptions): AddGridPointResult | null {
  const u = x / width;
  const v = y / height;
  const cell = findGridCellAt(grid, u, v);
  if (!cell) return null;

  const color = sampleColor(u, v);
  const inset = 0.06;
  const rowT = clamp(cell.v, inset, 1 - inset);
  const colT = clamp(cell.u, inset, 1 - inset);
  const insertedPoint = bilerp(cell.tl, cell.tr, cell.bl, cell.br, colT, rowT);

  insertGridRow(grid, cell.row, rowT);
  insertGridCol(grid, cell.col, colT);

  const insertedRow = cell.row + 1;
  const insertedCol = cell.col + 1;
  grid[insertedRow][insertedCol] = {
    x: insertedPoint.x,
    y: insertedPoint.y,
    r: color.r,
    g: color.g,
    b: color.b,
  };

  return {
    insertedPoint: { row: insertedRow, col: insertedCol },
    splitCell: { row: cell.row, col: cell.col },
  };
}

function findGridCellAt(grid: GradientPoint[][], u: number, v: number): GridCellHit | null {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let best: GridCellHit | null = null;
  const target = { x: u, y: v };
  const tolerance = 0.0012;

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const tl = getGridPoint(grid, row, col);
      const tr = getGridPoint(grid, row, col + 1);
      const bl = getGridPoint(grid, row + 1, col);
      const br = getGridPoint(grid, row + 1, col + 1);
      const local = inverseBilinear(target, tl, tr, bl, br);
      const inside =
        local.u >= -tolerance &&
        local.u <= 1 + tolerance &&
        local.v >= -tolerance &&
        local.v <= 1 + tolerance;
      if (!inside) continue;
      if (!best || local.error < best.error) {
        best = { row, col, ...local, tl, tr, bl, br };
      }
    }
  }

  return best;
}

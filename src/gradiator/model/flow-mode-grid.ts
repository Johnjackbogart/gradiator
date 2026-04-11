import { clamp } from "../../utils/math.js";
import type { GridAreaIndex } from "../types";

export function createFlowModeGrid(rows: number, cols: number, modeIndex: number) {
  const areaRows = Math.max(0, rows - 1);
  const areaCols = Math.max(0, cols - 1);
  return Array.from({ length: areaRows }, () => Array.from({ length: areaCols }, () => modeIndex));
}

export function fillFlowModeGrid(flowModeGrid: number[][], modeIndex: number) {
  for (let row = 0; row < flowModeGrid.length; row++) {
    flowModeGrid[row].fill(modeIndex);
  }
}

export function normalizeFlowModeGrid(
  flowModeGrid: number[][] | null | undefined,
  rows: number,
  cols: number,
  fallbackModeIndex: number,
  maxModeIndex: number,
) {
  const areaRows = Math.max(0, rows - 1);
  const areaCols = Math.max(0, cols - 1);

  return Array.from({ length: areaRows }, (_, row) =>
    Array.from({ length: areaCols }, (_, col) => {
      const value = flowModeGrid?.[row]?.[col];
      if (!Number.isInteger(value)) return fallbackModeIndex;
      return clamp(Number(value), 0, maxModeIndex);
    }),
  );
}

export function getFlowAreaIndex(rows: number, cols: number, u: number, v: number): GridAreaIndex | null {
  if (rows < 2 || cols < 2) return null;
  const areaCol = clamp(Math.floor(u * (cols - 1)), 0, cols - 2);
  const areaRow = clamp(Math.floor(v * (rows - 1)), 0, rows - 2);
  return { row: areaRow, col: areaCol };
}

export function getFlowModeIndexAt(
  flowModeGrid: number[][],
  rows: number,
  cols: number,
  u: number,
  v: number,
  fallbackModeIndex: number,
) {
  const area = getFlowAreaIndex(rows, cols, u, v);
  if (!area) return fallbackModeIndex;
  return flowModeGrid[area.row]?.[area.col] ?? fallbackModeIndex;
}

export function splitFlowModeGrid(flowModeGrid: number[][], splitRow: number, splitCol: number, fallbackModeIndex: number) {
  const areaRows = flowModeGrid.length;
  const areaCols = flowModeGrid[0]?.length ?? 0;
  const next = Array.from({ length: areaRows + 1 }, () =>
    Array.from({ length: areaCols + 1 }, () => fallbackModeIndex),
  );

  for (let row = 0; row < areaRows; row++) {
    for (let col = 0; col < areaCols; col++) {
      const value = flowModeGrid[row][col] ?? fallbackModeIndex;
      const targetRows = row < splitRow ? [row] : row > splitRow ? [row + 1] : [row, row + 1];
      const targetCols = col < splitCol ? [col] : col > splitCol ? [col + 1] : [col, col + 1];

      for (const targetRow of targetRows) {
        for (const targetCol of targetCols) next[targetRow][targetCol] = value;
      }
    }
  }

  return next;
}

export function collapseFlowModeGridForPointRemoval(
  flowModeGrid: number[][],
  removedRow: number,
  removedCol: number,
  fallbackModeIndex: number,
) {
  const areaRows = Math.max(0, flowModeGrid.length - 1);
  const areaCols = Math.max(0, (flowModeGrid[0]?.length ?? 0) - 1);
  if (!areaRows || !areaCols) return [];

  return Array.from({ length: areaRows }, (_, row) =>
    Array.from({ length: areaCols }, (_, col) => {
      const sourceRow = row < removedRow ? row : row + 1;
      const sourceCol = col < removedCol ? col : col + 1;
      return flowModeGrid[sourceRow]?.[sourceCol] ?? fallbackModeIndex;
    }),
  );
}

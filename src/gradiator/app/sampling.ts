import {
  buildFlowGridLines as buildFlowGridLinesFromEngine,
  buildFlowRuntime as buildFlowRuntimeFromEngine,
  sampleFieldForMode,
  sampleFlowDirectionForMode,
  sampleFlowSource as sampleFlowSourceFromEngine,
  sampleModeVector as sampleModeVectorFromEngine,
  traceFlowLine as traceFlowLineFromEngine,
} from "../flow-engine";
import {
  sampleInterpolatedField as sampleInterpolatedFieldFromGrid,
  sampleLinearField as sampleLinearFieldFromGrid,
  sampleSmoothField as sampleSmoothFieldFromGrid,
  sampleTensorDirection as sampleTensorDirectionFromSampler,
} from "../model/field-sampler";
import { getFlowAreaIndex } from "../model/flow-mode-grid";
import type { FlowRuntime, GridAreaIndex } from "../types";
import type { AppConstructor } from "./mixin";

export function withSampling<TBase extends AppConstructor<any>>(Base: TBase) {
  return class GradiatorSamplingApp extends Base {
    buildFlowRuntimeGrid(grid = this.getDisplayGrid()) {
      const runtimes: FlowRuntime[][] = [];

      for (let row = 0; row < this.ROWS - 1; row++) {
        const runtimeRow: FlowRuntime[] = [];
        for (let col = 0; col < this.COLS - 1; col++) {
          runtimeRow.push(
            buildFlowRuntimeFromEngine([
              [grid[row][col], grid[row][col + 1]],
              [grid[row + 1][col], grid[row + 1][col + 1]],
            ]),
          );
        }
        runtimes.push(runtimeRow);
      }

      return runtimes;
    }

    getFlowRuntime(row: number, col: number) {
      const grid = this.getDisplayGrid();
      return this.flowRuntimeGrid[row]?.[col] ?? buildFlowRuntimeFromEngine(grid);
    }

    getAreaAtPosition(u: number, v: number) {
      return getFlowAreaIndex(this.ROWS, this.COLS, u, v);
    }

    getAreaBounds(area: GridAreaIndex) {
      return {
        uMin: area.col / (this.COLS - 1),
        uMax: (area.col + 1) / (this.COLS - 1),
        vMin: area.row / (this.ROWS - 1),
        vMax: (area.row + 1) / (this.ROWS - 1),
      };
    }

    sampleInterpolatedField(u, v, blend) {
      return sampleInterpolatedFieldFromGrid(this.getDisplayGrid(), u, v, blend);
    }

    sampleModeVector(field, u, v, area: GridAreaIndex | null = this.getAreaAtPosition(u, v)) {
      if (!field || !area) return null;
      return sampleModeVectorFromEngine(this.getFlowRuntime(area.row, area.col), field, u, v);
    }

    sampleFlowSource(u, v, mode, area: GridAreaIndex | null = this.getAreaAtPosition(u, v)) {
      if (!area) return { u, v };
      return sampleFlowSourceFromEngine(
        mode,
        u,
        v,
        (sampleU, sampleV) => this.sampleModeVector(mode.field, sampleU, sampleV, area),
        this.getAreaBounds(area),
      );
    }

    sampleField(u, v) {
      const area = this.getAreaAtPosition(u, v);
      if (!area) return this.sampleInterpolatedField(u, v, this.getFlowMode(this.defaultFlowModeIndex).blend);

      const mode = this.getAreaFlowMode(area.row, area.col);
      return sampleFieldForMode({
        mode,
        u,
        v,
        bounds: this.getAreaBounds(area),
        sampleInterpolatedField: (sampleU, sampleV, blend) =>
          this.sampleInterpolatedField(sampleU, sampleV, blend),
        sampleModeVector: (sampleU, sampleV) => this.sampleModeVector(mode.field, sampleU, sampleV, area),
      });
    }

    sampleLinearField(u, v) {
      return sampleLinearFieldFromGrid(this.getDisplayGrid(), u, v);
    }

    sampleSmoothField(u, v) {
      return sampleSmoothFieldFromGrid(this.getDisplayGrid(), u, v);
    }

    sampleColor(u, v) {
      const p = this.sampleField(u, v);
      return { r: p.r, g: p.g, b: p.b };
    }

    sampleTensorDirection(u, v, orthogonal = false) {
      return sampleTensorDirectionFromSampler(
        (sampleU, sampleV) => this.sampleColor(sampleU, sampleV),
        u,
        v,
        orthogonal,
      );
    }

    sampleFlowDirection(u, v, orthogonal = false) {
      const area = this.getAreaAtPosition(u, v);
      const mode = area ? this.getAreaFlowMode(area.row, area.col) : this.getFlowMode(this.defaultFlowModeIndex);
      return sampleFlowDirectionForMode({
        mode,
        u,
        v,
        orthogonal,
        sampleModeVector: (sampleU, sampleV) => this.sampleModeVector(mode.field, sampleU, sampleV, area),
        sampleTensorDirection: (sampleU, sampleV, isOrthogonal = false) =>
          this.sampleTensorDirection(sampleU, sampleV, isOrthogonal),
      });
    }

    traceFlowLine(seedU, seedV, orthogonal = false, stepSize = 0.012, maxSteps = 120) {
      return traceFlowLineFromEngine(seedU, seedV, {
        orthogonal,
        stepSize,
        maxSteps,
        sampleField: (sampleU, sampleV) => this.sampleField(sampleU, sampleV),
        sampleFlowDirection: (sampleU, sampleV, isOrthogonal = false) =>
          this.sampleFlowDirection(sampleU, sampleV, isOrthogonal),
      });
    }

    buildFlowGridLines() {
      return buildFlowGridLinesFromEngine({
        interactionMode: Boolean(this.dragging),
        sampleField: (sampleU, sampleV) => this.sampleField(sampleU, sampleV),
        sampleFlowDirection: (sampleU, sampleV, orthogonal = false) =>
          this.sampleFlowDirection(sampleU, sampleV, orthogonal),
      });
    }

    getFlowGridLines() {
      if (this.animatePoints) return this.buildFlowGridLines();

      const stateKey = `${this.serializeState()}|${this.W}|${this.H}|${this.dragging ? "drag" : "idle"}`;
      if (!this.flowGridCache || this.flowGridCache.key !== stateKey) {
        this.flowGridCache = { key: stateKey, lines: this.buildFlowGridLines() };
      }
      return this.flowGridCache.lines;
    }
  };
}

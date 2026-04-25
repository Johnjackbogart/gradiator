import { clamp } from "../../utils/math.js";
import {
  collapseFlowModeGridForPointRemoval,
  fillFlowModeGrid,
  normalizeFlowModeGrid,
  splitFlowModeGrid,
} from "../model/flow-mode-grid";
import { addGridPointAt, getGridPoint, removeGridPoint } from "../model/grid-model";
import { parseGradiatorState, serializeGradiatorState } from "../state-persistence";
import type { AppConstructor } from "./mixin";

export function withState<TBase extends AppConstructor<any>>(Base: TBase) {
  return class GradiatorStateApp extends Base {
    setDefaultFlowMode(index) {
      const safeIndex = clamp(index, 0, this.flowModes.length - 1);
      this.defaultFlowModeIndex = safeIndex;
      const mode = this.flowModes[this.defaultFlowModeIndex];
      if (this.flowButton) this.flowButton.textContent = `Flow All: ${mode.label}`;
    }

    applyFlowModeToAll(index) {
      this.setDefaultFlowMode(index);
      fillFlowModeGrid(this.flowModeGrid, this.defaultFlowModeIndex);
      this.updateAreaFlowMenuButtons();
    }

    getFlowMode(index) {
      const safeIndex = clamp(index, 0, this.flowModes.length - 1);
      return this.flowModes[safeIndex] || this.flowModes[0];
    }

    getAreaFlowModeIndex(row: number, col: number) {
      return this.flowModeGrid[row]?.[col] ?? this.defaultFlowModeIndex;
    }

    getAreaFlowMode(row: number, col: number) {
      return this.getFlowMode(this.getAreaFlowModeIndex(row, col));
    }

    currentAspectMode() {
      return this.aspectModes[this.aspectModeIndex] || this.aspectModes[this.aspectModes.length - 1];
    }

    applyAspectMode(index, shouldResize = false) {
      const safeIndex = clamp(index, 0, this.aspectModes.length - 1);
      this.aspectModeIndex = safeIndex;
      const mode = this.currentAspectMode();
      if (this.aspectButton) this.aspectButton.textContent = `Aspect: ${mode.label}`;
      if (shouldResize) this.resize();
    }

    cycleAspectMode() {
      this.applyAspectMode((this.aspectModeIndex + 1) % this.aspectModes.length, true);
    }

    findAspectModeIndex(key) {
      return this.aspectModes.findIndex((mode) => mode.key === key);
    }

    getCurrentAspectRatio() {
      const mode = this.currentAspectMode();
      if (mode.ratio !== null) return mode.ratio;
      const width = Math.max(1, this.container.clientWidth || window.innerWidth || 1);
      const height = Math.max(1, this.container.clientHeight || window.innerHeight || 1);
      return width / height;
    }

    roundStateValue(value) {
      return Number(value.toFixed(4));
    }

    serializeState() {
      return serializeGradiatorState({
        rows: this.ROWS,
        cols: this.COLS,
        flowModeGrid: this.flowModeGrid,
        aspectModeKey: this.currentAspectMode().key,
        grid: this.grid,
        roundValue: (value) => this.roundStateValue(value),
      });
    }

    syncUrlState() {
      const serialized = this.serializeState();
      if (serialized === this.lastSerializedState) return;
      const url = new URL(window.location.href);
      url.searchParams.set("state", serialized);
      window.history.replaceState(null, "", url);
      this.lastSerializedState = serialized;
    }

    restoreStateFromUrl() {
      const url = new URL(window.location.href);
      const encoded = url.searchParams.get("state");
      if (!encoded) return;
      try {
        const state = parseGradiatorState(encoded);
        if (!state) return;

        this.ROWS = state.rows;
        this.COLS = state.cols;
        this.grid = state.grid;
        this.setDefaultFlowMode(state.flowModeIndex ?? this.defaultFlowModeIndex);
        this.flowModeGrid = normalizeFlowModeGrid(
          state.flowModeGrid,
          this.ROWS,
          this.COLS,
          this.defaultFlowModeIndex,
          this.flowModes.length - 1,
        );
        if (state.aspectModeKey) {
          const aspectModeIndex = this.findAspectModeIndex(state.aspectModeKey);
          if (aspectModeIndex >= 0) this.aspectModeIndex = aspectModeIndex;
        }
        this.updateAreaFlowMenuButtons();
        this.displayGrid = this.grid;
        this.lastSerializedState = encoded;
      } catch (error) {
        console.warn("Failed to restore canvas state from URL", error);
      }
    }

    pt(r, c) {
      return getGridPoint(this.grid, r, c);
    }

    removePointAt(row, col) {
      if (!removeGridPoint(this.grid, row, col)) return false;
      this.flowModeGrid = collapseFlowModeGridForPointRemoval(
        this.flowModeGrid,
        row,
        col,
        this.defaultFlowModeIndex,
      );
      this.syncGridDimensions();
      this.selected = null;
      this.dragging = null;
      this.hovered = null;
      this.hoveredAreaFlowControl = null;
      this.colorPicker.hide();
      this.hideAreaFlowMenu(false);
      this.render();
      return true;
    }

    addPointAt(x, y) {
      const insertedPoint = addGridPointAt({
        grid: this.grid,
        x,
        y,
        width: this.W,
        height: this.H,
        sampleColor: (u, v) => this.sampleColor(u, v),
      });
      if (!insertedPoint) return;
      this.flowModeGrid = splitFlowModeGrid(
        this.flowModeGrid,
        insertedPoint.splitCell.row,
        insertedPoint.splitCell.col,
        this.defaultFlowModeIndex,
      );
      this.syncGridDimensions();
      this.selected = insertedPoint.insertedPoint;
      this.hideAreaFlowMenu(false);
      this.render();
    }
  };
}

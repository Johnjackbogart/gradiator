import { clamp } from "../../utils/math.js";
import {
  collapseFlowModeGridForPointRemoval,
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
        animations: this.pointAnimations,
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
        this.pointAnimations = state.animations;
        this.resetAnimationPathIdCounter();
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
      this.collapseAnimationPathsForRemovedPoint(row, col);
      this.flowModeGrid = collapseFlowModeGridForPointRemoval(
        this.flowModeGrid,
        row,
        col,
        this.defaultFlowModeIndex,
      );
      this.syncGridDimensions();
      this.selected = null;
      this.selectedPoints = [];
      this.dragging = null;
      this.hovered = null;
      this.selectedAnimationPathId = null;
      this.hoveredAnimationPathId = null;
      this.pathDrawingMode = false;
      this.cancelAnimationPathDrawing();
      this.selectedAreaFlowControls = [];
      this.hoveredAreaFlowControl = null;
      this.selectionRect = null;
      this.selectingMode = null;
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
      this.shiftAnimationPathsForInsertedPoint(insertedPoint.insertedPoint.row, insertedPoint.insertedPoint.col);
      this.flowModeGrid = splitFlowModeGrid(
        this.flowModeGrid,
        insertedPoint.splitCell.row,
        insertedPoint.splitCell.col,
        this.defaultFlowModeIndex,
      );
      this.syncGridDimensions();
      this.selected = insertedPoint.insertedPoint;
      this.selectedPoints = [insertedPoint.insertedPoint];
      this.selectedAnimationPathId = null;
      this.pathDrawingMode = false;
      this.selectedAreaFlowControls = [];
      this.hideAreaFlowMenu(false);
      this.updateAnimateButtonState();
      this.updateAnimationToolbarState();
      this.render();
    }
  };
}

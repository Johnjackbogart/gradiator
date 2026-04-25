import { clamp } from "../../utils/math.js";
import type { AnimationEasing, GridIndex, Point2D, PointAnimationPath } from "../types";
import type { AppConstructor } from "./mixin";

const DEFAULT_PATH_DURATION_MS = 2400;
const MIN_PATH_DURATION_MS = 500;
const MAX_PATH_DURATION_MS = 12000;
const MIN_DRAFT_POINT_DISTANCE_PX = 4;
const MIN_FINISHED_PATH_LENGTH_PX = 12;

function isAnimationEasing(value: string): value is AnimationEasing {
  return value === "linear" || value === "ease-in" || value === "ease-out" || value === "ease-in-out";
}

function applyEasing(value: number, easing: AnimationEasing) {
  const t = clamp(value, 0, 1);
  if (easing === "ease-in") return t * t;
  if (easing === "ease-out") return 1 - (1 - t) * (1 - t);
  if (easing === "ease-in-out") {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  return t;
}

function pathLength(points: Point2D[], width = 1, height = 1) {
  let total = 0;
  for (let index = 1; index < points.length; index++) {
    const prev = points[index - 1];
    const next = points[index];
    const dx = (next.x - prev.x) * width;
    const dy = (next.y - prev.y) * height;
    total += Math.hypot(dx, dy);
  }
  return total;
}

function samplePath(points: Point2D[], progress: number) {
  if (!points.length) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const total = pathLength(points);
  if (total <= 0) return points[0];

  const target = clamp(progress, 0, 1) * total;
  let travelled = 0;
  for (let index = 1; index < points.length; index++) {
    const prev = points[index - 1];
    const next = points[index];
    const segmentLength = Math.hypot(next.x - prev.x, next.y - prev.y);
    if (segmentLength <= 0) continue;
    if (travelled + segmentLength >= target) {
      const local = (target - travelled) / segmentLength;
      return {
        x: prev.x + (next.x - prev.x) * local,
        y: prev.y + (next.y - prev.y) * local,
      };
    }
    travelled += segmentLength;
  }

  return points[points.length - 1];
}

export function withAnimation<TBase extends AppConstructor<any>>(Base: TBase) {
  return class GradiatorAnimationApp extends Base {
    getDisplayGrid() {
      return this.displayGrid.length ? this.displayGrid : this.grid;
    }

    getDisplayPoint(row: number, col: number) {
      return this.getDisplayGrid()[row]?.[col] ?? this.grid[row][col];
    }

    isCornerPoint(row: number, col: number) {
      const lastRow = this.ROWS - 1;
      const lastCol = this.COLS - 1;
      return (row === 0 || row === lastRow) && (col === 0 || col === lastCol);
    }

    hasPointAnimations() {
      return this.pointAnimations.length > 0;
    }

    getAnimationPathForPoint(row: number, col: number) {
      return this.pointAnimations.find((path) => path.point.row === row && path.point.col === col) ?? null;
    }

    getSelectedAnimationPath() {
      if (!this.selectedAnimationPathId) return null;
      return this.pointAnimations.find((path) => path.id === this.selectedAnimationPathId) ?? null;
    }

    createAnimationPathId() {
      return `path-${this.nextAnimationPathId++}`;
    }

    resetAnimationPathIdCounter() {
      const maxPathId = this.pointAnimations.reduce((maxId, path) => {
        const match = /^path-(\d+)$/.exec(path.id);
        if (!match) return maxId;
        return Math.max(maxId, Number(match[1]));
      }, 0);
      this.nextAnimationPathId = Math.max(maxPathId + 1, this.pointAnimations.length + 1);
    }

    normalizeDraftPoint(x: number, y: number, point: GridIndex) {
      const basePoint = this.grid[point.row]?.[point.col];
      if (!basePoint || !this.W || !this.H) return { x: 0, y: 0 };
      return {
        x: x / Math.max(1, this.W) - basePoint.x,
        y: y / Math.max(1, this.H) - basePoint.y,
      };
    }

    setPathDrawingMode(enabled: boolean) {
      this.pathDrawingMode = Boolean(enabled && this.selected);
      if (this.pathDrawingMode) {
        this._cancelPickerTimer();
        this.colorPicker.hide();
      }
      if (!this.pathDrawingMode) this.cancelAnimationPathDrawing();
      this.updateAnimateButtonState();
      this.renderOverlay();
    }

    startAnimationPathDrawing(point: GridIndex, x: number, y: number) {
      const basePoint = this.grid[point.row]?.[point.col];
      if (!basePoint) return false;

      this._cancelPickerTimer();
      this.colorPicker.hide();
      this.hideAreaFlowMenu(false);
      this.selected = { row: point.row, col: point.col };
      this.selectedPoints = [{ row: point.row, col: point.col }];
      this.selectedAreaFlowControls = [];
      this.selectedAnimationPathId = this.getAnimationPathForPoint(point.row, point.col)?.id ?? null;
      this.hoveredAnimationPathId = null;
      this.drawingAnimationPathPoint = { row: point.row, col: point.col };
      this.draftAnimationPath = [{ x: 0, y: 0 }];
      this.appendAnimationPathDraftPoint(x, y, true);
      this.ov.style.cursor = "crosshair";
      this.renderOverlay();
      return true;
    }

    appendAnimationPathDraftPoint(x: number, y: number, force = false) {
      if (!this.drawingAnimationPathPoint) return;
      const point = this.normalizeDraftPoint(x, y, this.drawingAnimationPathPoint);
      const lastPoint = this.draftAnimationPath[this.draftAnimationPath.length - 1];
      const dx = (point.x - lastPoint.x) * Math.max(1, this.W);
      const dy = (point.y - lastPoint.y) * Math.max(1, this.H);
      if (!force && Math.hypot(dx, dy) < MIN_DRAFT_POINT_DISTANCE_PX) return;
      this.draftAnimationPath.push(point);
      this.renderOverlay();
    }

    finishAnimationPathDrawing() {
      if (!this.drawingAnimationPathPoint) return;
      const point = this.drawingAnimationPathPoint;
      const draft = this.draftAnimationPath;
      const length = pathLength(draft, this.W, this.H);
      this.drawingAnimationPathPoint = null;
      this.draftAnimationPath = [];
      this.pathDrawingMode = false;

      if (draft.length >= 2 && length >= MIN_FINISHED_PATH_LENGTH_PX) {
        this.upsertPointAnimationPath(point, draft);
        this.setPointAnimationEnabled(true);
        this.render(false);
      } else {
        this.updateAnimateButtonState();
        this.renderOverlay();
      }
    }

    cancelAnimationPathDrawing() {
      if (!this.drawingAnimationPathPoint && !this.draftAnimationPath.length) return;
      this.drawingAnimationPathPoint = null;
      this.draftAnimationPath = [];
      this.renderOverlay();
    }

    upsertPointAnimationPath(point: GridIndex, points: Point2D[]) {
      const existing = this.getAnimationPathForPoint(point.row, point.col);
      const id = existing?.id ?? this.createAnimationPathId();
      const durationMs = existing?.durationMs ?? DEFAULT_PATH_DURATION_MS;
      const easing = existing?.easing ?? "ease-in-out";
      const nextPath: PointAnimationPath = {
        id,
        point: { row: point.row, col: point.col },
        points: points.map((pathPoint) => ({ x: pathPoint.x, y: pathPoint.y })),
        durationMs,
        easing,
      };
      if (existing) {
        const index = this.pointAnimations.findIndex((path) => path.id === existing.id);
        this.pointAnimations.splice(index, 1, nextPath);
      } else {
        this.pointAnimations.push(nextPath);
      }
      this.selectedAnimationPathId = id;
      this.selected = { row: point.row, col: point.col };
      this.selectedPoints = [{ row: point.row, col: point.col }];
      this.selectedAreaFlowControls = [];
      this.updateAnimationToolbarState();
      this.updateExportButtonState();
    }

    selectAnimationPath(id: string | null) {
      const path = id ? this.pointAnimations.find((candidate) => candidate.id === id) : null;
      this.selectedAnimationPathId = path?.id ?? null;
      if (path) {
        this.selected = { row: path.point.row, col: path.point.col };
        this.selectedPoints = [{ row: path.point.row, col: path.point.col }];
        this.selectedAreaFlowControls = [];
        this.hideAreaFlowMenu(false);
        this.colorPicker.hide();
      }
      this.updateAnimationToolbarState();
      this.updateAnimateButtonState();
    }

    clearPointAnimations() {
      this.pointAnimations = [];
      this.selectedAnimationPathId = null;
      this.hoveredAnimationPathId = null;
      this.pathDrawingMode = false;
      this.drawingAnimationPathPoint = null;
      this.draftAnimationPath = [];
      this.animationTimeMs = 0;
      this.setPointAnimationEnabled(false);
      this.updateAnimationToolbarState();
      this.updateExportButtonState();
      this.render(false);
    }

    clearSelectedPointAnimation() {
      const selectedPath = this.getSelectedAnimationPath();
      if (!selectedPath) return;

      this.pointAnimations = this.pointAnimations.filter((path) => path.id !== selectedPath.id);
      this.selectedAnimationPathId = null;
      if (this.hoveredAnimationPathId === selectedPath.id) this.hoveredAnimationPathId = null;
      this.pathDrawingMode = false;
      this.drawingAnimationPathPoint = null;
      this.draftAnimationPath = [];

      if (!this.pointAnimations.length) {
        this.animationTimeMs = 0;
        this.setPointAnimationEnabled(false);
      }

      this.updateAnimationToolbarState();
      this.updateAnimateButtonState();
      this.updateExportButtonState();
      this.render(false);
    }

    shiftAnimationPathsForInsertedPoint(row: number, col: number) {
      for (const path of this.pointAnimations) {
        if (path.point.row >= row) path.point.row += 1;
        if (path.point.col >= col) path.point.col += 1;
      }
      this.updateAnimationSelectionAfterPathMutation();
    }

    collapseAnimationPathsForRemovedPoint(row: number, col: number) {
      this.pointAnimations = this.pointAnimations
        .filter((path) => path.point.row !== row && path.point.col !== col)
        .map((path) => ({
          ...path,
          point: {
            row: path.point.row > row ? path.point.row - 1 : path.point.row,
            col: path.point.col > col ? path.point.col - 1 : path.point.col,
          },
        }));
      this.updateAnimationSelectionAfterPathMutation();
    }

    updateAnimationSelectionAfterPathMutation() {
      if (
        this.selectedAnimationPathId &&
        !this.pointAnimations.some((path) => path.id === this.selectedAnimationPathId)
      ) {
        this.selectedAnimationPathId = null;
      }
      if (!this.pointAnimations.length) {
        this.setPointAnimationEnabled(false);
      }
      this.updateAnimationToolbarState();
      this.updateAnimateButtonState();
      this.updateExportButtonState();
    }

    setSelectedAnimationDuration(durationMs: number) {
      const path = this.getSelectedAnimationPath();
      if (!path) return;
      path.durationMs = clamp(durationMs, MIN_PATH_DURATION_MS, MAX_PATH_DURATION_MS);
      this.updateAnimationToolbarState();
      this.syncUrlState();
    }

    setSelectedAnimationEasing(easing: string) {
      const path = this.getSelectedAnimationPath();
      if (!path || !isAnimationEasing(easing)) return;
      path.easing = easing;
      this.updateAnimationToolbarState();
      this.syncUrlState();
    }

    updateAnimationToolbarState() {
      const hasAnimations = this.hasPointAnimations();
      const selectedPath = this.getSelectedAnimationPath();
      this.animationToolbar.hidden = !hasAnimations;
      this.animationPlayPauseButton.disabled = !hasAnimations || this.isExportingVideo;
      this.animationPlayPauseButton.classList.toggle("active", this.animatePoints);
      this.animationPlayPauseButton.setAttribute("aria-pressed", String(this.animatePoints));
      this.animationPlayPauseButton.textContent = this.animatePoints ? "Pause" : "Play";
      this.animationClearButton.disabled = !hasAnimations || this.isExportingVideo;
      this.animationClearButton.textContent = selectedPath ? "Clear Path" : "Clear All";

      this.animationPathControls.hidden = !selectedPath;
      if (!selectedPath) return;

      this.animationPathLabel.textContent = `Point ${selectedPath.point.row + 1}, ${selectedPath.point.col + 1}`;
      const durationSeconds = selectedPath.durationMs / 1000;
      this.animationDurationInput.value = durationSeconds.toFixed(1);
      this.animationDurationValue.textContent = `${durationSeconds.toFixed(1)}s`;
      this.animationEasingSelect.value = selectedPath.easing;
    }

    updateAnimateButtonState() {
      const hasSelectedPoint = Boolean(this.selected);
      this.animateButton.disabled = this.isExportingVideo || !hasSelectedPoint;
      this.animateButton.classList.toggle("active", this.pathDrawingMode);
      this.animateButton.setAttribute("aria-pressed", String(this.pathDrawingMode));
      if (this.pathDrawingMode) {
        this.animateButton.textContent = "Drawing Path";
      } else {
        this.animateButton.textContent = hasSelectedPoint ? "Draw Path" : "Select Point";
      }
    }

    samplePointAnimationPath(path: PointAnimationPath, timeMs = this.animationTimeMs) {
      const durationMs = clamp(path.durationMs, MIN_PATH_DURATION_MS, MAX_PATH_DURATION_MS);
      const cycleProgress = ((timeMs % durationMs) + durationMs) % durationMs / durationMs;
      const pingPongProgress = cycleProgress <= 0.5 ? cycleProgress * 2 : (1 - cycleProgress) * 2;
      return samplePath(path.points, applyEasing(pingPongProgress, path.easing));
    }

    getPointAnimationOffset(row: number, col: number, timeMs = this.animationTimeMs) {
      const path = this.getAnimationPathForPoint(row, col);
      if (path) {
        return this.samplePointAnimationPath(path, timeMs);
      }

      if (!this.animatePoints || this.isCornerPoint(row, col) || !this.W || !this.H) {
        return { x: 0, y: 0 };
      }

      const horizontalFreedom = col > 0 && col < this.COLS - 1 ? 1 : 0.24;
      const verticalFreedom = row > 0 && row < this.ROWS - 1 ? 1 : 0.24;
      const spanX = this.W / Math.max(1, this.COLS - 1);
      const spanY = this.H / Math.max(1, this.ROWS - 1);
      const amplitudeX = (clamp(spanX * 0.22, 5, 18) * horizontalFreedom) / Math.max(1, this.W);
      const amplitudeY = (clamp(spanY * 0.22, 5, 18) * verticalFreedom) / Math.max(1, this.H);
      const time = timeMs * 0.001;
      const phase = row * 1.73 + col * 2.11;
      const secondaryPhase = row * 2.41 - col * 1.37;
      const speedX = 0.52 + ((row + col) % 5) * 0.07;
      const speedY = 0.64 + ((row * 2 + col) % 4) * 0.06;

      return {
        x:
          amplitudeX *
          (Math.sin(time * speedX * Math.PI * 2 + phase) * 0.7 +
            Math.cos(time * speedX * Math.PI + secondaryPhase) * 0.3),
        y:
          amplitudeY *
          (Math.cos(time * speedY * Math.PI * 2 + secondaryPhase) * 0.7 +
            Math.sin(time * speedY * Math.PI + phase) * 0.3),
      };
    }

    buildAnimatedGrid(timeMs = this.animationTimeMs) {
      return this.grid.map((row, rowIndex) =>
        row.map((point, colIndex) => {
          const offset = this.getPointAnimationOffset(rowIndex, colIndex, timeMs);
          return {
            x: clamp(point.x + offset.x, 0, 1),
            y: clamp(point.y + offset.y, 0, 1),
            r: point.r,
            g: point.g,
            b: point.b,
          };
        }),
      );
    }

    refreshDisplayGrid(timeMs = this.animationTimeMs) {
      this.displayGrid = this.animatePoints || this.hasPointAnimations() ? this.buildAnimatedGrid(timeMs) : this.grid;
    }

    updateExportButtonState() {
      if (this.isExportingVideo) {
        this.exportButton.disabled = true;
        this.animateButton.disabled = true;
        this.animationPlayPauseButton.disabled = true;
        this.animationClearButton.disabled = true;
        this.exportButton.textContent = "Recording Video...";
        return;
      }

      this.exportButton.disabled = false;
      this.exportButton.textContent = this.animatePoints ? "↓ Export Video" : "↓ Export PNG";
      this.updateAnimateButtonState();
      this.updateAnimationToolbarState();
    }

    setPointAnimationEnabled(enabled: boolean) {
      this.animatePoints = Boolean(enabled);
      this.updateExportButtonState();
      this.updateAnimationToolbarState();

      if (this.animatePoints) {
        this.refreshDisplayGrid(this.animationTimeMs);
        if (this.animationFrame === null) {
          this.animationLastFrameMs = performance.now();
          this.animationFrame = window.requestAnimationFrame(this._animatePoints);
        }
      } else {
        if (this.animationFrame !== null) {
          window.cancelAnimationFrame(this.animationFrame);
          this.animationFrame = null;
        }
        this.animationLastFrameMs = null;
        this.refreshDisplayGrid(this.animationTimeMs);
      }
    }

    togglePointAnimation() {
      if (this.isExportingVideo) return;
      this.setPointAnimationEnabled(!this.animatePoints);
      this.render(false, true);
    }

    _animatePoints = (timeMs: number) => {
      if (!this.animatePoints) {
        this.animationFrame = null;
        this.animationLastFrameMs = null;
        return;
      }

      if (this.animationLastFrameMs === null) this.animationLastFrameMs = timeMs;
      const deltaMs = Math.max(0, timeMs - this.animationLastFrameMs);
      this.animationLastFrameMs = timeMs;
      this.animationTimeMs += deltaMs;
      this.render(Boolean(this.dragging || this.drawingAnimationPathPoint), false);
      this.animationFrame = window.requestAnimationFrame(this._animatePoints);
    };
  };
}

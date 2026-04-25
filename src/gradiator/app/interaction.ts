import { clamp } from "../../utils/math.js";
import type { AppConstructor } from "./mixin";

export function withInteraction<TBase extends AppConstructor<any>>(Base: TBase) {
  return class GradiatorInteractionApp extends Base {
    _cancelPickerTimer() {
      if (this.pickerTimer !== null) {
        window.clearTimeout(this.pickerTimer);
        this.pickerTimer = null;
      }
    }

    _onOverlayPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (this.ov.setPointerCapture) {
        try { this.ov.setPointerCapture(e.pointerId); } catch {}
      }
      this._cancelPickerTimer();
      const { x, y } = this.getMousePos(e);
      const areaControl = this.findAreaFlowControlAt(x, y);
      this.didDrag = false;
      this.dragStart = { x, y };
      this.selectionRect = null;
      if (areaControl) {
        this._startCanvasInteractionTracking();
        this.colorPicker.hide();
        this.selected = null;
        this.selectedPoints = [];
        this.selectedAnimationPathId = null;
        this.pathDrawingMode = false;
        this.cancelAnimationPathDrawing();
        this.activeAreaFlowControl = { row: areaControl.row, col: areaControl.col };
        this.selectedAreaFlowControls = [{ row: areaControl.row, col: areaControl.col }];
        this.selectingMode = "areas";
        this.ov.style.cursor = "pointer";
        this.updateAnimateButtonState();
        this.updateAnimationToolbarState();
        this.renderOverlay();
        return;
      }

      this.hideAreaFlowMenu(false);
      if (this.pathDrawingMode && this.selected) {
        if (this.startAnimationPathDrawing(this.selected, x, y)) {
          this._startCanvasInteractionTracking();
        }
        return;
      }

      const hit = this.findPointAt(x, y);
      const animationPath = hit ? null : this.findAnimationPathAt(x, y);
      if (hit) {
        this.dragging = hit;
        this.selected = hit;
        this.selectedPoints = [hit];
        this.selectedAreaFlowControls = [];
        this.selectedAnimationPathId = this.getAnimationPathForPoint(hit.row, hit.col)?.id ?? null;
        this.dragStart = { x, y };
        this.dragPointerOffset = {
          x: this.getDisplayPoint(hit.row, hit.col).x - x / Math.max(1, this.W),
          y: this.getDisplayPoint(hit.row, hit.col).y - y / Math.max(1, this.H),
        };
        this.ov.style.cursor = "grabbing";
      } else if (animationPath) {
        this.selectAnimationPath(animationPath.id);
        this.selectedAreaFlowControls = [];
        this.selectingMode = null;
        this.colorPicker.hide();
        this.renderOverlay();
        return;
      } else {
        this.selected = null;
        this.selectedPoints = [];
        this.selectedAreaFlowControls = [];
        this.selectedAnimationPathId = null;
        this.pathDrawingMode = false;
        this.selectingMode = this.showPoints || this.showGradientTypes ? "points" : null;
        this.colorPicker.hide();
      }
      this.updateAnimateButtonState();
      this.updateAnimationToolbarState();
      if (this.dragging || this.selectingMode) this._startCanvasInteractionTracking();
      this.renderOverlay();
    };

    _onOverlayPointerMove = (e: PointerEvent) => {
      if (e.currentTarget === this.ov && (this.dragging || this.selectingMode || this.drawingAnimationPathPoint)) return;
      const { x, y } =
        this.dragging || this.selectingMode || this.drawingAnimationPathPoint
          ? this.getClampedMousePos(e)
          : this.getMousePos(e);
      if (this.drawingAnimationPathPoint) {
        this.appendAnimationPathDraftPoint(x, y);
      } else if (this.dragging && this.dragPointerOffset && this.dragStart) {
        const draggedPoint = this.grid[this.dragging.row][this.dragging.col];
        const targetX = x / Math.max(1, this.W) + this.dragPointerOffset.x;
        const targetY = y / Math.max(1, this.H) + this.dragPointerOffset.y;
        const animationOffset = this.getPointAnimationOffset(
          this.dragging.row,
          this.dragging.col,
          this.animationTimeMs,
        );
        const dx = x - this.dragStart.x;
        const dy = y - this.dragStart.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.didDrag = true;
        draggedPoint.x = clamp(targetX - animationOffset.x, 0, 1);
        draggedPoint.y = clamp(targetY - animationOffset.y, 0, 1);
        this.render(true, false);
      } else if (this.selectingMode && this.dragStart) {
        const dx = x - this.dragStart.x;
        const dy = y - this.dragStart.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.didDrag = true;
        if (this.didDrag) {
          this.selectionRect = {
            startX: this.dragStart.x,
            startY: this.dragStart.y,
            endX: x,
            endY: y,
          };
          this._updateSelectionFromRect();
          this.renderOverlay();
        }
      } else {
        const areaControl = this.findAreaFlowControlAt(x, y);
        const hoveredPoint = areaControl ? null : this.findPointAt(x, y);
        const hoveredPath = areaControl || hoveredPoint ? null : this.findAnimationPathAt(x, y);
        const samePoint =
          (!hoveredPoint && !this.hovered) ||
          (Boolean(hoveredPoint) &&
            Boolean(this.hovered) &&
            hoveredPoint?.row === this.hovered?.row &&
            hoveredPoint?.col === this.hovered?.col);
        const nextHoveredArea = areaControl ? { row: areaControl.row, col: areaControl.col } : null;
        const sameArea =
          (!nextHoveredArea && !this.hoveredAreaFlowControl) ||
          (Boolean(nextHoveredArea) &&
            Boolean(this.hoveredAreaFlowControl) &&
            nextHoveredArea?.row === this.hoveredAreaFlowControl?.row &&
            nextHoveredArea?.col === this.hoveredAreaFlowControl?.col);
        const nextHoveredPathId = hoveredPath?.id ?? null;
        const samePath = nextHoveredPathId === this.hoveredAnimationPathId;

        if (!samePoint || !sameArea || !samePath) {
          this.hovered = hoveredPoint;
          this.hoveredAreaFlowControl = nextHoveredArea;
          this.hoveredAnimationPathId = nextHoveredPathId;
          this.ov.style.cursor = areaControl
            ? "pointer"
            : hoveredPoint
              ? "grab"
              : hoveredPath
                ? "pointer"
                : "crosshair";
          this.renderOverlay();
        }
      }
    };

    _onWindowPointerMove = (e: PointerEvent) => {
      if (!this.dragging && !this.selectingMode && !this.drawingAnimationPathPoint) return;
      this._onOverlayPointerMove(e);
    };

    _onWindowPointerUp = () => {
      if (!this.dragging && !this.selectingMode && !this.drawingAnimationPathPoint) return;
      this._onOverlayPointerUp();
    };

    _onOverlayPointerUp = () => {
      if (this.drawingAnimationPathPoint) {
        this.finishAnimationPathDrawing();
        this._stopCanvasInteractionTracking();
        this.ov.style.cursor = this.hoveredAreaFlowControl
          ? "pointer"
          : this.hovered
            ? "grab"
            : this.hoveredAnimationPathId
              ? "pointer"
              : "crosshair";
        return;
      }

      if (this.selectingMode) {
        if (this.didDrag && this.selectionRect) {
          this._updateSelectionFromRect();
          if (this.selectedAreaFlowControls.length) {
            const firstArea = this.selectedAreaFlowControls[0];
            const control = this.areaFlowControls.find(
              (area) => area.row === firstArea.row && area.col === firstArea.col,
            );
            if (control) this.showAreaFlowMenu(control);
            if (this.selectedPoints.length) this.openPickerForPointSelection();
          } else if (this.selectedPoints.length) {
            this.hideAreaFlowMenu(false);
            this.openPickerForPointSelection();
          } else {
            this.hideAreaFlowMenu(false);
            this.colorPicker.hide();
          }
        } else if (this.selectingMode === "areas" && this.activeAreaFlowControl) {
          const control = this.areaFlowControls.find(
            (area) =>
              area.row === this.activeAreaFlowControl?.row && area.col === this.activeAreaFlowControl?.col,
          );
          if (control) this.showAreaFlowMenu(control);
        }

        this.selectionRect = null;
        this.selectingMode = null;
        this.dragStart = null;
        this._stopCanvasInteractionTracking();
        this.updateAnimateButtonState();
        this.updateAnimationToolbarState();
        this.ov.style.cursor = this.hoveredAreaFlowControl
          ? "pointer"
          : this.hovered
            ? "grab"
            : this.hoveredAnimationPathId
              ? "pointer"
              : "crosshair";
        this.renderOverlay();
        return;
      }

      if (!this.dragging) return;
      const rc = this.dragging;
      if (!this.didDrag) {
        this.pickerTimer = window.setTimeout(() => {
          this.pickerTimer = null;
          this.openPickerFor(rc);
        }, 220);
      } else {
        this.render(false);
      }
      this.dragging = null;
      this.dragStart = null;
      this.dragPointerOffset = null;
      this._stopCanvasInteractionTracking();
      this.updateAnimateButtonState();
      this.updateAnimationToolbarState();
      this.ov.style.cursor = this.hoveredAreaFlowControl
        ? "pointer"
        : this.hovered
          ? "grab"
          : this.hoveredAnimationPathId
            ? "pointer"
            : "crosshair";
    };

    _onOverlayDoubleClick = (e: PointerEvent) => {
      this._cancelPickerTimer();
      const { x, y } = this.getMousePos(e);
      const areaControl = this.findAreaFlowControlAt(x, y);
      if (areaControl) return;
      const hit = this.findPointAt(x, y);
      if (hit) {
        this.selectedAnimationPathId = this.getAnimationPathForPoint(hit.row, hit.col)?.id ?? null;
        if (e.altKey) {
          this.selected = hit;
          this.selectedPoints = [hit];
          this.selectedAreaFlowControls = [];
          this.openPickerFor(hit);
          this.renderOverlay();
        } else {
          this.removePointAt(hit.row, hit.col);
        }
      } else {
        this.colorPicker.hide();
        this.selected = null;
        this.selectedPoints = [];
        this.selectedAreaFlowControls = [];
        this.selectedAnimationPathId = null;
        this.pathDrawingMode = false;
        this.addPointAt(x, y);
      }
      this.updateAnimateButtonState();
      this.updateAnimationToolbarState();
    };

    _onOverlayPointerLeave = () => {
      this.hovered = null;
      this.hoveredAreaFlowControl = null;
      this.hoveredAnimationPathId = null;
      this.ov.style.cursor = "crosshair";
      this.renderOverlay();
    };

    _onAreaFlowMenuPointerDown = (e: PointerEvent) => {
      e.stopPropagation();
    };

    _onAreaFlowMenuClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest<HTMLButtonElement>("button[data-flow-mode-index]");
      if (!button || !this.activeAreaFlowControl) return;

      const modeIndex = Number(button.dataset.flowModeIndex);
      if (!Number.isInteger(modeIndex)) return;

      this.setAreaFlowMode(this.activeAreaFlowControl.row, this.activeAreaFlowControl.col, modeIndex);
      this.render();
    };

    _onDocumentPointerDown = (e: PointerEvent) => {
      if (this.areaFlowMenu.hidden) return;
      const target = e.target;
      if (target instanceof Node && this.areaFlowMenu.contains(target)) return;
      if (target === this.ov) return;
      this.selectedAreaFlowControls = [];
      this.hideAreaFlowMenu();
    };

    _onDocumentKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this._cancelPickerTimer();
        this._stopPanelDrag();
        this._stopPreviewDrag();
        this.dragStart = null;
        this.dragPointerOffset = null;
        this.dragging = null;
        this.selectionRect = null;
        this.selectingMode = null;
        this.pathDrawingMode = false;
        this.cancelAnimationPathDrawing();
        this._stopCanvasInteractionTracking();
        this.hovered = null;
        this.hoveredAreaFlowControl = null;
        this.hoveredAnimationPathId = null;
        this.colorPicker.hide();
        this.hideAreaFlowMenu(false);
        this.selected = null;
        this.selectedPoints = [];
        this.selectedAreaFlowControls = [];
        this.selectedAnimationPathId = null;
        this.ov.style.cursor = "crosshair";
        if (this.fullView) this.toggleFullView();
        this.updateAnimateButtonState();
        this.updateAnimationToolbarState();
        this.renderOverlay();
      }
    };

    setupEvents() {
      this.ov.addEventListener("pointerdown", this._onOverlayPointerDown);
      this.ov.addEventListener("pointermove", this._onOverlayPointerMove);
      this.ov.addEventListener("pointerup", this._onOverlayPointerUp);
      this.ov.addEventListener("pointercancel", this._onOverlayPointerUp);
      this.ov.addEventListener("dblclick", this._onOverlayDoubleClick);
      this.ov.addEventListener("pointerleave", this._onOverlayPointerLeave);
      this.areaFlowMenu.addEventListener("pointerdown", this._onAreaFlowMenuPointerDown);
      this.areaFlowMenuOptions.addEventListener("click", this._onAreaFlowMenuClick);
      document.addEventListener("pointerdown", this._onDocumentPointerDown);
      document.addEventListener("keydown", this._onDocumentKeyDown);
    }

    _startCanvasInteractionTracking() {
      window.addEventListener("pointermove", this._onWindowPointerMove);
      window.addEventListener("pointerup", this._onWindowPointerUp);
      window.addEventListener("pointercancel", this._onWindowPointerUp);
    }

    _stopCanvasInteractionTracking() {
      window.removeEventListener("pointermove", this._onWindowPointerMove);
      window.removeEventListener("pointerup", this._onWindowPointerUp);
      window.removeEventListener("pointercancel", this._onWindowPointerUp);
    }

    _updateSelectionFromRect() {
      if (!this.selectionRect) return;
      if (this.selectingMode === "points") {
        this.selectedPoints = this._findPointsInRect();
        this.selected = this.selectedPoints[0] ?? null;
        this.selectedAnimationPathId =
          this.selected && this.selectedPoints.length === 1
            ? this.getAnimationPathForPoint(this.selected.row, this.selected.col)?.id ?? null
            : null;
        this.selectedAreaFlowControls = this._findAreaFlowControlsInRect();
        this.activeAreaFlowControl = this.selectedAreaFlowControls[0] ?? null;
      } else if (this.selectingMode === "areas") {
        this.selectedAreaFlowControls = this._findAreaFlowControlsInRect();
        this.activeAreaFlowControl = this.selectedAreaFlowControls[0] ?? null;
        this.selected = null;
        this.selectedPoints = [];
        this.selectedAnimationPathId = null;
      }
    }

    _findPointsInRect() {
      if (!this.selectionRect || !this.showPoints) return [];
      const rect = this._normalizedSelectionRect(12);
      const selected = [];
      const grid = this.getDisplayGrid();
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < (grid[row]?.length ?? 0); col++) {
          const point = grid[row][col];
          const x = point.x * this.W;
          const y = point.y * this.H;
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            selected.push({ row, col });
          }
        }
      }
      return selected;
    }

    _findAreaFlowControlsInRect() {
      if (!this.selectionRect || !this.showGradientTypes) return [];
      const rect = this._normalizedSelectionRect(8);
      return this.areaFlowControls
        .filter(
          (control) =>
            control.x >= rect.left &&
            control.x <= rect.right &&
            control.y >= rect.top &&
            control.y <= rect.bottom,
        )
        .map((control) => ({ row: control.row, col: control.col }));
    }

    _normalizedSelectionRect(padding = 0) {
      const rect = this.selectionRect;
      return {
        left: Math.min(rect.startX, rect.endX) - padding,
        right: Math.max(rect.startX, rect.endX) + padding,
        top: Math.min(rect.startY, rect.endY) - padding,
        bottom: Math.max(rect.startY, rect.endY) + padding,
      };
    }
  };
}

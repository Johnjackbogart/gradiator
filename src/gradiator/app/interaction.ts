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

    _onOverlayMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      this._cancelPickerTimer();
      const { x, y } = this.getMousePos(e);
      const areaControl = this.findAreaFlowControlAt(x, y);
      this.didDrag = false;
      this.dragStart = { x, y };
      this.selectionRect = null;
      if (areaControl) {
        this.colorPicker.hide();
        this.selected = null;
        this.selectedPoints = [];
        this.activeAreaFlowControl = { row: areaControl.row, col: areaControl.col };
        this.selectedAreaFlowControls = [{ row: areaControl.row, col: areaControl.col }];
        this.selectingMode = "areas";
        this.ov.style.cursor = "pointer";
        this.renderOverlay();
        return;
      }

      this.hideAreaFlowMenu(false);
      const hit = this.findPointAt(x, y);
      if (hit) {
        this.dragging = hit;
        this.selected = hit;
        this.selectedPoints = [hit];
        this.selectedAreaFlowControls = [];
        this.dragStart = { x, y };
        this.dragPointerOffset = {
          x: this.getDisplayPoint(hit.row, hit.col).x - x / Math.max(1, this.W),
          y: this.getDisplayPoint(hit.row, hit.col).y - y / Math.max(1, this.H),
        };
        this.ov.style.cursor = "grabbing";
      } else {
        this.selected = null;
        this.selectedPoints = [];
        this.selectedAreaFlowControls = [];
        this.selectingMode = this.showPoints ? "points" : this.showGradientTypes ? "areas" : null;
        this.colorPicker.hide();
      }
      this.renderOverlay();
    };

    _onOverlayMouseMove = (e: MouseEvent) => {
      const { x, y } = this.getMousePos(e);
      if (this.dragging && this.dragPointerOffset && this.dragStart) {
        const draggedPoint = this.grid[this.dragging.row][this.dragging.col];
        const targetX = x / Math.max(1, this.W) + this.dragPointerOffset.x;
        const targetY = y / Math.max(1, this.H) + this.dragPointerOffset.y;
        const animationOffset = this.getPointAnimationOffset(
          this.dragging.row,
          this.dragging.col,
          this.animatePoints ? performance.now() : 0,
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

        if (!samePoint || !sameArea) {
          this.hovered = hoveredPoint;
          this.hoveredAreaFlowControl = nextHoveredArea;
          this.ov.style.cursor = areaControl ? "pointer" : hoveredPoint ? "grab" : "crosshair";
          this.renderOverlay();
        }
      }
    };

    _onOverlayMouseUp = () => {
      if (this.selectingMode) {
        if (this.didDrag && this.selectionRect) {
          this._updateSelectionFromRect();
          if (this.selectingMode === "areas" && this.selectedAreaFlowControls.length) {
            const firstArea = this.selectedAreaFlowControls[0];
            const control = this.areaFlowControls.find(
              (area) => area.row === firstArea.row && area.col === firstArea.col,
            );
            if (control) this.showAreaFlowMenu(control);
          } else if (this.selectingMode === "points" && this.selectedPoints.length) {
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
        this.ov.style.cursor = this.hoveredAreaFlowControl ? "pointer" : this.hovered ? "grab" : "crosshair";
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
      this.ov.style.cursor = this.hoveredAreaFlowControl
        ? "pointer"
        : this.hovered
          ? "grab"
          : "crosshair";
    };

    _onOverlayDoubleClick = (e: MouseEvent) => {
      this._cancelPickerTimer();
      const { x, y } = this.getMousePos(e);
      const areaControl = this.findAreaFlowControlAt(x, y);
      if (areaControl) return;
      const hit = this.findPointAt(x, y);
      if (hit) {
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
        this.addPointAt(x, y);
      }
    };

    _onOverlayMouseLeave = () => {
      if (this.dragging) {
        this.dragging = null;
        this.dragStart = null;
        this.dragPointerOffset = null;
        this.selectionRect = null;
        this.selectingMode = null;
        this.render(false);
      }
      if (this.selectingMode) {
        this.selectionRect = null;
        this.selectingMode = null;
        this.dragStart = null;
        this.renderOverlay();
      }
      this.hovered = null;
      this.hoveredAreaFlowControl = null;
      this.ov.style.cursor = "crosshair";
      this.renderOverlay();
    };

    _onAreaFlowMenuMouseDown = (e: MouseEvent) => {
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

    _onDocumentMouseDown = (e: MouseEvent) => {
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
        this.hovered = null;
        this.hoveredAreaFlowControl = null;
        this.colorPicker.hide();
        this.hideAreaFlowMenu(false);
        this.selected = null;
        this.selectedPoints = [];
        this.selectedAreaFlowControls = [];
        this.ov.style.cursor = "crosshair";
        if (this.fullView) this.toggleFullView();
        this.renderOverlay();
      }
    };

    setupEvents() {
      this.ov.addEventListener("mousedown", this._onOverlayMouseDown);
      this.ov.addEventListener("mousemove", this._onOverlayMouseMove);
      this.ov.addEventListener("mouseup", this._onOverlayMouseUp);
      this.ov.addEventListener("dblclick", this._onOverlayDoubleClick);
      this.ov.addEventListener("mouseleave", this._onOverlayMouseLeave);
      this.areaFlowMenu.addEventListener("mousedown", this._onAreaFlowMenuMouseDown);
      this.areaFlowMenuOptions.addEventListener("click", this._onAreaFlowMenuClick);
      document.addEventListener("mousedown", this._onDocumentMouseDown);
      document.addEventListener("keydown", this._onDocumentKeyDown);
    }

    _updateSelectionFromRect() {
      if (!this.selectionRect) return;
      if (this.selectingMode === "points") {
        this.selectedPoints = this._findPointsInRect();
        this.selected = this.selectedPoints[0] ?? null;
        this.selectedAreaFlowControls = [];
      } else if (this.selectingMode === "areas") {
        this.selectedAreaFlowControls = this._findAreaFlowControlsInRect();
        this.activeAreaFlowControl = this.selectedAreaFlowControls[0] ?? null;
        this.selected = null;
        this.selectedPoints = [];
      }
    }

    _findPointsInRect() {
      if (!this.selectionRect || !this.showPoints) return [];
      const rect = this._normalizedSelectionRect();
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
      const rect = this._normalizedSelectionRect();
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

    _normalizedSelectionRect() {
      const rect = this.selectionRect;
      return {
        left: Math.min(rect.startX, rect.endX),
        right: Math.max(rect.startX, rect.endX),
        top: Math.min(rect.startY, rect.endY),
        bottom: Math.max(rect.startY, rect.endY),
      };
    }
  };
}

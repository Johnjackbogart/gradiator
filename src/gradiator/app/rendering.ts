import { clamp } from "../../utils/math.js";
import { findGridPointAt } from "../model/grid-model";
import {
  buildAreaFlowControls,
  renderGlMesh,
  renderOverlayCanvas,
  renderPreviewCanvas,
} from "../render-engine";
import type { AreaFlowControl } from "../types";
import type { AppConstructor } from "./mixin";

export function withRendering<TBase extends AppConstructor<any>>(Base: TBase) {
  return class GradiatorRenderingApp extends Base {
    render(isDragging = false, syncState = !isDragging) {
      this.refreshDisplayGrid(this.animationTimeMs);
      const displayGrid = this.getDisplayGrid();
      this.flowRuntimeGrid = this.buildFlowRuntimeGrid(displayGrid);
      this.areaFlowControls = buildAreaFlowControls({
        width: this.W,
        height: this.H,
        grid: displayGrid,
        flowModeGrid: this.flowModeGrid,
      });
      let subdivisions = this.SUBS_HI;
      if (isDragging) subdivisions = this.SUBS_LO;
      else if (this.animatePoints && !this.isExportingVideo) subdivisions = 20;
      this.renderGL(subdivisions, displayGrid);
      this.renderPreview();
      this.renderOverlay(displayGrid);

      if (this.activeAreaFlowControl) {
        const activeControl = this.areaFlowControls.find(
          (control) =>
            control.row === this.activeAreaFlowControl?.row && control.col === this.activeAreaFlowControl?.col,
        );
        if (activeControl) this.positionAreaFlowMenu(activeControl);
      }

      if (syncState) this.syncUrlState();
    }

    renderGL(S, grid = this.getDisplayGrid()) {
      renderGlMesh({
        gl: this.gl,
        program: this.prog,
        aPos: this.aPos,
        aCol: this.aCol,
        posBuf: this.posBuf,
        colBuf: this.colBuf,
        width: this.glCanvas.width,
        height: this.glCanvas.height,
        grid,
        subdivisions: S,
        sampleField: (u, v) => this.sampleField(u, v),
      });
    }

    renderOverlay(grid = this.getDisplayGrid()) {
      renderOverlayCanvas({
        ctx: this.ctx,
        width: this.W,
        height: this.H,
        grid,
        showGrid: this.showGrid,
        showPoints: this.showPoints,
        showGradientTypes: this.showGradientTypes,
        flowLines: this.getFlowGridLines(),
        areaFlowControls: this.areaFlowControls,
        activeAreaFlowControl: this.activeAreaFlowControl,
        hoveredAreaFlowControl: this.hoveredAreaFlowControl,
        selectedAreaFlowControls: this.selectedAreaFlowControls,
        selected: this.selected,
        selectedPoints: this.selectedPoints,
        dragging: this.dragging,
        hovered: this.hovered,
        selectionRect: this.selectionRect,
      });
    }

    renderPreview() {
      renderPreviewCanvas({
        ctx: this.previewCtx,
        targetCanvas: this.preview,
        sourceCanvas: this.glCanvas,
      });
    }

    findAreaFlowControlAt(x: number, y: number) {
      if (!this.showGradientTypes) return null;

      for (let index = this.areaFlowControls.length - 1; index >= 0; index--) {
        const control = this.areaFlowControls[index];
        const dx = x - control.x;
        const dy = y - control.y;
        const hitRadius = control.radius + 6;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) return control;
      }

      return null;
    }

    updateAreaFlowMenuButtons() {
      const activeModeIndex = this.activeAreaFlowControl
        ? this.getAreaFlowModeIndex(this.activeAreaFlowControl.row, this.activeAreaFlowControl.col)
        : null;

      const buttons = this.areaFlowMenuOptions.querySelectorAll(
        "button[data-flow-mode-index]",
      ) as NodeListOf<HTMLButtonElement>;
      for (const button of buttons) {
        const modeIndex = Number(button.dataset.flowModeIndex);
        button.classList.toggle("active", modeIndex === activeModeIndex);
      }
    }

    positionAreaFlowMenu(control: AreaFlowControl) {
      this.areaFlowMenu.hidden = false;
      const menuRect = this.areaFlowMenu.getBoundingClientRect();
      const menuWidth = menuRect.width || 180;
      const menuHeight = menuRect.height || 120;
      const multiSelection = this.selectedAreaFlowControls.length > 1 || this.selectedPoints.length > 0;
      const desiredLeft = multiSelection
        ? this.container.clientWidth - menuWidth - 16
        : this.imageStage.offsetLeft + control.x + control.radius + 12;
      const desiredTop = multiSelection
        ? (this.container.clientHeight - menuHeight) / 2
        : this.imageStage.offsetTop + control.y - menuHeight * 0.35;
      const maxLeft = Math.max(0, this.container.clientWidth - menuWidth - 8);
      const maxTop = Math.max(0, this.container.clientHeight - menuHeight - 8);
      const left = maxLeft < 8 ? maxLeft : clamp(desiredLeft, 8, maxLeft);
      const top = maxTop < 8 ? maxTop : clamp(desiredTop, 8, maxTop);

      this.areaFlowMenu.style.left = `${left}px`;
      this.areaFlowMenu.style.top = `${top}px`;
    }

    showAreaFlowMenu(control: AreaFlowControl) {
      this.activeAreaFlowControl = { row: control.row, col: control.col };
      this.areaFlowMenuTitle.textContent = `Area ${control.row + 1}, ${control.col + 1}`;
      this.updateAreaFlowMenuButtons();
      this.positionAreaFlowMenu(control);
      this.renderOverlay();
    }

    hideAreaFlowMenu(shouldRender = true) {
      const hadOpenMenu = !this.areaFlowMenu.hidden || Boolean(this.activeAreaFlowControl);
      this.activeAreaFlowControl = null;
      this.areaFlowMenu.hidden = true;
      if (hadOpenMenu) this.updateAreaFlowMenuButtons();
      if (hadOpenMenu && shouldRender) this.renderOverlay();
    }

    setAreaFlowMode(row: number, col: number, index: number) {
      if (!this.flowModeGrid[row]?.length || this.flowModeGrid[row][col] === undefined) return;
      const safeIndex = clamp(index, 0, this.flowModes.length - 1);
      const areas = this.selectedAreaFlowControls.some((area) => area.row === row && area.col === col)
        ? this.selectedAreaFlowControls
        : [{ row, col }];
      for (const area of areas) {
        if (!this.flowModeGrid[area.row]?.length || this.flowModeGrid[area.row][area.col] === undefined) continue;
        this.flowModeGrid[area.row][area.col] = safeIndex;
      }
      this.updateAreaFlowMenuButtons();
    }

    getImageInset() {
      const inset = parseFloat(getComputedStyle(document.body).getPropertyValue("--image-inset"));
      return Number.isFinite(inset) ? inset : 0;
    }

    layoutImageStage() {
      const containerWidth = Math.max(1, this.container.clientWidth);
      const containerHeight = Math.max(1, this.container.clientHeight);
      const inset = this.getImageInset();
      const availableWidth = Math.max(1, containerWidth - inset * 2);
      const availableHeight = Math.max(1, containerHeight - inset * 2);
      const aspectRatio = this.getCurrentAspectRatio();

      let stageWidth = availableWidth;
      let stageHeight = stageWidth / aspectRatio;

      if (stageHeight > availableHeight) {
        stageHeight = availableHeight;
        stageWidth = stageHeight * aspectRatio;
      }

      const left = (containerWidth - stageWidth) / 2;
      const top = (containerHeight - stageHeight) / 2;

      this.imageStage.style.left = `${left}px`;
      this.imageStage.style.top = `${top}px`;
      this.imageStage.style.width = `${stageWidth}px`;
      this.imageStage.style.height = `${stageHeight}px`;
      this.previewFrame.style.setProperty("--preview-frame-aspect", `${stageWidth} / ${stageHeight}`);
    }

    resize() {
      const container = this.container;
      this.layoutImageStage();
      this.W = this.imageStage.clientWidth;
      this.H = this.imageStage.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      for (const c of [this.glCanvas, this.ov]) {
        c.width = Math.floor(this.W * dpr);
        c.height = Math.floor(this.H * dpr);
        c.style.width = this.W + "px";
        c.style.height = this.H + "px";
      }
      const previewRect = this.previewFrame.getBoundingClientRect();
      const previewCanvasRect = this.preview.getBoundingClientRect();
      this.preview.width = Math.max(1, Math.floor(previewCanvasRect.width * dpr));
      this.preview.height = Math.max(1, Math.floor(previewCanvasRect.height * dpr));
      if (!this.fullView && this.previewFrame.style.left && this.previewFrame.style.top) {
        const left = parseFloat(this.previewFrame.style.left);
        const top = parseFloat(this.previewFrame.style.top);
        const maxLeft = Math.max(0, container.clientWidth - previewRect.width);
        const maxTop = Math.max(0, container.clientHeight - previewRect.height);
        this.previewFrame.style.left = `${clamp(left, 0, maxLeft)}px`;
        this.previewFrame.style.top = `${clamp(top, 0, maxTop)}px`;
      }
      this.clampFloatingPanel(this.uiControls);
      this.clampFloatingPanel(this.toolbar);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.render();
    }

    getMousePos(e) {
      const r = this.ov.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    getClampedMousePos(e) {
      const { x, y } = this.getMousePos(e);
      return {
        x: clamp(x, 0, Math.max(0, this.W)),
        y: clamp(y, 0, Math.max(0, this.H)),
      };
    }

    findPointAt(mx, my, R = 14) {
      if (!this.showPoints) return null;
      return findGridPointAt(this.getDisplayGrid(), this.W, this.H, mx, my, R);
    }

    openPickerFor(rc) {
      this.colorMode = "point";
      if (!this.selectedPoints.some((point) => point.row === rc.row && point.col === rc.col)) {
        this.selectedPoints = [rc];
      }
      const p = this.getDisplayPoint(rc.row, rc.col);
      const basePoint = this.grid[rc.row][rc.col];
      const rect = this.ov.getBoundingClientRect();
      this.colorPicker.show(p.x * this.W + rect.left, p.y * this.H + rect.top, basePoint.r, basePoint.g, basePoint.b);
    }

    openPickerForPointSelection(points = this.selectedPoints) {
      const firstPoint = points[0];
      if (!firstPoint) return;
      this.colorMode = "point";
      const p = this.getDisplayPoint(firstPoint.row, firstPoint.col);
      const basePoint = this.grid[firstPoint.row][firstPoint.col];
      const rect = this.ov.getBoundingClientRect();
      if (points.length > 1 || this.selectedAreaFlowControls.length > 0) {
        this.colorPicker.show(16, window.innerHeight / 2, basePoint.r, basePoint.g, basePoint.b);
      } else {
        this.colorPicker.show(p.x * this.W + rect.left, p.y * this.H + rect.top, basePoint.r, basePoint.g, basePoint.b);
      }
    }

    openGradientPicker() {
      this.colorMode = "all";
      const p = this.sampleField(0.5, 0.5);
      const rect = this.colorButton.getBoundingClientRect();
      this.colorPicker.show(rect.left + rect.width / 2, rect.bottom + 8, p.r, p.g, p.b);
    }
  };
}

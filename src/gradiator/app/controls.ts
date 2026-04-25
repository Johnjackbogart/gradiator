import { hslToRgb } from "../../utils/color.js";
import { colorBilerp } from "../../utils/interpolation.js";
import { clamp } from "../../utils/math.js";
import type { AppConstructor } from "./mixin";

export function withControls<TBase extends AppConstructor<any>>(Base: TBase) {
  return class GradiatorControlsApp extends Base {
    _onGridButtonClick = () => {
      this.setGridVisible(!this.showGrid);
    };

    _onPointsButtonClick = () => {
      this.setPointsVisible(!this.showPoints);
    };

    _onGradientTypesButtonClick = () => {
      this.setGradientTypesVisible(!this.showGradientTypes);
    };

    _onUiMovePointerDown = (e: PointerEvent) => {
      this.startPanelDrag(e, this.uiControls, this.uiMoveButton);
    };

    _onToolbarMovePointerDown = (e: PointerEvent) => {
      this.startPanelDrag(e, this.toolbar, this.toolbarMoveButton);
    };

    _onBorderToggleClick = () => {
      this.toggleBorder();
    };

    _onUiToggleClick = () => {
      this.toggleUi();
    };

    _onPreviewHideClick = () => {
      this.togglePreview();
    };

    _onMobileToolsToggleClick = () => {
      this.setMobileToolsHidden(!document.body.classList.contains("mobile-tools-hidden"));
    };

    setMobileToolsHidden(hidden) {
      document.body.classList.toggle("mobile-tools-hidden", hidden);
      this.mobileToolsToggleButton.setAttribute("aria-expanded", String(!hidden));
      this.mobileToolsToggleButton.setAttribute(
        "aria-label",
        hidden ? "Show controls" : "Hide controls",
      );
      if (!hidden) {
        this._cancelPickerTimer();
        this.colorPicker.hide();
        this.hideAreaFlowMenu(false);
      }
    }

    _isMobileViewport() {
      return (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(max-width: 720px)").matches
      );
    }

    _onAspectButtonClick = () => {
      this.cycleAspectMode();
    };

    _onAnimateButtonClick = () => {
      if (!this.selected) return;
      const entering = !this.pathDrawingMode;
      this.setPathDrawingMode(entering);
      if (entering && this._isMobileViewport()) {
        this.setMobileToolsHidden(true);
      }
    };

    _onRandomizeButtonClick = () => {
      this.randomizeColors();
    };

    _onColorButtonClick = () => {
      this.openGradientPicker();
    };

    _onPreviewViewClick = () => {
      this.toggleFullView();
    };

    _onPreviewMovePointerDown = (e: PointerEvent) => {
      this.startPreviewDrag(e);
    };

    _onExportButtonClick = () => {
      if (this.animatePoints) {
        this.exportVideo();
        return;
      }

      this.exportPng();
    };

    _onAnimationPlayPauseClick = () => {
      if (!this.hasPointAnimations()) return;
      this.togglePointAnimation();
    };

    _onAnimationClearClick = () => {
      if (this.getSelectedAnimationPath()) {
        this.clearSelectedPointAnimation();
        return;
      }

      this.clearPointAnimations();
    };

    _onAnimationDurationInput = () => {
      const durationSeconds = Number(this.animationDurationInput.value);
      if (!Number.isFinite(durationSeconds)) return;
      this.setSelectedAnimationDuration(durationSeconds * 1000);
      this.render(false, true);
    };

    _onAnimationEasingChange = () => {
      this.setSelectedAnimationEasing(this.animationEasingSelect.value);
      this.render(false, true);
    };

    setupButtons() {
      this.gridButton.addEventListener("click", this._onGridButtonClick);
      this.pointsButton.addEventListener("click", this._onPointsButtonClick);
      this.gradientTypesButton.addEventListener("click", this._onGradientTypesButtonClick);
      this.uiMoveButton.addEventListener("pointerdown", this._onUiMovePointerDown);
      this.toolbarMoveButton.addEventListener("pointerdown", this._onToolbarMovePointerDown);
      this.borderToggleButton.addEventListener("click", this._onBorderToggleClick);
      this.uiToggleButton.addEventListener("click", this._onUiToggleClick);
      this.previewHideButton.addEventListener("click", this._onPreviewHideClick);
      this.mobileToolsToggleButton.addEventListener("click", this._onMobileToolsToggleClick);
      this.aspectButton.addEventListener("click", this._onAspectButtonClick);
      this.animateButton.addEventListener("click", this._onAnimateButtonClick);
      this.randomizeButton.addEventListener("click", this._onRandomizeButtonClick);
      this.colorButton.addEventListener("click", this._onColorButtonClick);
      this.previewViewBtn.addEventListener("click", this._onPreviewViewClick);
      this.previewMoveBtn.addEventListener("pointerdown", this._onPreviewMovePointerDown);
      this.exportButton.addEventListener("click", this._onExportButtonClick);
      this.animationPlayPauseButton.addEventListener("click", this._onAnimationPlayPauseClick);
      this.animationClearButton.addEventListener("click", this._onAnimationClearClick);
      this.animationDurationInput.addEventListener("input", this._onAnimationDurationInput);
      this.animationEasingSelect.addEventListener("change", this._onAnimationEasingChange);
      this.updateAnimateButtonState();
      this.updateAnimationToolbarState();
    }

    setGridVisible(visible) {
      this.showGrid = Boolean(visible);
      this.gridButton.classList.toggle("active", this.showGrid);
      this.gridButton.setAttribute("aria-pressed", String(this.showGrid));
      this.gridButton.textContent = this.showGrid ? "Hide Grid" : "Show Grid";
      this.renderOverlay();
    }

    setPointsVisible(visible) {
      this.showPoints = Boolean(visible);
      if (!this.showPoints) {
        this._cancelPickerTimer();
        this.colorPicker.hide();
        this.selected = null;
        this.selectedPoints = [];
        this.selectedAnimationPathId = null;
        this.pathDrawingMode = false;
        this.cancelAnimationPathDrawing();
        this.dragging = null;
        this.dragStart = null;
        this.dragPointerOffset = null;
        this.hovered = null;
        this.selectionRect = null;
        this.selectingMode = null;
      }
      this.pointsButton.classList.toggle("active", this.showPoints);
      this.pointsButton.setAttribute("aria-pressed", String(this.showPoints));
      this.pointsButton.textContent = this.showPoints ? "Hide Points" : "Show Points";
      this.ov.style.cursor = this.hoveredAreaFlowControl ? "pointer" : "crosshair";
      this.updateAnimateButtonState();
      this.updateAnimationToolbarState();
      this.renderOverlay();
    }

    setGradientTypesVisible(visible) {
      this.showGradientTypes = Boolean(visible);
      if (!this.showGradientTypes) {
        this.hoveredAreaFlowControl = null;
        this.selectedAreaFlowControls = [];
        this.hideAreaFlowMenu(false);
      }
      this.gradientTypesButton.classList.toggle("active", this.showGradientTypes);
      this.gradientTypesButton.setAttribute("aria-pressed", String(this.showGradientTypes));
      this.gradientTypesButton.textContent = this.showGradientTypes ? "Hide Types" : "Show Types";
      this.ov.style.cursor = this.hovered ? "grab" : "crosshair";
      this.updateAnimateButtonState();
      this.updateAnimationToolbarState();
      this.renderOverlay();
    }

    setUiHidden(hidden) {
      this.uiHidden = Boolean(hidden);
      if (this.uiHidden) {
        this._stopPanelDrag();
        this._stopPreviewDrag();
        this.colorPicker.hide();
        this.hideAreaFlowMenu(false);
      }
      document.body.classList.toggle("ui-hidden", this.uiHidden);
      this.uiToggleButton.classList.toggle("active", this.uiHidden);
      this.uiToggleButton.setAttribute("aria-pressed", String(this.uiHidden));
      this.uiToggleButton.textContent = this.uiHidden ? "Show UI" : "Hide UI";
    }

    toggleUi() {
      this.setUiHidden(!this.uiHidden);
    }

    setBorderHidden(hidden) {
      this.borderHidden = Boolean(hidden);
      document.body.classList.toggle("border-hidden", this.borderHidden);
      this.borderToggleButton.classList.toggle("active", this.borderHidden);
      this.borderToggleButton.setAttribute("aria-pressed", String(this.borderHidden));
      this.borderToggleButton.textContent = this.borderHidden ? "Show Border" : "Hide Border";
      this.resize();
    }

    toggleBorder() {
      this.setBorderHidden(!this.borderHidden);
    }

    setPreviewHidden(hidden) {
      this.previewHidden = Boolean(hidden);
      if (this.previewHidden) {
        this._stopPreviewDrag();
        if (this.fullView) this.toggleFullView();
      }
      document.body.classList.toggle("preview-hidden", this.previewHidden);
      this.previewHideButton.classList.toggle("active", this.previewHidden);
      this.previewHideButton.setAttribute("aria-pressed", String(this.previewHidden));
      this.previewHideButton.textContent = this.previewHidden ? "Show Preview" : "Hide Preview";
    }

    togglePreview() {
      this.setPreviewHidden(!this.previewHidden);
    }

    toggleFullView() {
      this._stopPreviewDrag();
      this.hideAreaFlowMenu(false);
      this.fullView = !this.fullView;
      document.body.classList.toggle("preview-full", this.fullView);
      const btn = this.previewViewBtn;
      btn.classList.toggle("active", this.fullView);
      btn.textContent = this.fullView ? "⤡" : "⤢";
      if (this.fullView) {
        this.previewDockedStyle = {
          left: this.previewFrame.style.left,
          top: this.previewFrame.style.top,
          right: this.previewFrame.style.right,
          bottom: this.previewFrame.style.bottom,
        };
        this.previewFrame.style.left = "";
        this.previewFrame.style.top = "";
        this.previewFrame.style.right = "";
        this.previewFrame.style.bottom = "";
      } else if (this.previewDockedStyle) {
        this.previewFrame.style.left = this.previewDockedStyle.left;
        this.previewFrame.style.top = this.previewDockedStyle.top;
        this.previewFrame.style.right = this.previewDockedStyle.right;
        this.previewFrame.style.bottom = this.previewDockedStyle.bottom;
      }
      this.resize();
    }

    startPanelDrag(e, element, handle) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = element.getBoundingClientRect();
      this.panelDragging = {
        element,
        handle,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      };
      if (handle.setPointerCapture && typeof e.pointerId === "number") {
        try { handle.setPointerCapture(e.pointerId); } catch {}
      }
      handle.classList.add("active");
      window.addEventListener("pointermove", this._movePanel);
      window.addEventListener("pointerup", this._stopPanelDrag);
      window.addEventListener("pointercancel", this._stopPanelDrag);
    }

    clampFloatingPanel(element) {
      if (!element.style.left || !element.style.top) return;
      const maxLeft = Math.max(0, this.container.clientWidth - element.offsetWidth);
      const maxTop = Math.max(0, this.container.clientHeight - element.offsetHeight);
      const left = clamp(parseFloat(element.style.left), 0, maxLeft);
      const top = clamp(parseFloat(element.style.top), 0, maxTop);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
    }

    _movePanel = (e) => {
      if (!this.panelDragging) return;
      const { element, offsetX, offsetY } = this.panelDragging;
      const containerRect = this.container.getBoundingClientRect();
      const maxLeft = Math.max(0, containerRect.width - element.offsetWidth);
      const maxTop = Math.max(0, containerRect.height - element.offsetHeight);
      const left = clamp(e.clientX - containerRect.left - offsetX, 0, maxLeft);
      const top = clamp(e.clientY - containerRect.top - offsetY, 0, maxTop);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      element.style.right = "auto";
      element.style.bottom = "auto";
    };

    _stopPanelDrag = () => {
      if (!this.panelDragging) return;
      this.panelDragging.handle.classList.remove("active");
      this.panelDragging = null;
      window.removeEventListener("pointermove", this._movePanel);
      window.removeEventListener("pointerup", this._stopPanelDrag);
      window.removeEventListener("pointercancel", this._stopPanelDrag);
    };

    startPreviewDrag(e) {
      if (this.fullView || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const frameRect = this.previewFrame.getBoundingClientRect();
      this.previewDragging = {
        offsetX: e.clientX - frameRect.left,
        offsetY: e.clientY - frameRect.top,
        container: this.container,
      };
      if (this.previewMoveBtn.setPointerCapture && typeof e.pointerId === "number") {
        try { this.previewMoveBtn.setPointerCapture(e.pointerId); } catch {}
      }
      this.previewMoveBtn.classList.add("active");
      window.addEventListener("pointermove", this._movePreviewFrame);
      window.addEventListener("pointerup", this._stopPreviewDrag);
      window.addEventListener("pointercancel", this._stopPreviewDrag);
    }

    _movePreviewFrame = (e) => {
      if (!this.previewDragging) return;
      const { container, offsetX, offsetY } = this.previewDragging;
      const containerRect = container.getBoundingClientRect();
      const frameRect = this.previewFrame.getBoundingClientRect();
      const maxLeft = Math.max(0, containerRect.width - frameRect.width);
      const maxTop = Math.max(0, containerRect.height - frameRect.height);
      const left = clamp(e.clientX - containerRect.left - offsetX, 0, maxLeft);
      const top = clamp(e.clientY - containerRect.top - offsetY, 0, maxTop);
      this.previewFrame.style.left = `${left}px`;
      this.previewFrame.style.top = `${top}px`;
      this.previewFrame.style.right = "auto";
      this.previewFrame.style.bottom = "auto";
      this.previewDockedStyle = {
        left: this.previewFrame.style.left,
        top: this.previewFrame.style.top,
        right: this.previewFrame.style.right,
        bottom: this.previewFrame.style.bottom,
      };
    };

    _stopPreviewDrag = () => {
      if (!this.previewDragging) return;
      this.previewDragging = null;
      this.previewMoveBtn.classList.remove("active");
      window.removeEventListener("pointermove", this._movePreviewFrame);
      window.removeEventListener("pointerup", this._stopPreviewDrag);
      window.removeEventListener("pointercancel", this._stopPreviewDrag);
    };

    randomizeColors() {
      this.colorPicker.hide();
      this.selected = null;
      this.selectedPoints = [];
      this.selectedAreaFlowControls = [];
      this.selectedAnimationPathId = null;
      this.pathDrawingMode = false;
      this.cancelAnimationPathDrawing();
      const base = Math.random() * 360;
      const spread = 80 + Math.random() * 40;
      const TL = hslToRgb(base % 360, 75 + Math.random() * 20, 38 + Math.random() * 14);
      const TR = hslToRgb((base + spread) % 360, 75 + Math.random() * 20, 38 + Math.random() * 14);
      const BL = hslToRgb((base + spread * 2) % 360, 70 + Math.random() * 20, 38 + Math.random() * 14);
      const BR = hslToRgb((base + spread * 3) % 360, 70 + Math.random() * 20, 38 + Math.random() * 14);
      for (let r = 0; r < this.ROWS; r++) {
        for (let c = 0; c < this.COLS; c++) {
          const u = c / (this.COLS - 1);
          const v = r / (this.ROWS - 1);
          const col = colorBilerp(TL, TR, BL, BR, u, v);
          const p = this.grid[r][c];
          p.r = col.r;
          p.g = col.g;
          p.b = col.b;
        }
      }
      this.updateAnimateButtonState();
      this.updateAnimationToolbarState();
      this.render();
    }
  };
}

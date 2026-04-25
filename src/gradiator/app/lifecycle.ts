import type { AppConstructor } from "./mixin";

export function withLifecycle<TBase extends AppConstructor<any>>(Base: TBase) {
  return class GradiatorLifecycleApp extends Base {
    destroy() {
      this.cancelVideoExport();
      this._cancelPickerTimer();
      this._stopPanelDrag();
      this._stopPreviewDrag();
      this.setPointAnimationEnabled(false);

      this.ov.removeEventListener("pointerdown", this._onOverlayPointerDown);
      this.ov.removeEventListener("pointermove", this._onOverlayPointerMove);
      this.ov.removeEventListener("pointerup", this._onOverlayPointerUp);
      this.ov.removeEventListener("pointercancel", this._onOverlayPointerUp);
      this.ov.removeEventListener("dblclick", this._onOverlayDoubleClick);
      this.ov.removeEventListener("pointerleave", this._onOverlayPointerLeave);
      window.removeEventListener("pointermove", this._onWindowPointerMove);
      window.removeEventListener("pointerup", this._onWindowPointerUp);
      window.removeEventListener("pointercancel", this._onWindowPointerUp);
      this.areaFlowMenu.removeEventListener("pointerdown", this._onAreaFlowMenuPointerDown);
      this.areaFlowMenuOptions.removeEventListener("click", this._onAreaFlowMenuClick);
      document.removeEventListener("pointerdown", this._onDocumentPointerDown);
      document.removeEventListener("keydown", this._onDocumentKeyDown);

      this.gridButton.removeEventListener("click", this._onGridButtonClick);
      this.pointsButton.removeEventListener("click", this._onPointsButtonClick);
      this.gradientTypesButton.removeEventListener("click", this._onGradientTypesButtonClick);
      this.uiMoveButton.removeEventListener("pointerdown", this._onUiMovePointerDown);
      this.toolbarMoveButton.removeEventListener("pointerdown", this._onToolbarMovePointerDown);
      this.borderToggleButton.removeEventListener("click", this._onBorderToggleClick);
      this.uiToggleButton.removeEventListener("click", this._onUiToggleClick);
      this.previewHideButton.removeEventListener("click", this._onPreviewHideClick);
      this.mobileToolsToggleButton.removeEventListener("click", this._onMobileToolsToggleClick);
      this.aspectButton.removeEventListener("click", this._onAspectButtonClick);
      this.animateButton.removeEventListener("click", this._onAnimateButtonClick);
      this.randomizeButton.removeEventListener("click", this._onRandomizeButtonClick);
      this.colorButton.removeEventListener("click", this._onColorButtonClick);
      this.previewViewBtn.removeEventListener("click", this._onPreviewViewClick);
      this.previewMoveBtn.removeEventListener("pointerdown", this._onPreviewMovePointerDown);
      this.exportButton.removeEventListener("click", this._onExportButtonClick);
      this.animationPlayPauseButton.removeEventListener("click", this._onAnimationPlayPauseClick);
      this.animationClearButton.removeEventListener("click", this._onAnimationClearClick);
      this.animationDurationInput.removeEventListener("input", this._onAnimationDurationInput);
      this.animationEasingSelect.removeEventListener("change", this._onAnimationEasingChange);

      this.resizeObserver.disconnect();
      this.hideAreaFlowMenu(false);
      this.colorPicker.hide();
      this.colorPicker.destroy();
      this.selected = null;
      this.dragging = null;
      this.dragStart = null;
      this.dragPointerOffset = null;
      this.pathDrawingMode = false;
      this.drawingAnimationPathPoint = null;
      this.draftAnimationPath = [];
      this.selectedAnimationPathId = null;
      this.hoveredAnimationPathId = null;
      this.hovered = null;
      this.hoveredAreaFlowControl = null;
      this.ov.style.cursor = "crosshair";
      document.body.classList.remove("ui-hidden", "border-hidden", "preview-full", "mobile-tools-hidden", "preview-hidden");
    }
  };
}

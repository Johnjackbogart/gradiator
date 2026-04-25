import type { AppConstructor } from "./mixin";

export function withLifecycle<TBase extends AppConstructor<any>>(Base: TBase) {
  return class GradiatorLifecycleApp extends Base {
    destroy() {
      this.cancelVideoExport();
      this._cancelPickerTimer();
      this._stopPanelDrag();
      this._stopPreviewDrag();
      this.setPointAnimationEnabled(false);

      this.ov.removeEventListener("mousedown", this._onOverlayMouseDown);
      this.ov.removeEventListener("mousemove", this._onOverlayMouseMove);
      this.ov.removeEventListener("mouseup", this._onOverlayMouseUp);
      this.ov.removeEventListener("dblclick", this._onOverlayDoubleClick);
      this.ov.removeEventListener("mouseleave", this._onOverlayMouseLeave);
      this.areaFlowMenu.removeEventListener("mousedown", this._onAreaFlowMenuMouseDown);
      this.areaFlowMenuOptions.removeEventListener("click", this._onAreaFlowMenuClick);
      document.removeEventListener("mousedown", this._onDocumentMouseDown);
      document.removeEventListener("keydown", this._onDocumentKeyDown);

      this.gridButton.removeEventListener("click", this._onGridButtonClick);
      this.pointsButton.removeEventListener("click", this._onPointsButtonClick);
      this.gradientTypesButton.removeEventListener("click", this._onGradientTypesButtonClick);
      this.uiMoveButton.removeEventListener("mousedown", this._onUiMoveMouseDown);
      this.toolbarMoveButton.removeEventListener("mousedown", this._onToolbarMoveMouseDown);
      this.borderToggleButton.removeEventListener("click", this._onBorderToggleClick);
      this.uiToggleButton.removeEventListener("click", this._onUiToggleClick);
      this.flowButton.removeEventListener("click", this._onFlowButtonClick);
      this.aspectButton.removeEventListener("click", this._onAspectButtonClick);
      this.animateButton.removeEventListener("click", this._onAnimateButtonClick);
      this.randomizeButton.removeEventListener("click", this._onRandomizeButtonClick);
      this.colorButton.removeEventListener("click", this._onColorButtonClick);
      this.previewViewBtn.removeEventListener("click", this._onPreviewViewClick);
      this.previewMoveBtn.removeEventListener("mousedown", this._onPreviewMoveMouseDown);
      this.exportButton.removeEventListener("click", this._onExportButtonClick);

      this.resizeObserver.disconnect();
      this.hideAreaFlowMenu(false);
      this.colorPicker.hide();
      this.colorPicker.destroy();
      this.selected = null;
      this.dragging = null;
      this.dragStart = null;
      this.dragPointerOffset = null;
      this.hovered = null;
      this.hoveredAreaFlowControl = null;
      this.ov.style.cursor = "crosshair";
      document.body.classList.remove("ui-hidden", "border-hidden", "preview-full");
    }
  };
}

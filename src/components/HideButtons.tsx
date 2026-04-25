import type { RefObject } from "react";

type HideButtonsProps = {
  controlsRef: RefObject<HTMLDivElement | null>;
  moveButtonRef: RefObject<HTMLButtonElement | null>;
  uiToggleButtonRef: RefObject<HTMLButtonElement | null>;
  borderToggleButtonRef: RefObject<HTMLButtonElement | null>;
  previewHideButtonRef: RefObject<HTMLButtonElement | null>;
  gridButtonRef: RefObject<HTMLButtonElement | null>;
  pointsButtonRef: RefObject<HTMLButtonElement | null>;
  gradientTypesButtonRef: RefObject<HTMLButtonElement | null>;
};

export function HideButtons({
  controlsRef,
  moveButtonRef,
  uiToggleButtonRef,
  borderToggleButtonRef,
  previewHideButtonRef,
  gridButtonRef,
  pointsButtonRef,
  gradientTypesButtonRef,
}: HideButtonsProps) {
  return (
    <div id="ui-controls" ref={controlsRef}>
      <button
        className="btn panel-handle"
        id="btn-ui-move"
        type="button"
        aria-label="Move UI controls"
        ref={moveButtonRef}
      >
        ✋
      </button>
      <div className="ui-buttons">
        <button
          className="btn"
          id="btn-ui"
          type="button"
          aria-pressed="false"
          ref={uiToggleButtonRef}
        >
          Hide UI
        </button>
        <button
          className="btn"
          id="btn-border"
          type="button"
          aria-pressed="false"
          ref={borderToggleButtonRef}
        >
          Hide Border
        </button>
        <button
          className="btn"
          id="btn-preview-hide"
          type="button"
          aria-pressed="false"
          ref={previewHideButtonRef}
        >
          Hide Preview
        </button>
        <button
          className="btn active"
          id="btn-grid"
          type="button"
          aria-pressed="true"
          ref={gridButtonRef}
        >
          Hide Grid
        </button>
        <button
          className="btn active"
          id="btn-points"
          type="button"
          aria-pressed="true"
          ref={pointsButtonRef}
        >
          Hide Points
        </button>
        <button
          className="btn active"
          id="btn-gradient-types"
          type="button"
          aria-pressed="true"
          ref={gradientTypesButtonRef}
        >
          Hide Types
        </button>
      </div>
    </div>
  );
}

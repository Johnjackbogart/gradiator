import type { RefObject } from "react";

type HideButtonsProps = {
  controlsRef: RefObject<HTMLDivElement | null>;
  moveButtonRef: RefObject<HTMLButtonElement | null>;
  uiToggleButtonRef: RefObject<HTMLButtonElement | null>;
  borderToggleButtonRef: RefObject<HTMLButtonElement | null>;
};

export function HideButtons({
  controlsRef,
  moveButtonRef,
  uiToggleButtonRef,
  borderToggleButtonRef,
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
        <button className="btn" id="btn-ui" type="button" aria-pressed="false" ref={uiToggleButtonRef}>
          Hide UI
        </button>
        <button className="btn" id="btn-border" type="button" aria-pressed="false" ref={borderToggleButtonRef}>
          Hide Border
        </button>
      </div>
    </div>
  );
}

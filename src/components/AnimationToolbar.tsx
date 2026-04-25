import type { RefObject } from "react";

type AnimationToolbarProps = {
  toolbarRef: RefObject<HTMLDivElement | null>;
  playPauseButtonRef: RefObject<HTMLButtonElement | null>;
  clearButtonRef: RefObject<HTMLButtonElement | null>;
  pathControlsRef: RefObject<HTMLDivElement | null>;
  pathLabelRef: RefObject<HTMLSpanElement | null>;
  durationInputRef: RefObject<HTMLInputElement | null>;
  durationValueRef: RefObject<HTMLSpanElement | null>;
  easingSelectRef: RefObject<HTMLSelectElement | null>;
};

export function AnimationToolbar({
  toolbarRef,
  playPauseButtonRef,
  clearButtonRef,
  pathControlsRef,
  pathLabelRef,
  durationInputRef,
  durationValueRef,
  easingSelectRef,
}: AnimationToolbarProps) {
  return (
    <div id="animation-toolbar" ref={toolbarRef} hidden>
      <div className="animation-toolbar-controls">
        <button className="btn" id="btn-animation-play" type="button" ref={playPauseButtonRef}>
          Play
        </button>
        <button className="btn" id="btn-animation-clear" type="button" ref={clearButtonRef} disabled>
          Clear All
        </button>
      </div>
      <div className="animation-path-controls" ref={pathControlsRef} hidden>
        <span className="animation-path-label" ref={pathLabelRef}>
          Path
        </span>
        <label className="animation-field">
          <span>Length</span>
          <input
            id="animation-duration"
            type="range"
            min="0.5"
            max="12"
            step="0.1"
            defaultValue="2.4"
            ref={durationInputRef}
          />
          <span className="animation-value" ref={durationValueRef}>
            2.4s
          </span>
        </label>
        <label className="animation-field">
          <span>Easing</span>
          <select id="animation-easing" defaultValue="ease-in-out" ref={easingSelectRef}>
            <option value="linear">Linear</option>
            <option value="ease-in">Ease In</option>
            <option value="ease-out">Ease Out</option>
            <option value="ease-in-out">Ease In Out</option>
          </select>
        </label>
      </div>
    </div>
  );
}

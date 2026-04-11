import type { RefObject } from "react";

type ToolbarProps = {
  toolbarRef: RefObject<HTMLDivElement | null>;
  moveButtonRef: RefObject<HTMLButtonElement | null>;
  gridButtonRef: RefObject<HTMLButtonElement | null>;
  flowButtonRef: RefObject<HTMLButtonElement | null>;
  aspectButtonRef: RefObject<HTMLButtonElement | null>;
  randomizeButtonRef: RefObject<HTMLButtonElement | null>;
  colorButtonRef: RefObject<HTMLButtonElement | null>;
  exportButtonRef: RefObject<HTMLButtonElement | null>;
};

export function Toolbar({
  toolbarRef,
  moveButtonRef,
  gridButtonRef,
  flowButtonRef,
  aspectButtonRef,
  randomizeButtonRef,
  colorButtonRef,
  exportButtonRef,
}: ToolbarProps) {
  return (
    <div id="toolbar" ref={toolbarRef}>
      <button
        className="btn panel-handle"
        id="btn-toolbar-move"
        type="button"
        aria-label="Move toolbar"
        ref={moveButtonRef}
      >
        ✋
      </button>
      <div className="toolbar-content">
        <div className="toolbar-controls">
          <button className="btn active" id="btn-grid" type="button" ref={gridButtonRef}>
            ⊞ Grid
          </button>
          <button className="btn active" id="btn-flow" type="button" ref={flowButtonRef}>
            Flow All: Fluid
          </button>
          <button className="btn active" id="btn-aspect" type="button" ref={aspectButtonRef}>
            Aspect: Browser
          </button>
          <button className="btn" id="btn-randomize" type="button" ref={randomizeButtonRef}>
            ↻ Randomize
          </button>
          <button className="btn" id="btn-color" type="button" ref={colorButtonRef}>
            🎨 Color
          </button>
          <button className="btn" id="btn-export" type="button" ref={exportButtonRef}>
            ↓ Export PNG
          </button>
        </div>
      </div>
    </div>
  );
}

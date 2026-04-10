import type { RefObject } from "react";

type PreviewProps = {
  frameRef: RefObject<HTMLDivElement | null>;
  moveButtonRef: RefObject<HTMLButtonElement | null>;
  viewButtonRef: RefObject<HTMLButtonElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

export function Preview({ frameRef, moveButtonRef, viewButtonRef, canvasRef }: PreviewProps) {
  return (
    <div id="preview-frame" aria-hidden="true" ref={frameRef}>
      <button className="btn" id="btn-move" type="button" aria-label="Move preview" ref={moveButtonRef}>
        ✋
      </button>
      <button className="btn" id="btn-view" type="button" aria-label="Toggle full view" ref={viewButtonRef}>
        ⤢
      </button>
      <canvas id="preview-canvas" width={640} height={400} ref={canvasRef}></canvas>
    </div>
  );
}

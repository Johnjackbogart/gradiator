export function Preview() {
  return (
    <div id="preview-frame" aria-hidden="true">
      <button className="btn" id="btn-move" type="button" aria-label="Move preview">
        ✋
      </button>
      <button className="btn" id="btn-view" type="button" aria-label="Toggle full view">
        ⤢
      </button>
      <canvas id="preview-canvas" width={640} height={400}></canvas>
    </div>
  );
}

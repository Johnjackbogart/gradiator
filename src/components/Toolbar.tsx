export function Toolbar() {
  return (
    <div id="toolbar">
      <button className="btn panel-handle" id="btn-toolbar-move" type="button" aria-label="Move toolbar">
        ✋
      </button>
      <div className="toolbar-content">
        <div className="toolbar-controls">
          <button className="btn active" id="btn-grid" type="button">
            ⊞ Grid
          </button>
          <button className="btn active" id="btn-flow" type="button">
            Flow: Fluid
          </button>
          <button className="btn" id="btn-randomize" type="button">
            ↻ Randomize
          </button>
          <button className="btn" id="btn-color" type="button">
            🎨 Color
          </button>
          <button className="btn" id="btn-export" type="button">
            ↓ Export PNG
          </button>
        </div>
      </div>
    </div>
  );
}

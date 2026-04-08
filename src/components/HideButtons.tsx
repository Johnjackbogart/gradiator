export function HideButtons() {
  return (
    <div id="ui-controls">
      <button className="btn panel-handle" id="btn-ui-move" type="button" aria-label="Move UI controls">
        ✋
      </button>
      <div className="ui-buttons">
        <button className="btn" id="btn-ui" type="button" aria-pressed="false">
          Hide UI
        </button>
        <button className="btn" id="btn-border" type="button" aria-pressed="false">
          Hide Border
        </button>
      </div>
    </div>
  );
}

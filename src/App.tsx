import { HideButtons } from "./components/HideButtons";
import { Preview } from "./components/Preview";
import { Title } from "./components/Title";
import { Toolbar } from "./components/Toolbar";

export function App() {
  return (
    <>
      <div id="canvas-container">
        <div id="image-stage">
          <canvas id="gl-canvas"></canvas>
          <canvas id="overlay-canvas"></canvas>
        </div>
        <div id="hint">Drag to warp · Click point for color · Double-click canvas to add a point</div>
        <Title />
        <HideButtons />
        <Toolbar />
        <Preview />
      </div>

      <div id="cp-panel">
        <div id="cp-sv-wrap">
          <canvas id="cp-sv-canvas" width={200} height={164}></canvas>
          <div id="cp-sv-cursor"></div>
        </div>
        <input type="range" id="cp-hue" min="0" max="360" step="0.5" defaultValue="0" />
        <div id="cp-bottom">
          <div id="cp-swatch"></div>
          <input type="text" id="cp-hex" maxLength={7} spellCheck={false} placeholder="#000000" />
        </div>
      </div>
    </>
  );
}

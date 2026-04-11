import { useEffect, useRef } from "react";
import { bootGradiatorApp } from "../gradiator-app";
import { HideButtons } from "./HideButtons";
import { Preview } from "./Preview";
import { Title } from "./Title";
import { Toolbar } from "./Toolbar";

export function GradiatorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageStageRef = useRef<HTMLDivElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const uiControlsRef = useRef<HTMLDivElement>(null);
  const uiMoveButtonRef = useRef<HTMLButtonElement>(null);
  const uiToggleButtonRef = useRef<HTMLButtonElement>(null);
  const borderToggleButtonRef = useRef<HTMLButtonElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const toolbarMoveButtonRef = useRef<HTMLButtonElement>(null);
  const gridButtonRef = useRef<HTMLButtonElement>(null);
  const flowButtonRef = useRef<HTMLButtonElement>(null);
  const aspectButtonRef = useRef<HTMLButtonElement>(null);
  const randomizeButtonRef = useRef<HTMLButtonElement>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const areaFlowMenuRef = useRef<HTMLDivElement>(null);
  const areaFlowMenuTitleRef = useRef<HTMLDivElement>(null);
  const areaFlowMenuOptionsRef = useRef<HTMLDivElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const previewMoveButtonRef = useRef<HTMLButtonElement>(null);
  const previewViewButtonRef = useRef<HTMLButtonElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const colorPickerPanelRef = useRef<HTMLDivElement>(null);
  const colorPickerSvWrapRef = useRef<HTMLDivElement>(null);
  const colorPickerSvCanvasRef = useRef<HTMLCanvasElement>(null);
  const colorPickerSvCursorRef = useRef<HTMLDivElement>(null);
  const colorPickerHueRef = useRef<HTMLInputElement>(null);
  const colorPickerHexRef = useRef<HTMLInputElement>(null);
  const colorPickerSwatchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const imageStage = imageStageRef.current;
    const glCanvas = glCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const uiControls = uiControlsRef.current;
    const uiMoveButton = uiMoveButtonRef.current;
    const uiToggleButton = uiToggleButtonRef.current;
    const borderToggleButton = borderToggleButtonRef.current;
    const toolbar = toolbarRef.current;
    const toolbarMoveButton = toolbarMoveButtonRef.current;
    const gridButton = gridButtonRef.current;
    const flowButton = flowButtonRef.current;
    const aspectButton = aspectButtonRef.current;
    const randomizeButton = randomizeButtonRef.current;
    const colorButton = colorButtonRef.current;
    const exportButton = exportButtonRef.current;
    const areaFlowMenu = areaFlowMenuRef.current;
    const areaFlowMenuTitle = areaFlowMenuTitleRef.current;
    const areaFlowMenuOptions = areaFlowMenuOptionsRef.current;
    const previewFrame = previewFrameRef.current;
    const previewMoveButton = previewMoveButtonRef.current;
    const previewViewButton = previewViewButtonRef.current;
    const previewCanvas = previewCanvasRef.current;
    const colorPickerPanel = colorPickerPanelRef.current;
    const colorPickerSvWrap = colorPickerSvWrapRef.current;
    const colorPickerSvCanvas = colorPickerSvCanvasRef.current;
    const colorPickerSvCursor = colorPickerSvCursorRef.current;
    const colorPickerHue = colorPickerHueRef.current;
    const colorPickerHex = colorPickerHexRef.current;
    const colorPickerSwatch = colorPickerSwatchRef.current;

    if (
      !container ||
      !imageStage ||
      !glCanvas ||
      !overlayCanvas ||
      !uiControls ||
      !uiMoveButton ||
      !uiToggleButton ||
      !borderToggleButton ||
      !toolbar ||
      !toolbarMoveButton ||
      !gridButton ||
      !flowButton ||
      !aspectButton ||
      !randomizeButton ||
      !colorButton ||
      !exportButton ||
      !areaFlowMenu ||
      !areaFlowMenuTitle ||
      !areaFlowMenuOptions ||
      !previewFrame ||
      !previewMoveButton ||
      !previewViewButton ||
      !previewCanvas ||
      !colorPickerPanel ||
      !colorPickerSvWrap ||
      !colorPickerSvCanvas ||
      !colorPickerSvCursor ||
      !colorPickerHue ||
      !colorPickerHex ||
      !colorPickerSwatch
    ) {
      return;
    }

    const app = bootGradiatorApp({
      container,
      imageStage,
      glCanvas,
      overlayCanvas,
      previewCanvas,
      uiControls,
      uiMoveButton,
      toolbar,
      toolbarMoveButton,
      previewFrame,
      previewMoveButton,
      previewViewButton,
      borderToggleButton,
      uiToggleButton,
      gridButton,
      flowButton,
      aspectButton,
      colorButton,
      randomizeButton,
      exportButton,
      areaFlowMenu,
      areaFlowMenuTitle,
      areaFlowMenuOptions,
      colorPickerPanel,
      colorPickerSvWrap,
      colorPickerSvCanvas,
      colorPickerSvCursor,
      colorPickerHue,
      colorPickerHex,
      colorPickerSwatch,
    });

    return () => {
      app.destroy();
    };
  }, []);

  return (
    <>
      <div id="canvas-container" ref={containerRef}>
        <div id="image-stage" ref={imageStageRef}>
          <canvas id="gl-canvas" ref={glCanvasRef}></canvas>
          <canvas id="overlay-canvas" ref={overlayCanvasRef}></canvas>
        </div>
        <Title />
        <HideButtons
          controlsRef={uiControlsRef}
          moveButtonRef={uiMoveButtonRef}
          uiToggleButtonRef={uiToggleButtonRef}
          borderToggleButtonRef={borderToggleButtonRef}
        />
        <Toolbar
          toolbarRef={toolbarRef}
          moveButtonRef={toolbarMoveButtonRef}
          gridButtonRef={gridButtonRef}
          flowButtonRef={flowButtonRef}
          aspectButtonRef={aspectButtonRef}
          randomizeButtonRef={randomizeButtonRef}
          colorButtonRef={colorButtonRef}
          exportButtonRef={exportButtonRef}
        />
        <Preview
          frameRef={previewFrameRef}
          moveButtonRef={previewMoveButtonRef}
          viewButtonRef={previewViewButtonRef}
          canvasRef={previewCanvasRef}
        />
        <div id="area-flow-menu" ref={areaFlowMenuRef} hidden>
          <div className="area-flow-menu-title" ref={areaFlowMenuTitleRef}>
            Area Flow
          </div>
          <div className="area-flow-menu-options" ref={areaFlowMenuOptionsRef}></div>
        </div>
      </div>

      <div id="cp-panel" ref={colorPickerPanelRef}>
        <div id="cp-sv-wrap" ref={colorPickerSvWrapRef}>
          <canvas id="cp-sv-canvas" width={200} height={164} ref={colorPickerSvCanvasRef}></canvas>
          <div id="cp-sv-cursor" ref={colorPickerSvCursorRef}></div>
        </div>
        <input
          type="range"
          id="cp-hue"
          min="0"
          max="360"
          step="0.5"
          defaultValue="0"
          ref={colorPickerHueRef}
        />
        <div id="cp-bottom">
          <div id="cp-swatch" ref={colorPickerSwatchRef}></div>
          <input
            type="text"
            id="cp-hex"
            maxLength={7}
            spellCheck={false}
            placeholder="#000000"
            ref={colorPickerHexRef}
          />
        </div>
      </div>
    </>
  );
}

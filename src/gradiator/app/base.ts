import { ASPECT_MODES, FLOW_MODES } from "../config";
import { ColorPicker } from "../color-picker";
import { createFlowModeGrid } from "../model/flow-mode-grid";
import { createInitialGrid } from "../model/grid-model";
import type {
  AreaFlowControl,
  AspectMode,
  DockedStyle,
  FlowGridLines,
  FlowMode,
  FlowRuntime,
  GradientPoint,
  GradiatorAppElements,
  GridAreaIndex,
  GridIndex,
  PanelDragState,
  Point2D,
  PointAnimationPath,
  PreviewDragState,
  SelectionRect,
} from "../types";
import { createProgram } from "../../utils/webgl.js";

export class GradiatorAppBase {
  readonly container: HTMLDivElement;
  readonly imageStage: HTMLDivElement;
  readonly glCanvas: HTMLCanvasElement;
  readonly ov: HTMLCanvasElement;
  readonly preview: HTMLCanvasElement;
  readonly uiControls: HTMLDivElement;
  readonly uiMoveButton: HTMLButtonElement;
  readonly toolbar: HTMLDivElement;
  readonly toolbarMoveButton: HTMLButtonElement;
  readonly previewFrame: HTMLDivElement;
  readonly previewMoveBtn: HTMLButtonElement;
  readonly previewViewBtn: HTMLButtonElement;
  readonly borderToggleButton: HTMLButtonElement;
  readonly uiToggleButton: HTMLButtonElement;
  readonly gridButton: HTMLButtonElement;
  readonly pointsButton: HTMLButtonElement;
  readonly gradientTypesButton: HTMLButtonElement;
  readonly aspectButton: HTMLButtonElement;
  readonly animateButton: HTMLButtonElement;
  readonly colorButton: HTMLButtonElement;
  readonly randomizeButton: HTMLButtonElement;
  readonly exportButton: HTMLButtonElement;
  readonly animationToolbar: HTMLDivElement;
  readonly animationPlayPauseButton: HTMLButtonElement;
  readonly animationClearButton: HTMLButtonElement;
  readonly animationPathControls: HTMLDivElement;
  readonly animationPathLabel: HTMLSpanElement;
  readonly animationDurationInput: HTMLInputElement;
  readonly animationDurationValue: HTMLSpanElement;
  readonly animationEasingSelect: HTMLSelectElement;
  readonly areaFlowMenu: HTMLDivElement;
  readonly areaFlowMenuTitle: HTMLDivElement;
  readonly areaFlowMenuOptions: HTMLDivElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly previewCtx: CanvasRenderingContext2D;
  readonly colorPicker: ColorPicker;
  readonly flowModes: readonly FlowMode[] = FLOW_MODES;
  readonly aspectModes: readonly AspectMode[] = ASPECT_MODES;
  readonly resizeObserver: ResizeObserver;
  gl!: WebGLRenderingContext;
  prog!: WebGLProgram;
  aPos!: number;
  aCol!: number;
  posBuf!: WebGLBuffer;
  colBuf!: WebGLBuffer;
  ROWS = 4;
  COLS = 4;
  readonly SUBS_HI = 28;
  readonly SUBS_LO = 14;
  showGrid = true;
  showPoints = true;
  showGradientTypes = true;
  fullView = false;
  defaultFlowModeIndex = 2;
  aspectModeIndex = 3;
  lastSerializedState = "";
  grid: GradientPoint[][] = [];
  displayGrid: GradientPoint[][] = [];
  flowModeGrid: number[][] = [];
  selected: GridIndex | null = null;
  selectedPoints: GridIndex[] = [];
  dragging: GridIndex | null = null;
  hovered: GridIndex | null = null;
  pointAnimations: PointAnimationPath[] = [];
  selectedAnimationPathId: string | null = null;
  hoveredAnimationPathId: string | null = null;
  pathDrawingMode = false;
  drawingAnimationPathPoint: GridIndex | null = null;
  draftAnimationPath: Point2D[] = [];
  nextAnimationPathId = 1;
  activeAreaFlowControl: GridAreaIndex | null = null;
  hoveredAreaFlowControl: GridAreaIndex | null = null;
  selectedAreaFlowControls: GridAreaIndex[] = [];
  selectionRect: SelectionRect | null = null;
  selectingMode: "points" | "areas" | null = null;
  colorMode: "point" | "all" = "point";
  borderHidden = false;
  uiHidden = false;
  panelDragging: PanelDragState | null = null;
  previewDragging: PreviewDragState | null = null;
  previewDockedStyle: DockedStyle | null = null;
  areaFlowControls: AreaFlowControl[] = [];
  flowGridCache: { key: string; lines: FlowGridLines } | null = null;
  flowRuntimeGrid: FlowRuntime[][] = [];
  W = 0;
  H = 0;
  dragStart: Point2D | null = null;
  dragPointerOffset: Point2D | null = null;
  didDrag = false;
  pickerTimer: number | null = null;
  animatePoints = false;
  animationTimeMs = 0;
  animationLastFrameMs: number | null = null;
  animationFrame: number | null = null;
  isExportingVideo = false;
  exportVideoRecorder: MediaRecorder | null = null;
  exportVideoStream: MediaStream | null = null;
  exportVideoTimer: number | null = null;
  exportVideoChunks: Blob[] = [];
  exportVideoMimeType = "";
  shouldDownloadVideoExport = false;

  constructor(elements: GradiatorAppElements) {
    this.container = elements.container;
    this.imageStage = elements.imageStage;
    this.glCanvas = elements.glCanvas;
    this.ov = elements.overlayCanvas;
    this.preview = elements.previewCanvas;
    this.uiControls = elements.uiControls;
    this.uiMoveButton = elements.uiMoveButton;
    this.toolbar = elements.toolbar;
    this.toolbarMoveButton = elements.toolbarMoveButton;
    this.previewFrame = elements.previewFrame;
    this.previewMoveBtn = elements.previewMoveButton;
    this.previewViewBtn = elements.previewViewButton;
    this.borderToggleButton = elements.borderToggleButton;
    this.uiToggleButton = elements.uiToggleButton;
    this.gridButton = elements.gridButton;
    this.pointsButton = elements.pointsButton;
    this.gradientTypesButton = elements.gradientTypesButton;
    this.aspectButton = elements.aspectButton;
    this.animateButton = elements.animateButton;
    this.colorButton = elements.colorButton;
    this.randomizeButton = elements.randomizeButton;
    this.exportButton = elements.exportButton;
    this.animationToolbar = elements.animationToolbar;
    this.animationPlayPauseButton = elements.animationPlayPauseButton;
    this.animationClearButton = elements.animationClearButton;
    this.animationPathControls = elements.animationPathControls;
    this.animationPathLabel = elements.animationPathLabel;
    this.animationDurationInput = elements.animationDurationInput;
    this.animationDurationValue = elements.animationDurationValue;
    this.animationEasingSelect = elements.animationEasingSelect;
    this.areaFlowMenu = elements.areaFlowMenu;
    this.areaFlowMenuTitle = elements.areaFlowMenuTitle;
    this.areaFlowMenuOptions = elements.areaFlowMenuOptions;

    const overlayContext = this.ov.getContext("2d");
    const previewContext = this.preview.getContext("2d");
    if (!overlayContext || !previewContext) {
      throw new Error("Missing app canvas context");
    }
    this.ctx = overlayContext;
    this.previewCtx = previewContext;

    this.colorPicker = new ColorPicker(
      {
        panel: elements.colorPickerPanel,
        svWrap: elements.colorPickerSvWrap,
        svCanvas: elements.colorPickerSvCanvas,
        svCursor: elements.colorPickerSvCursor,
        hueSlider: elements.colorPickerHue,
        hexInput: elements.colorPickerHex,
        swatch: elements.colorPickerSwatch,
      },
      (r, g, b) => {
        if (this.colorMode === "all") {
          for (let row = 0; row < this.ROWS; row++) {
            for (let col = 0; col < this.COLS; col++) {
              const p = this.grid[row][col];
              p.r = r;
              p.g = g;
              p.b = b;
            }
          }
          (this as any).render();
        } else if (this.selected) {
          const points = this.selectedPoints.length ? this.selectedPoints : [this.selected];
          for (const selectedPoint of points) {
            const p = this.grid[selectedPoint.row]?.[selectedPoint.col];
            if (!p) continue;
            p.r = r;
            p.g = g;
            p.b = b;
          }
          (this as any).render();
        }
      },
    );

    this.resizeObserver = new ResizeObserver(() => (this as any).resize());
  }

  initGL() {
    const gl =
      (this.glCanvas.getContext("webgl", {
        preserveDrawingBuffer: true,
      }) as WebGLRenderingContext | null) ||
      (this.glCanvas.getContext("experimental-webgl", {
        preserveDrawingBuffer: true,
      }) as WebGLRenderingContext | null);
    if (!gl) {
      alert("WebGL not supported");
      throw new Error("WebGL not supported");
    }
    this.gl = gl;
    const VS = `attribute vec2 a_pos;attribute vec3 a_col;varying vec3 v_col;
      void main(){gl_Position=vec4(a_pos.x*2.-1.,1.-a_pos.y*2.,0.,1.);v_col=a_col;}`;
    const FS = `precision mediump float;varying vec3 v_col;
      void main(){gl_FragColor=vec4(v_col,1.);}`;
    this.prog = createProgram(gl, VS, FS);
    this.aPos = gl.getAttribLocation(this.prog, "a_pos");
    this.aCol = gl.getAttribLocation(this.prog, "a_col");
    this.posBuf = gl.createBuffer();
    this.colBuf = gl.createBuffer();
  }

  initPoints() {
    this.grid = createInitialGrid(this.ROWS, this.COLS);
    this.displayGrid = this.grid;
  }

  initFlowModeGrid(modeIndex = this.defaultFlowModeIndex) {
    this.flowModeGrid = createFlowModeGrid(this.ROWS, this.COLS, modeIndex);
  }

  initAreaFlowMenu() {
    const buttons = this.flowModes.map((mode, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn";
      button.dataset.flowModeIndex = String(index);
      button.textContent = mode.label;
      return button;
    });
    this.areaFlowMenuOptions.replaceChildren(...buttons);
    this.areaFlowMenu.hidden = true;
  }

  syncGridDimensions() {
    this.ROWS = this.grid.length;
    this.COLS = this.grid[0]?.length ?? 0;
    this.displayGrid = this.grid;
    this.flowRuntimeGrid = [];
    this.areaFlowControls = [];
  }
}

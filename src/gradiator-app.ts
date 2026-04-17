import { ASPECT_MODES, FLOW_MODES } from "./gradiator/config";
import { ColorPicker } from "./gradiator/color-picker";
import {
  buildFlowGridLines as buildFlowGridLinesFromEngine,
  buildFlowRuntime as buildFlowRuntimeFromEngine,
  sampleFieldForMode,
  sampleFlowDirectionForMode,
  sampleFlowSource as sampleFlowSourceFromEngine,
  sampleModeVector as sampleModeVectorFromEngine,
  traceFlowLine as traceFlowLineFromEngine,
} from "./gradiator/flow-engine";
import {
  addGridPointAt,
  createInitialGrid,
  findGridPointAt,
  getGridPoint,
  removeGridPoint,
} from "./gradiator/model/grid-model";
import {
  sampleInterpolatedField as sampleInterpolatedFieldFromGrid,
  sampleLinearField as sampleLinearFieldFromGrid,
  sampleSmoothField as sampleSmoothFieldFromGrid,
  sampleTensorDirection as sampleTensorDirectionFromSampler,
} from "./gradiator/model/field-sampler";
import {
  downloadCanvasAsPng,
  buildAreaFlowControls,
  renderGlMesh,
  renderOverlayCanvas,
  renderPreviewCanvas,
} from "./gradiator/render-engine";
import {
  collapseFlowModeGridForPointRemoval,
  createFlowModeGrid,
  fillFlowModeGrid,
  getFlowAreaIndex,
  normalizeFlowModeGrid,
  splitFlowModeGrid,
} from "./gradiator/model/flow-mode-grid";
import { parseGradiatorState, serializeGradiatorState } from "./gradiator/state-persistence";
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
  PreviewDragState,
} from "./gradiator/types";
import { hslToRgb } from "./utils/color.js";
import { colorBilerp } from "./utils/interpolation.js";
import { clamp } from "./utils/math.js";
import { createProgram } from "./utils/webgl.js";
export type { GradiatorAppElements } from "./gradiator/types";

class GradiatorApp {
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
  readonly flowButton: HTMLButtonElement;
  readonly aspectButton: HTMLButtonElement;
  readonly animateButton: HTMLButtonElement;
  readonly colorButton: HTMLButtonElement;
  readonly randomizeButton: HTMLButtonElement;
  readonly exportButton: HTMLButtonElement;
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
  fullView = false;
  defaultFlowModeIndex = 2;
  aspectModeIndex = 3;
  lastSerializedState = "";
  grid: GradientPoint[][] = [];
  displayGrid: GradientPoint[][] = [];
  flowModeGrid: number[][] = [];
  selected: GridIndex | null = null;
  dragging: GridIndex | null = null;
  hovered: GridIndex | null = null;
  activeAreaFlowControl: GridAreaIndex | null = null;
  hoveredAreaFlowControl: GridAreaIndex | null = null;
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
  animationFrame: number | null = null;

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
    this.flowButton = elements.flowButton;
    this.aspectButton = elements.aspectButton;
    this.animateButton = elements.animateButton;
    this.colorButton = elements.colorButton;
    this.randomizeButton = elements.randomizeButton;
    this.exportButton = elements.exportButton;
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
          this.render();
        } else if (this.selected) {
          const p = this.grid[this.selected.row][this.selected.col];
          p.r = r;
          p.g = g;
          p.b = b;
          this.render();
        }
      }
    );

    this.initAreaFlowMenu();
    this.initGL();
    this.initPoints();
    this.initFlowModeGrid();
    this.setDefaultFlowMode(this.defaultFlowModeIndex);
    this.restoreStateFromUrl();
    this.applyAspectMode(this.aspectModeIndex);
    this.setPointAnimationEnabled(false);
    this.setupEvents();
    this.setupButtons();
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resizeObserver.observe(this.previewFrame);
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

  setDefaultFlowMode(index) {
    const safeIndex = clamp(index, 0, this.flowModes.length - 1);
    this.defaultFlowModeIndex = safeIndex;
    const mode = this.flowModes[this.defaultFlowModeIndex];
    if (this.flowButton) this.flowButton.textContent = `Flow All: ${mode.label}`;
  }

  applyFlowModeToAll(index) {
    this.setDefaultFlowMode(index);
    fillFlowModeGrid(this.flowModeGrid, this.defaultFlowModeIndex);
    this.updateAreaFlowMenuButtons();
  }

  getFlowMode(index) {
    const safeIndex = clamp(index, 0, this.flowModes.length - 1);
    return this.flowModes[safeIndex] || this.flowModes[0];
  }

  getAreaFlowModeIndex(row: number, col: number) {
    return this.flowModeGrid[row]?.[col] ?? this.defaultFlowModeIndex;
  }

  getAreaFlowMode(row: number, col: number) {
    return this.getFlowMode(this.getAreaFlowModeIndex(row, col));
  }

  currentAspectMode() {
    return this.aspectModes[this.aspectModeIndex] || this.aspectModes[this.aspectModes.length - 1];
  }

  applyAspectMode(index, shouldResize = false) {
    const safeIndex = clamp(index, 0, this.aspectModes.length - 1);
    this.aspectModeIndex = safeIndex;
    const mode = this.currentAspectMode();
    if (this.aspectButton) this.aspectButton.textContent = `Aspect: ${mode.label}`;
    if (shouldResize) this.resize();
  }

  cycleAspectMode() {
    this.applyAspectMode((this.aspectModeIndex + 1) % this.aspectModes.length, true);
  }

  findAspectModeIndex(key) {
    return this.aspectModes.findIndex((mode) => mode.key === key);
  }

  getCurrentAspectRatio() {
    const mode = this.currentAspectMode();
    if (mode.ratio !== null) return mode.ratio;
    const width = Math.max(1, this.container.clientWidth || window.innerWidth || 1);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight || 1);
    return width / height;
  }

  getDisplayGrid() {
    return this.displayGrid.length ? this.displayGrid : this.grid;
  }

  getDisplayPoint(row: number, col: number) {
    return this.getDisplayGrid()[row]?.[col] ?? this.grid[row][col];
  }

  isCornerPoint(row: number, col: number) {
    const lastRow = this.ROWS - 1;
    const lastCol = this.COLS - 1;
    return (row === 0 || row === lastRow) && (col === 0 || col === lastCol);
  }

  getPointAnimationOffset(row: number, col: number, timeMs = this.animationTimeMs) {
    if (!this.animatePoints || this.isCornerPoint(row, col) || !this.W || !this.H) {
      return { x: 0, y: 0 };
    }

    const horizontalFreedom = col > 0 && col < this.COLS - 1 ? 1 : 0.24;
    const verticalFreedom = row > 0 && row < this.ROWS - 1 ? 1 : 0.24;
    const spanX = this.W / Math.max(1, this.COLS - 1);
    const spanY = this.H / Math.max(1, this.ROWS - 1);
    const amplitudeX = (clamp(spanX * 0.22, 5, 18) * horizontalFreedom) / Math.max(1, this.W);
    const amplitudeY = (clamp(spanY * 0.22, 5, 18) * verticalFreedom) / Math.max(1, this.H);
    const time = timeMs * 0.001;
    const phase = row * 1.73 + col * 2.11;
    const secondaryPhase = row * 2.41 - col * 1.37;
    const speedX = 0.52 + ((row + col) % 5) * 0.07;
    const speedY = 0.64 + ((row * 2 + col) % 4) * 0.06;

    return {
      x:
        amplitudeX *
        (Math.sin(time * speedX * Math.PI * 2 + phase) * 0.7 +
          Math.cos(time * speedX * Math.PI + secondaryPhase) * 0.3),
      y:
        amplitudeY *
        (Math.cos(time * speedY * Math.PI * 2 + secondaryPhase) * 0.7 +
          Math.sin(time * speedY * Math.PI + phase) * 0.3),
    };
  }

  buildAnimatedGrid(timeMs = this.animationTimeMs) {
    return this.grid.map((row, rowIndex) =>
      row.map((point, colIndex) => {
        const offset = this.getPointAnimationOffset(rowIndex, colIndex, timeMs);
        return {
          x: clamp(point.x + offset.x, 0, 1),
          y: clamp(point.y + offset.y, 0, 1),
          r: point.r,
          g: point.g,
          b: point.b,
        };
      }),
    );
  }

  refreshDisplayGrid(timeMs = this.animationTimeMs) {
    this.displayGrid = this.animatePoints ? this.buildAnimatedGrid(timeMs) : this.grid;
  }

  setPointAnimationEnabled(enabled: boolean) {
    this.animatePoints = Boolean(enabled);
    this.animateButton.classList.toggle("active", this.animatePoints);
    this.animateButton.setAttribute("aria-pressed", String(this.animatePoints));
    this.animateButton.textContent = this.animatePoints ? "Animate: On" : "Animate: Off";

    if (this.animatePoints) {
      this.animationTimeMs = performance.now();
      this.refreshDisplayGrid(this.animationTimeMs);
      if (this.animationFrame === null) {
        this.animationFrame = window.requestAnimationFrame(this._animatePoints);
      }
    } else {
      if (this.animationFrame !== null) {
        window.cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      this.animationTimeMs = 0;
      this.refreshDisplayGrid(0);
    }
  }

  togglePointAnimation() {
    this.setPointAnimationEnabled(!this.animatePoints);
    this.render(false, true);
  }

  _animatePoints = (timeMs: number) => {
    if (!this.animatePoints) {
      this.animationFrame = null;
      return;
    }

    this.animationTimeMs = timeMs;
    this.render(Boolean(this.dragging), false);
    this.animationFrame = window.requestAnimationFrame(this._animatePoints);
  };

  buildFlowRuntimeGrid(grid = this.getDisplayGrid()) {
    const runtimes: FlowRuntime[][] = [];

    for (let row = 0; row < this.ROWS - 1; row++) {
      const runtimeRow: FlowRuntime[] = [];
      for (let col = 0; col < this.COLS - 1; col++) {
        runtimeRow.push(
          buildFlowRuntimeFromEngine([
            [grid[row][col], grid[row][col + 1]],
            [grid[row + 1][col], grid[row + 1][col + 1]],
          ]),
        );
      }
      runtimes.push(runtimeRow);
    }

    return runtimes;
  }

  getFlowRuntime(row: number, col: number) {
    const grid = this.getDisplayGrid();
    return this.flowRuntimeGrid[row]?.[col] ?? buildFlowRuntimeFromEngine(grid);
  }

  getAreaAtPosition(u: number, v: number) {
    return getFlowAreaIndex(this.ROWS, this.COLS, u, v);
  }

  getAreaBounds(area: GridAreaIndex) {
    return {
      uMin: area.col / (this.COLS - 1),
      uMax: (area.col + 1) / (this.COLS - 1),
      vMin: area.row / (this.ROWS - 1),
      vMax: (area.row + 1) / (this.ROWS - 1),
    };
  }

  roundStateValue(value) {
    return Number(value.toFixed(4));
  }

  serializeState() {
    return serializeGradiatorState({
      rows: this.ROWS,
      cols: this.COLS,
      flowModeGrid: this.flowModeGrid,
      aspectModeKey: this.currentAspectMode().key,
      grid: this.grid,
      roundValue: (value) => this.roundStateValue(value),
    });
  }

  syncUrlState() {
    const serialized = this.serializeState();
    if (serialized === this.lastSerializedState) return;
    const url = new URL(window.location.href);
    url.searchParams.set("state", serialized);
    window.history.replaceState(null, "", url);
    this.lastSerializedState = serialized;
  }

  restoreStateFromUrl() {
    const url = new URL(window.location.href);
    const encoded = url.searchParams.get("state");
    if (!encoded) return;
    try {
      const state = parseGradiatorState(encoded);
      if (!state) return;

      this.ROWS = state.rows;
      this.COLS = state.cols;
      this.grid = state.grid;
      this.setDefaultFlowMode(state.flowModeIndex ?? this.defaultFlowModeIndex);
      this.flowModeGrid = normalizeFlowModeGrid(
        state.flowModeGrid,
        this.ROWS,
        this.COLS,
        this.defaultFlowModeIndex,
        this.flowModes.length - 1,
      );
      if (state.aspectModeKey) {
        const aspectModeIndex = this.findAspectModeIndex(state.aspectModeKey);
        if (aspectModeIndex >= 0) this.aspectModeIndex = aspectModeIndex;
      }
      this.updateAreaFlowMenuButtons();
      this.displayGrid = this.grid;
      this.lastSerializedState = encoded;
    } catch (error) {
      console.warn("Failed to restore canvas state from URL", error);
    }
  }

  pt(r, c) {
    return getGridPoint(this.grid, r, c);
  }

  removePointAt(row, col) {
    if (!removeGridPoint(this.grid, row, col)) return false;
    this.flowModeGrid = collapseFlowModeGridForPointRemoval(
      this.flowModeGrid,
      row,
      col,
      this.defaultFlowModeIndex,
    );
    this.syncGridDimensions();
    this.selected = null;
    this.dragging = null;
    this.hovered = null;
    this.hoveredAreaFlowControl = null;
    this.colorPicker.hide();
    this.hideAreaFlowMenu(false);
    this.render();
    return true;
  }

  sampleInterpolatedField(u, v, blend) {
    return sampleInterpolatedFieldFromGrid(this.getDisplayGrid(), u, v, blend);
  }

  sampleModeVector(field, u, v, area: GridAreaIndex | null = this.getAreaAtPosition(u, v)) {
    if (!field || !area) return null;
    return sampleModeVectorFromEngine(this.getFlowRuntime(area.row, area.col), field, u, v);
  }

  sampleFlowSource(u, v, mode, area: GridAreaIndex | null = this.getAreaAtPosition(u, v)) {
    if (!area) return { u, v };
    return sampleFlowSourceFromEngine(
      mode,
      u,
      v,
      (sampleU, sampleV) => this.sampleModeVector(mode.field, sampleU, sampleV, area),
      this.getAreaBounds(area),
    );
  }

  sampleField(u, v) {
    const area = this.getAreaAtPosition(u, v);
    if (!area) return this.sampleInterpolatedField(u, v, this.getFlowMode(this.defaultFlowModeIndex).blend);

    const mode = this.getAreaFlowMode(area.row, area.col);
    return sampleFieldForMode({
      mode,
      u,
      v,
      bounds: this.getAreaBounds(area),
      sampleInterpolatedField: (sampleU, sampleV, blend) =>
        this.sampleInterpolatedField(sampleU, sampleV, blend),
      sampleModeVector: (sampleU, sampleV) => this.sampleModeVector(mode.field, sampleU, sampleV, area),
    });
  }

  sampleLinearField(u, v) {
    return sampleLinearFieldFromGrid(this.getDisplayGrid(), u, v);
  }

  sampleSmoothField(u, v) {
    return sampleSmoothFieldFromGrid(this.getDisplayGrid(), u, v);
  }

  sampleColor(u, v) {
    const p = this.sampleField(u, v);
    return { r: p.r, g: p.g, b: p.b };
  }

  sampleTensorDirection(u, v, orthogonal = false) {
    return sampleTensorDirectionFromSampler(
      (sampleU, sampleV) => this.sampleColor(sampleU, sampleV),
      u,
      v,
      orthogonal,
    );
  }

  sampleFlowDirection(u, v, orthogonal = false) {
    const area = this.getAreaAtPosition(u, v);
    const mode = area ? this.getAreaFlowMode(area.row, area.col) : this.getFlowMode(this.defaultFlowModeIndex);
    return sampleFlowDirectionForMode({
      mode,
      u,
      v,
      orthogonal,
      sampleModeVector: (sampleU, sampleV) => this.sampleModeVector(mode.field, sampleU, sampleV, area),
      sampleTensorDirection: (sampleU, sampleV, isOrthogonal = false) =>
        this.sampleTensorDirection(sampleU, sampleV, isOrthogonal),
    });
  }

  traceFlowLine(seedU, seedV, orthogonal = false, stepSize = 0.012, maxSteps = 120) {
    return traceFlowLineFromEngine(seedU, seedV, {
      orthogonal,
      stepSize,
      maxSteps,
      sampleField: (sampleU, sampleV) => this.sampleField(sampleU, sampleV),
      sampleFlowDirection: (sampleU, sampleV, isOrthogonal = false) =>
        this.sampleFlowDirection(sampleU, sampleV, isOrthogonal),
    });
  }

  buildFlowGridLines() {
    return buildFlowGridLinesFromEngine({
      interactionMode: Boolean(this.dragging),
      sampleField: (sampleU, sampleV) => this.sampleField(sampleU, sampleV),
      sampleFlowDirection: (sampleU, sampleV, orthogonal = false) =>
        this.sampleFlowDirection(sampleU, sampleV, orthogonal),
    });
  }

  getFlowGridLines() {
    if (this.animatePoints) return this.buildFlowGridLines();

    const stateKey = `${this.serializeState()}|${this.W}|${this.H}|${this.dragging ? "drag" : "idle"}`;
    if (!this.flowGridCache || this.flowGridCache.key !== stateKey) {
      this.flowGridCache = { key: stateKey, lines: this.buildFlowGridLines() };
    }
    return this.flowGridCache.lines;
  }

  addPointAt(x, y) {
    const insertedPoint = addGridPointAt({
      grid: this.grid,
      x,
      y,
      width: this.W,
      height: this.H,
      sampleColor: (u, v) => this.sampleColor(u, v),
    });
    if (!insertedPoint) return;
    this.flowModeGrid = splitFlowModeGrid(
      this.flowModeGrid,
      insertedPoint.splitCell.row,
      insertedPoint.splitCell.col,
      this.defaultFlowModeIndex,
    );
    this.syncGridDimensions();
    this.selected = insertedPoint.insertedPoint;
    this.hideAreaFlowMenu(false);
    this.render();
  }

  render(isDragging = false, syncState = !isDragging) {
    this.refreshDisplayGrid(this.animationTimeMs);
    const displayGrid = this.getDisplayGrid();
    this.flowRuntimeGrid = this.buildFlowRuntimeGrid(displayGrid);
    this.areaFlowControls = buildAreaFlowControls({
      width: this.W,
      height: this.H,
      grid: displayGrid,
      flowModeGrid: this.flowModeGrid,
    });
    this.renderGL(isDragging ? this.SUBS_LO : this.animatePoints ? 20 : this.SUBS_HI, displayGrid);
    this.renderPreview();
    this.renderOverlay(displayGrid);

    if (this.activeAreaFlowControl) {
      const activeControl = this.areaFlowControls.find(
        (control) =>
          control.row === this.activeAreaFlowControl?.row && control.col === this.activeAreaFlowControl?.col,
      );
      if (activeControl) this.positionAreaFlowMenu(activeControl);
    }

    if (syncState) this.syncUrlState();
  }

  renderGL(S, grid = this.getDisplayGrid()) {
    renderGlMesh({
      gl: this.gl,
      program: this.prog,
      aPos: this.aPos,
      aCol: this.aCol,
      posBuf: this.posBuf,
      colBuf: this.colBuf,
      width: this.glCanvas.width,
      height: this.glCanvas.height,
      grid,
      subdivisions: S,
      sampleField: (u, v) => this.sampleField(u, v),
    });
  }

  renderOverlay(grid = this.getDisplayGrid()) {
    renderOverlayCanvas({
      ctx: this.ctx,
      width: this.W,
      height: this.H,
      grid,
      showGrid: this.showGrid,
      flowLines: this.getFlowGridLines(),
      areaFlowControls: this.areaFlowControls,
      activeAreaFlowControl: this.activeAreaFlowControl,
      hoveredAreaFlowControl: this.hoveredAreaFlowControl,
      selected: this.selected,
      dragging: this.dragging,
      hovered: this.hovered,
    });
  }

  renderPreview() {
    renderPreviewCanvas({
      ctx: this.previewCtx,
      targetCanvas: this.preview,
      sourceCanvas: this.glCanvas,
    });
  }

  findAreaFlowControlAt(x: number, y: number) {
    if (!this.showGrid) return null;

    for (let index = this.areaFlowControls.length - 1; index >= 0; index--) {
      const control = this.areaFlowControls[index];
      const dx = x - control.x;
      const dy = y - control.y;
      const hitRadius = control.radius + 6;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) return control;
    }

    return null;
  }

  updateAreaFlowMenuButtons() {
    const activeModeIndex = this.activeAreaFlowControl
      ? this.getAreaFlowModeIndex(this.activeAreaFlowControl.row, this.activeAreaFlowControl.col)
      : null;

    for (const button of this.areaFlowMenuOptions.querySelectorAll<HTMLButtonElement>("button[data-flow-mode-index]")) {
      const modeIndex = Number(button.dataset.flowModeIndex);
      button.classList.toggle("active", modeIndex === activeModeIndex);
    }
  }

  positionAreaFlowMenu(control: AreaFlowControl) {
    this.areaFlowMenu.hidden = false;
    const menuRect = this.areaFlowMenu.getBoundingClientRect();
    const menuWidth = menuRect.width || 180;
    const menuHeight = menuRect.height || 120;
    const desiredLeft = this.imageStage.offsetLeft + control.x + control.radius + 12;
    const desiredTop = this.imageStage.offsetTop + control.y - menuHeight * 0.35;
    const maxLeft = Math.max(0, this.container.clientWidth - menuWidth - 8);
    const maxTop = Math.max(0, this.container.clientHeight - menuHeight - 8);
    const left = maxLeft < 8 ? maxLeft : clamp(desiredLeft, 8, maxLeft);
    const top = maxTop < 8 ? maxTop : clamp(desiredTop, 8, maxTop);

    this.areaFlowMenu.style.left = `${left}px`;
    this.areaFlowMenu.style.top = `${top}px`;
  }

  showAreaFlowMenu(control: AreaFlowControl) {
    this.activeAreaFlowControl = { row: control.row, col: control.col };
    this.areaFlowMenuTitle.textContent = `Area ${control.row + 1}, ${control.col + 1}`;
    this.updateAreaFlowMenuButtons();
    this.positionAreaFlowMenu(control);
    this.renderOverlay();
  }

  hideAreaFlowMenu(shouldRender = true) {
    const hadOpenMenu = !this.areaFlowMenu.hidden || Boolean(this.activeAreaFlowControl);
    this.activeAreaFlowControl = null;
    this.areaFlowMenu.hidden = true;
    if (hadOpenMenu) this.updateAreaFlowMenuButtons();
    if (hadOpenMenu && shouldRender) this.renderOverlay();
  }

  setAreaFlowMode(row: number, col: number, index: number) {
    if (!this.flowModeGrid[row]?.length || this.flowModeGrid[row][col] === undefined) return;
    this.flowModeGrid[row][col] = clamp(index, 0, this.flowModes.length - 1);
    this.updateAreaFlowMenuButtons();
  }

  getImageInset() {
    const inset = parseFloat(getComputedStyle(document.body).getPropertyValue("--image-inset"));
    return Number.isFinite(inset) ? inset : 0;
  }

  layoutImageStage() {
    const containerWidth = Math.max(1, this.container.clientWidth);
    const containerHeight = Math.max(1, this.container.clientHeight);
    const inset = this.getImageInset();
    const availableWidth = Math.max(1, containerWidth - inset * 2);
    const availableHeight = Math.max(1, containerHeight - inset * 2);
    const aspectRatio = this.getCurrentAspectRatio();

    let stageWidth = availableWidth;
    let stageHeight = stageWidth / aspectRatio;

    if (stageHeight > availableHeight) {
      stageHeight = availableHeight;
      stageWidth = stageHeight * aspectRatio;
    }

    const left = (containerWidth - stageWidth) / 2;
    const top = (containerHeight - stageHeight) / 2;

    this.imageStage.style.left = `${left}px`;
    this.imageStage.style.top = `${top}px`;
    this.imageStage.style.width = `${stageWidth}px`;
    this.imageStage.style.height = `${stageHeight}px`;
    this.previewFrame.style.setProperty("--preview-frame-aspect", `${stageWidth} / ${stageHeight}`);
  }

  resize() {
    const container = this.container;
    this.layoutImageStage();
    this.W = this.imageStage.clientWidth;
    this.H = this.imageStage.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    for (const c of [this.glCanvas, this.ov]) {
      c.width = Math.floor(this.W * dpr);
      c.height = Math.floor(this.H * dpr);
      c.style.width = this.W + "px";
      c.style.height = this.H + "px";
    }
    const previewRect = this.previewFrame.getBoundingClientRect();
    const previewCanvasRect = this.preview.getBoundingClientRect();
    this.preview.width = Math.max(1, Math.floor(previewCanvasRect.width * dpr));
    this.preview.height = Math.max(1, Math.floor(previewCanvasRect.height * dpr));
    if (!this.fullView && this.previewFrame.style.left && this.previewFrame.style.top) {
      const left = parseFloat(this.previewFrame.style.left);
      const top = parseFloat(this.previewFrame.style.top);
      const maxLeft = Math.max(0, container.clientWidth - previewRect.width);
      const maxTop = Math.max(0, container.clientHeight - previewRect.height);
      this.previewFrame.style.left = `${clamp(left, 0, maxLeft)}px`;
      this.previewFrame.style.top = `${clamp(top, 0, maxTop)}px`;
    }
    this.clampFloatingPanel(this.uiControls);
    this.clampFloatingPanel(this.toolbar);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  getMousePos(e) {
    const r = this.ov.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  findPointAt(mx, my, R = 14) {
    return findGridPointAt(this.getDisplayGrid(), this.W, this.H, mx, my, R);
  }

  openPickerFor(rc) {
    this.colorMode = "point";
    const p = this.getDisplayPoint(rc.row, rc.col);
    const basePoint = this.grid[rc.row][rc.col];
    const rect = this.ov.getBoundingClientRect();
    this.colorPicker.show(p.x * this.W + rect.left, p.y * this.H + rect.top, basePoint.r, basePoint.g, basePoint.b);
  }

  openGradientPicker() {
    this.colorMode = "all";
    const p = this.sampleField(0.5, 0.5);
    const rect = this.colorButton.getBoundingClientRect();
    this.colorPicker.show(rect.left + rect.width / 2, rect.bottom + 8, p.r, p.g, p.b);
  }

  _cancelPickerTimer() {
    if (this.pickerTimer !== null) {
      window.clearTimeout(this.pickerTimer);
      this.pickerTimer = null;
    }
  }

  _onOverlayMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    this._cancelPickerTimer();
    const { x, y } = this.getMousePos(e);
    const areaControl = this.findAreaFlowControlAt(x, y);
    if (areaControl) {
      this.colorPicker.hide();
      this.showAreaFlowMenu(areaControl);
      this.ov.style.cursor = "pointer";
      return;
    }

    this.hideAreaFlowMenu(false);
    const hit = this.findPointAt(x, y);
    this.didDrag = false;
    if (hit) {
      this.dragging = hit;
      this.selected = hit;
      this.dragStart = { x, y };
      this.dragPointerOffset = {
        x: this.getDisplayPoint(hit.row, hit.col).x - x / Math.max(1, this.W),
        y: this.getDisplayPoint(hit.row, hit.col).y - y / Math.max(1, this.H),
      };
      this.ov.style.cursor = "grabbing";
    } else {
      this.selected = null;
      this.colorPicker.hide();
    }
    this.renderOverlay();
  };

  _onOverlayMouseMove = (e: MouseEvent) => {
    const { x, y } = this.getMousePos(e);
    if (this.dragging && this.dragPointerOffset && this.dragStart) {
      const draggedPoint = this.grid[this.dragging.row][this.dragging.col];
      const targetX = x / Math.max(1, this.W) + this.dragPointerOffset.x;
      const targetY = y / Math.max(1, this.H) + this.dragPointerOffset.y;
      const animationOffset = this.getPointAnimationOffset(
        this.dragging.row,
        this.dragging.col,
        this.animatePoints ? performance.now() : 0,
      );
      const dx = x - this.dragStart.x;
      const dy = y - this.dragStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.didDrag = true;
      draggedPoint.x = clamp(targetX - animationOffset.x, 0, 1);
      draggedPoint.y = clamp(targetY - animationOffset.y, 0, 1);
      this.render(true, false);
    } else {
      const areaControl = this.findAreaFlowControlAt(x, y);
      const hoveredPoint = areaControl ? null : this.findPointAt(x, y);
      const samePoint =
        (!hoveredPoint && !this.hovered) ||
        (Boolean(hoveredPoint) &&
          Boolean(this.hovered) &&
          hoveredPoint?.row === this.hovered?.row &&
          hoveredPoint?.col === this.hovered?.col);
      const nextHoveredArea = areaControl ? { row: areaControl.row, col: areaControl.col } : null;
      const sameArea =
        (!nextHoveredArea && !this.hoveredAreaFlowControl) ||
        (Boolean(nextHoveredArea) &&
          Boolean(this.hoveredAreaFlowControl) &&
          nextHoveredArea?.row === this.hoveredAreaFlowControl?.row &&
          nextHoveredArea?.col === this.hoveredAreaFlowControl?.col);

      if (!samePoint || !sameArea) {
        this.hovered = hoveredPoint;
        this.hoveredAreaFlowControl = nextHoveredArea;
        this.ov.style.cursor = areaControl ? "pointer" : hoveredPoint ? "grab" : "crosshair";
        this.renderOverlay();
      }
    }
  };

  _onOverlayMouseUp = () => {
    if (!this.dragging) return;
    const rc = this.dragging;
    if (!this.didDrag) {
      this.pickerTimer = window.setTimeout(() => {
        this.pickerTimer = null;
        this.openPickerFor(rc);
      }, 220);
    } else {
      this.render(false);
    }
    this.dragging = null;
    this.dragStart = null;
    this.dragPointerOffset = null;
    this.ov.style.cursor = this.hoveredAreaFlowControl
      ? "pointer"
      : this.hovered
        ? "grab"
        : "crosshair";
  };

  _onOverlayDoubleClick = (e: MouseEvent) => {
    this._cancelPickerTimer();
    const { x, y } = this.getMousePos(e);
    const areaControl = this.findAreaFlowControlAt(x, y);
    if (areaControl) return;
    const hit = this.findPointAt(x, y);
    if (hit) {
      if (e.altKey) {
        this.selected = hit;
        this.openPickerFor(hit);
        this.renderOverlay();
      } else {
        this.removePointAt(hit.row, hit.col);
      }
    } else {
      this.colorPicker.hide();
      this.selected = null;
      this.addPointAt(x, y);
    }
  };

  _onOverlayMouseLeave = () => {
    if (this.dragging) {
      this.dragging = null;
      this.dragStart = null;
      this.dragPointerOffset = null;
      this.render(false);
    }
    this.hovered = null;
    this.hoveredAreaFlowControl = null;
    this.ov.style.cursor = "crosshair";
    this.renderOverlay();
  };

  _onAreaFlowMenuMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
  };

  _onAreaFlowMenuClick = (e: MouseEvent) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLButtonElement>("button[data-flow-mode-index]");
    if (!button || !this.activeAreaFlowControl) return;

    const modeIndex = Number(button.dataset.flowModeIndex);
    if (!Number.isInteger(modeIndex)) return;

    this.setAreaFlowMode(this.activeAreaFlowControl.row, this.activeAreaFlowControl.col, modeIndex);
    this.render();
  };

  _onDocumentMouseDown = (e: MouseEvent) => {
    if (this.areaFlowMenu.hidden) return;
    const target = e.target;
    if (target instanceof Node && this.areaFlowMenu.contains(target)) return;
    if (target === this.ov) return;
    this.hideAreaFlowMenu();
  };

  _onDocumentKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      this._cancelPickerTimer();
      this._stopPanelDrag();
      this._stopPreviewDrag();
      this.dragStart = null;
      this.dragPointerOffset = null;
      this.dragging = null;
      this.hovered = null;
      this.hoveredAreaFlowControl = null;
      this.colorPicker.hide();
      this.hideAreaFlowMenu(false);
      this.selected = null;
      this.ov.style.cursor = "crosshair";
      if (this.fullView) this.toggleFullView();
      this.renderOverlay();
    }
  };

  setupEvents() {
    this.ov.addEventListener("mousedown", this._onOverlayMouseDown);
    this.ov.addEventListener("mousemove", this._onOverlayMouseMove);
    this.ov.addEventListener("mouseup", this._onOverlayMouseUp);
    this.ov.addEventListener("dblclick", this._onOverlayDoubleClick);
    this.ov.addEventListener("mouseleave", this._onOverlayMouseLeave);
    this.areaFlowMenu.addEventListener("mousedown", this._onAreaFlowMenuMouseDown);
    this.areaFlowMenuOptions.addEventListener("click", this._onAreaFlowMenuClick);
    document.addEventListener("mousedown", this._onDocumentMouseDown);
    document.addEventListener("keydown", this._onDocumentKeyDown);
  }

  _onGridButtonClick = () => {
    this.showGrid = !this.showGrid;
    this.gridButton.classList.toggle("active", this.showGrid);
    if (!this.showGrid) this.hideAreaFlowMenu(false);
    this.renderOverlay();
  };

  _onUiMoveMouseDown = (e: MouseEvent) => {
    this.startPanelDrag(e, this.uiControls, this.uiMoveButton);
  };

  _onToolbarMoveMouseDown = (e: MouseEvent) => {
    this.startPanelDrag(e, this.toolbar, this.toolbarMoveButton);
  };

  _onBorderToggleClick = () => {
    this.toggleBorder();
  };

  _onUiToggleClick = () => {
    this.toggleUi();
  };

  _onFlowButtonClick = () => {
    this.cycleFlowMode();
  };

  _onAspectButtonClick = () => {
    this.cycleAspectMode();
  };

  _onAnimateButtonClick = () => {
    this.togglePointAnimation();
  };

  _onRandomizeButtonClick = () => {
    this.randomizeColors();
  };

  _onColorButtonClick = () => {
    this.openGradientPicker();
  };

  _onPreviewViewClick = () => {
    this.toggleFullView();
  };

  _onPreviewMoveMouseDown = (e: MouseEvent) => {
    this.startPreviewDrag(e);
  };

  _onExportButtonClick = () => {
    this.exportPng();
  };

  setupButtons() {
    this.gridButton.addEventListener("click", this._onGridButtonClick);
    this.uiMoveButton.addEventListener("mousedown", this._onUiMoveMouseDown);
    this.toolbarMoveButton.addEventListener("mousedown", this._onToolbarMoveMouseDown);
    this.borderToggleButton.addEventListener("click", this._onBorderToggleClick);
    this.uiToggleButton.addEventListener("click", this._onUiToggleClick);
    this.flowButton.addEventListener("click", this._onFlowButtonClick);
    this.aspectButton.addEventListener("click", this._onAspectButtonClick);
    this.animateButton.addEventListener("click", this._onAnimateButtonClick);
    this.randomizeButton.addEventListener("click", this._onRandomizeButtonClick);
    this.colorButton.addEventListener("click", this._onColorButtonClick);
    this.previewViewBtn.addEventListener("click", this._onPreviewViewClick);
    this.previewMoveBtn.addEventListener("mousedown", this._onPreviewMoveMouseDown);
    this.exportButton.addEventListener("click", this._onExportButtonClick);
  }

  setUiHidden(hidden) {
    this.uiHidden = Boolean(hidden);
    if (this.uiHidden) {
      this._stopPanelDrag();
      this._stopPreviewDrag();
      this.colorPicker.hide();
      this.hideAreaFlowMenu(false);
    }
    document.body.classList.toggle("ui-hidden", this.uiHidden);
    this.uiToggleButton.classList.toggle("active", this.uiHidden);
    this.uiToggleButton.setAttribute("aria-pressed", String(this.uiHidden));
    this.uiToggleButton.textContent = this.uiHidden ? "Show UI" : "Hide UI";
  }

  toggleUi() {
    this.setUiHidden(!this.uiHidden);
  }

  setBorderHidden(hidden) {
    this.borderHidden = Boolean(hidden);
    document.body.classList.toggle("border-hidden", this.borderHidden);
    this.borderToggleButton.classList.toggle("active", this.borderHidden);
    this.borderToggleButton.setAttribute("aria-pressed", String(this.borderHidden));
    this.borderToggleButton.textContent = this.borderHidden ? "Show Border" : "Hide Border";
    this.resize();
  }

  toggleBorder() {
    this.setBorderHidden(!this.borderHidden);
  }

  cycleFlowMode() {
    this.applyFlowModeToAll((this.defaultFlowModeIndex + 1) % this.flowModes.length);
    this.render();
  }

  toggleFullView() {
    this._stopPreviewDrag();
    this.hideAreaFlowMenu(false);
    this.fullView = !this.fullView;
    document.body.classList.toggle("preview-full", this.fullView);
    const btn = this.previewViewBtn;
    btn.classList.toggle("active", this.fullView);
    btn.textContent = this.fullView ? "⤡" : "⤢";
    if (this.fullView) {
      this.previewDockedStyle = {
        left: this.previewFrame.style.left,
        top: this.previewFrame.style.top,
        right: this.previewFrame.style.right,
        bottom: this.previewFrame.style.bottom,
      };
      this.previewFrame.style.left = "";
      this.previewFrame.style.top = "";
      this.previewFrame.style.right = "";
      this.previewFrame.style.bottom = "";
    } else if (this.previewDockedStyle) {
      this.previewFrame.style.left = this.previewDockedStyle.left;
      this.previewFrame.style.top = this.previewDockedStyle.top;
      this.previewFrame.style.right = this.previewDockedStyle.right;
      this.previewFrame.style.bottom = this.previewDockedStyle.bottom;
    }
    this.resize();
  }

  startPanelDrag(e, element, handle) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = element.getBoundingClientRect();
    this.panelDragging = {
      element,
      handle,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    handle.classList.add("active");
    window.addEventListener("mousemove", this._movePanel);
    window.addEventListener("mouseup", this._stopPanelDrag);
  }

  clampFloatingPanel(element) {
    if (!element.style.left || !element.style.top) return;
    const maxLeft = Math.max(0, this.container.clientWidth - element.offsetWidth);
    const maxTop = Math.max(0, this.container.clientHeight - element.offsetHeight);
    const left = clamp(parseFloat(element.style.left), 0, maxLeft);
    const top = clamp(parseFloat(element.style.top), 0, maxTop);
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  }

  _movePanel = (e) => {
    if (!this.panelDragging) return;
    const { element, offsetX, offsetY } = this.panelDragging;
    const containerRect = this.container.getBoundingClientRect();
    const maxLeft = Math.max(0, containerRect.width - element.offsetWidth);
    const maxTop = Math.max(0, containerRect.height - element.offsetHeight);
    const left = clamp(e.clientX - containerRect.left - offsetX, 0, maxLeft);
    const top = clamp(e.clientY - containerRect.top - offsetY, 0, maxTop);
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.right = "auto";
    element.style.bottom = "auto";
  };

  _stopPanelDrag = () => {
    if (!this.panelDragging) return;
    this.panelDragging.handle.classList.remove("active");
    this.panelDragging = null;
    window.removeEventListener("mousemove", this._movePanel);
    window.removeEventListener("mouseup", this._stopPanelDrag);
  };

  startPreviewDrag(e) {
    if (this.fullView || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const frameRect = this.previewFrame.getBoundingClientRect();
    this.previewDragging = {
      offsetX: e.clientX - frameRect.left,
      offsetY: e.clientY - frameRect.top,
      container: this.container,
    };
    this.previewMoveBtn.classList.add("active");
    window.addEventListener("mousemove", this._movePreviewFrame);
    window.addEventListener("mouseup", this._stopPreviewDrag);
  }

  _movePreviewFrame = (e) => {
    if (!this.previewDragging) return;
    const { container, offsetX, offsetY } = this.previewDragging;
    const containerRect = container.getBoundingClientRect();
    const frameRect = this.previewFrame.getBoundingClientRect();
    const maxLeft = Math.max(0, containerRect.width - frameRect.width);
    const maxTop = Math.max(0, containerRect.height - frameRect.height);
    const left = clamp(e.clientX - containerRect.left - offsetX, 0, maxLeft);
    const top = clamp(e.clientY - containerRect.top - offsetY, 0, maxTop);
    this.previewFrame.style.left = `${left}px`;
    this.previewFrame.style.top = `${top}px`;
    this.previewFrame.style.right = "auto";
    this.previewFrame.style.bottom = "auto";
    this.previewDockedStyle = {
      left: this.previewFrame.style.left,
      top: this.previewFrame.style.top,
      right: this.previewFrame.style.right,
      bottom: this.previewFrame.style.bottom,
    };
  };

  _stopPreviewDrag = () => {
    if (!this.previewDragging) return;
    this.previewDragging = null;
    this.previewMoveBtn.classList.remove("active");
    window.removeEventListener("mousemove", this._movePreviewFrame);
    window.removeEventListener("mouseup", this._stopPreviewDrag);
  };

  randomizeColors() {
    this.colorPicker.hide();
    this.selected = null;
    const base = Math.random() * 360;
    const spread = 80 + Math.random() * 40;
    const TL = hslToRgb(base % 360, 75 + Math.random() * 20, 38 + Math.random() * 14);
    const TR = hslToRgb((base + spread) % 360, 75 + Math.random() * 20, 38 + Math.random() * 14);
    const BL = hslToRgb((base + spread * 2) % 360, 70 + Math.random() * 20, 38 + Math.random() * 14);
    const BR = hslToRgb((base + spread * 3) % 360, 70 + Math.random() * 20, 38 + Math.random() * 14);
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const u = c / (this.COLS - 1);
        const v = r / (this.ROWS - 1);
        const col = colorBilerp(TL, TR, BL, BR, u, v);
        const p = this.grid[r][c];
        p.r = col.r;
        p.g = col.g;
        p.b = col.b;
      }
    }
    this.render();
  }

  exportPng() {
    this.refreshDisplayGrid(this.animatePoints ? performance.now() : this.animationTimeMs);
    this.renderGL(this.SUBS_HI, this.getDisplayGrid());
    downloadCanvasAsPng(this.glCanvas);
  }

  destroy() {
    this._cancelPickerTimer();
    this._stopPanelDrag();
    this._stopPreviewDrag();
    this.setPointAnimationEnabled(false);

    this.ov.removeEventListener("mousedown", this._onOverlayMouseDown);
    this.ov.removeEventListener("mousemove", this._onOverlayMouseMove);
    this.ov.removeEventListener("mouseup", this._onOverlayMouseUp);
    this.ov.removeEventListener("dblclick", this._onOverlayDoubleClick);
    this.ov.removeEventListener("mouseleave", this._onOverlayMouseLeave);
    this.areaFlowMenu.removeEventListener("mousedown", this._onAreaFlowMenuMouseDown);
    this.areaFlowMenuOptions.removeEventListener("click", this._onAreaFlowMenuClick);
    document.removeEventListener("mousedown", this._onDocumentMouseDown);
    document.removeEventListener("keydown", this._onDocumentKeyDown);

    this.gridButton.removeEventListener("click", this._onGridButtonClick);
    this.uiMoveButton.removeEventListener("mousedown", this._onUiMoveMouseDown);
    this.toolbarMoveButton.removeEventListener("mousedown", this._onToolbarMoveMouseDown);
    this.borderToggleButton.removeEventListener("click", this._onBorderToggleClick);
    this.uiToggleButton.removeEventListener("click", this._onUiToggleClick);
    this.flowButton.removeEventListener("click", this._onFlowButtonClick);
    this.aspectButton.removeEventListener("click", this._onAspectButtonClick);
    this.animateButton.removeEventListener("click", this._onAnimateButtonClick);
    this.randomizeButton.removeEventListener("click", this._onRandomizeButtonClick);
    this.colorButton.removeEventListener("click", this._onColorButtonClick);
    this.previewViewBtn.removeEventListener("click", this._onPreviewViewClick);
    this.previewMoveBtn.removeEventListener("mousedown", this._onPreviewMoveMouseDown);
    this.exportButton.removeEventListener("click", this._onExportButtonClick);

    this.resizeObserver.disconnect();
    this.hideAreaFlowMenu(false);
    this.colorPicker.hide();
    this.colorPicker.destroy();
    this.selected = null;
    this.dragging = null;
    this.dragStart = null;
    this.dragPointerOffset = null;
    this.hovered = null;
    this.hoveredAreaFlowControl = null;
    this.ov.style.cursor = "crosshair";
    document.body.classList.remove("ui-hidden", "border-hidden", "preview-full");
  }
}

export function bootGradiatorApp(elements: GradiatorAppElements) {
  return new GradiatorApp(elements);
}

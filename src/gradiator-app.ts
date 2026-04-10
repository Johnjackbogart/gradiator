import { hexToRgb, hslToRgb, hsvToRgb, rgbToHex, rgbToHsv } from "./utils/color.js";
import { bilerp, colorBilerp, inverseBilinear, mixPoint } from "./utils/interpolation.js";
import { clamp, catmullRom, fract, lerp, normalizeVector } from "./utils/math.js";
import { fractalNoise2D } from "./utils/noise.js";
import { decodeUrlState, encodeUrlState } from "./utils/url-state.js";
import { createProgram } from "./utils/webgl.js";

type GradientPoint = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
};

type GridIndex = {
  row: number;
  col: number;
};

type Point2D = {
  x: number;
  y: number;
};

type FlowMode = {
  label: string;
  blend: number;
  kind: "blend" | "advect";
  field?: "directional" | "radial" | "swirl" | "attractor" | "turbulence";
  strength?: number;
  steps?: number;
};

type AspectMode = {
  key: "square" | "classic" | "widescreen" | "browser";
  label: "1:1" | "4:3" | "16:9" | "Browser";
  ratio: number | null;
};

type FlowRuntime = {
  center: Point2D;
  attractor: Point2D;
  direction: { du: number; dv: number };
  normal: { du: number; dv: number };
  noiseScale: number;
  noiseOffsetX: number;
  noiseOffsetY: number;
};

type FlowLinePoint = Point2D;

type FlowGridLines = {
  along: FlowLinePoint[][];
  across: FlowLinePoint[][];
};

type PanelDragState = {
  element: HTMLDivElement;
  handle: HTMLButtonElement;
  offsetX: number;
  offsetY: number;
};

type PreviewDragState = {
  offsetX: number;
  offsetY: number;
  container: HTMLDivElement;
};

type DockedStyle = {
  left: string;
  top: string;
  right: string;
  bottom: string;
};

type ColorPickerElements = {
  panel: HTMLDivElement;
  svWrap: HTMLDivElement;
  svCanvas: HTMLCanvasElement;
  svCursor: HTMLDivElement;
  hueSlider: HTMLInputElement;
  hexInput: HTMLInputElement;
  swatch: HTMLDivElement;
};

export type GradiatorAppElements = {
  container: HTMLDivElement;
  imageStage: HTMLDivElement;
  glCanvas: HTMLCanvasElement;
  overlayCanvas: HTMLCanvasElement;
  previewCanvas: HTMLCanvasElement;
  uiControls: HTMLDivElement;
  uiMoveButton: HTMLButtonElement;
  toolbar: HTMLDivElement;
  toolbarMoveButton: HTMLButtonElement;
  previewFrame: HTMLDivElement;
  previewMoveButton: HTMLButtonElement;
  previewViewButton: HTMLButtonElement;
  borderToggleButton: HTMLButtonElement;
  uiToggleButton: HTMLButtonElement;
  gridButton: HTMLButtonElement;
  flowButton: HTMLButtonElement;
  aspectButton: HTMLButtonElement;
  colorButton: HTMLButtonElement;
  randomizeButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  colorPickerPanel: HTMLDivElement;
  colorPickerSvWrap: HTMLDivElement;
  colorPickerSvCanvas: HTMLCanvasElement;
  colorPickerSvCursor: HTMLDivElement;
  colorPickerHue: HTMLInputElement;
  colorPickerHex: HTMLInputElement;
  colorPickerSwatch: HTMLDivElement;
};

class ColorPicker {
  readonly onChange: (r: number, g: number, b: number) => void;
  h = 0;
  s = 1;
  v = 1;
  visible = false;
  svDragging = false;
  readonly panel: HTMLDivElement;
  readonly svWrap: HTMLDivElement;
  readonly svCanvas: HTMLCanvasElement;
  readonly svCtx: CanvasRenderingContext2D;
  readonly svCursor: HTMLDivElement;
  readonly hueSlider: HTMLInputElement;
  readonly hexInput: HTMLInputElement;
  readonly swatch: HTMLDivElement;

  constructor(elements: ColorPickerElements, onChange: (r: number, g: number, b: number) => void) {
    this.onChange = onChange;
    this.panel = elements.panel;
    this.svWrap = elements.svWrap;
    this.svCanvas = elements.svCanvas;
    this.svCursor = elements.svCursor;
    this.hueSlider = elements.hueSlider;
    this.hexInput = elements.hexInput;
    this.swatch = elements.swatch;

    const svCtx = this.svCanvas.getContext("2d");
    if (!svCtx) {
      throw new Error("Missing color picker canvas context");
    }
    this.svCtx = svCtx;

    this._bind();
  }

  show(screenX, screenY, r, g, b) {
    const hsv = rgbToHsv(r, g, b);
    this.h = hsv.h;
    this.s = hsv.s;
    this.v = hsv.v;
    this.panel.style.display = "block";
    this.visible = true;
    this._refreshAll();
    const PW = 228;
    const PH = 256;
    const M = 12;
    let x = screenX + 22;
    let y = screenY - PH / 2;
    if (x + PW > window.innerWidth - M) x = screenX - PW - 22;
    if (x < M) x = M;
    if (y < M) y = M;
    if (y + PH > window.innerHeight - M) y = window.innerHeight - PH - M;
    this.panel.style.left = x + "px";
    this.panel.style.top = y + "px";
  }

  hide() {
    this.panel.style.display = "none";
    this.visible = false;
  }

  _refreshAll() {
    this._drawSV();
    this._placeCursor();
    this.hueSlider.value = String(this.h);
    this._syncBottom();
  }

  _drawSV() {
    const ctx = this.svCtx;
    const W = this.svCanvas.width;
    const H = this.svCanvas.height;
    const gH = ctx.createLinearGradient(0, 0, W, 0);
    gH.addColorStop(0, "#fff");
    gH.addColorStop(1, `hsl(${this.h},100%,50%)`);
    ctx.fillStyle = gH;
    ctx.fillRect(0, 0, W, H);
    const gV = ctx.createLinearGradient(0, 0, 0, H);
    gV.addColorStop(0, "rgba(0,0,0,0)");
    gV.addColorStop(1, "#000");
    ctx.fillStyle = gV;
    ctx.fillRect(0, 0, W, H);
  }

  _placeCursor() {
    const W = this.svCanvas.offsetWidth || 200;
    const H = this.svCanvas.offsetHeight || 164;
    this.svCursor.style.left = this.s * W + "px";
    this.svCursor.style.top = (1 - this.v) * H + "px";
  }

  _syncBottom() {
    const { r, g, b } = hsvToRgb(this.h, this.s, this.v);
    const hex = rgbToHex(r, g, b);
    this.hexInput.value = hex;
    this.swatch.style.background = hex;
  }

  _emit() {
    const { r, g, b } = hsvToRgb(this.h, this.s, this.v);
    this.onChange(r, g, b);
  }

  _setSVFromClient(cx, cy) {
    const rect = this.svWrap.getBoundingClientRect();
    this.s = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
    this.v = Math.max(0, Math.min(1, 1 - (cy - rect.top) / rect.height));
    this._placeCursor();
    this._syncBottom();
    this._emit();
  }

  destroy() {
    this.svDragging = false;
    this.svWrap.removeEventListener("mousedown", this._onSvWrapMouseDown);
    window.removeEventListener("mousemove", this._onWindowMouseMove);
    window.removeEventListener("mouseup", this._onWindowMouseUp);
    this.hueSlider.removeEventListener("input", this._onHueInput);
    this.hueSlider.removeEventListener("mousedown", this._stopPropagation);
    this.hexInput.removeEventListener("keydown", this._stopPropagation);
    this.hexInput.removeEventListener("change", this._onHexChange);
    this.panel.removeEventListener("mousedown", this._stopPropagation);
  }

  _stopPropagation = (e: Event) => {
    e.stopPropagation();
  };

  _onSvWrapMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.svDragging = true;
    this._setSVFromClient(e.clientX, e.clientY);
  };

  _onWindowMouseMove = (e: MouseEvent) => {
    if (this.svDragging) this._setSVFromClient(e.clientX, e.clientY);
  };

  _onWindowMouseUp = () => {
    this.svDragging = false;
  };

  _onHueInput = () => {
    this.h = parseFloat(this.hueSlider.value);
    this._drawSV();
    this._syncBottom();
    this._emit();
  };

  _onHexChange = () => {
    const val = this.hexInput.value.trim();
    const hex = val.startsWith("#") ? val : "#" + val;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      const { r, g, b } = hexToRgb(hex);
      const hsv = rgbToHsv(r, g, b);
      this.h = hsv.h;
      this.s = hsv.s;
      this.v = hsv.v;
      this.hueSlider.value = String(this.h);
      this._drawSV();
      this._placeCursor();
      this.swatch.style.background = hex;
      this._emit();
    }
  };

  _bind() {
    this.svWrap.addEventListener("mousedown", this._onSvWrapMouseDown);
    window.addEventListener("mousemove", this._onWindowMouseMove);
    window.addEventListener("mouseup", this._onWindowMouseUp);
    this.hueSlider.addEventListener("input", this._onHueInput);
    this.hueSlider.addEventListener("mousedown", this._stopPropagation);
    this.hexInput.addEventListener("keydown", this._stopPropagation);
    this.hexInput.addEventListener("change", this._onHexChange);
    this.panel.addEventListener("mousedown", this._stopPropagation);
  }
}

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
  readonly colorButton: HTMLButtonElement;
  readonly randomizeButton: HTMLButtonElement;
  readonly exportButton: HTMLButtonElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly previewCtx: CanvasRenderingContext2D;
  readonly colorPicker: ColorPicker;
  readonly flowModes: FlowMode[] = [
      { label: "Linear", blend: 0, kind: "blend" },
      { label: "Balanced", blend: 0.5, kind: "blend" },
      { label: "Fluid", blend: 1, kind: "blend" },
      { label: "Directional", blend: 0.88, kind: "advect", field: "directional", strength: 0.16, steps: 3 },
      { label: "Radial", blend: 0.92, kind: "advect", field: "radial", strength: 0.18, steps: 4 },
      { label: "Swirl", blend: 1, kind: "advect", field: "swirl", strength: 0.16, steps: 4 },
      { label: "Attractor", blend: 0.9, kind: "advect", field: "attractor", strength: 0.16, steps: 3 },
      { label: "Turbulence", blend: 1, kind: "advect", field: "turbulence", strength: 0.1, steps: 2 },
    ];
  readonly aspectModes: AspectMode[] = [
      { key: "square", label: "1:1", ratio: 1 },
      { key: "classic", label: "4:3", ratio: 4 / 3 },
      { key: "widescreen", label: "16:9", ratio: 16 / 9 },
      { key: "browser", label: "Browser", ratio: null },
    ];
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
  flowModeIndex = 2;
  aspectModeIndex = 3;
  flowBlend = this.flowModes[this.flowModeIndex].blend;
  lastSerializedState = "";
  grid: GradientPoint[][] = [];
  selected: GridIndex | null = null;
  dragging: GridIndex | null = null;
  hovered: GridIndex | null = null;
  colorMode: "point" | "all" = "point";
  borderHidden = false;
  uiHidden = false;
  panelDragging: PanelDragState | null = null;
  previewDragging: PreviewDragState | null = null;
  previewDockedStyle: DockedStyle | null = null;
  flowGridCache: { key: string; lines: FlowGridLines } | null = null;
  flowRuntime: FlowRuntime | null = null;
  W = 0;
  H = 0;
  dragStart: Point2D | null = null;
  pointStart: Point2D | null = null;
  didDrag = false;
  pickerTimer: number | null = null;

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
    this.colorButton = elements.colorButton;
    this.randomizeButton = elements.randomizeButton;
    this.exportButton = elements.exportButton;

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

    this.applyFlowMode(this.flowModeIndex);
    this.initGL();
    this.initPoints();
    this.restoreStateFromUrl();
    this.applyAspectMode(this.aspectModeIndex);
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
    const grayscaleStops = [0.04, 0.16, 0.32, 0.48, 0.64, 0.8, 0.96];
    this.grid = [];
    for (let row = 0; row < this.ROWS; row++) {
      const r: GradientPoint[] = [];
      for (let col = 0; col < this.COLS; col++) {
        const u = col / (this.COLS - 1);
        const v = row / (this.ROWS - 1);
        const shade = grayscaleStops[Math.floor(Math.random() * grayscaleStops.length)];
        r.push({ x: u, y: v, r: shade, g: shade, b: shade });
      }
      this.grid.push(r);
    }
  }

  applyFlowMode(index) {
    const safeIndex = clamp(index, 0, this.flowModes.length - 1);
    this.flowModeIndex = safeIndex;
    const mode = this.flowModes[this.flowModeIndex];
    this.flowBlend = mode.blend;
    this.flowRuntime = null;
    if (this.flowButton) this.flowButton.textContent = `Flow: ${mode.label}`;
  }

  currentFlowMode() {
    return this.flowModes[this.flowModeIndex] || this.flowModes[0];
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

  averageColumn(col) {
    let x = 0;
    let y = 0;
    for (let row = 0; row < this.ROWS; row++) {
      x += this.grid[row][col].x;
      y += this.grid[row][col].y;
    }
    return { x: x / this.ROWS, y: y / this.ROWS };
  }

  buildFlowRuntime() {
    if (!this.grid.length) {
      return {
        center: { x: 0.5, y: 0.5 },
        attractor: { x: 0.5, y: 0.5 },
        direction: { du: 1, dv: 0 },
        normal: { du: 0, dv: 1 },
        noiseScale: 4.2,
        noiseOffsetX: 0,
        noiseOffsetY: 0,
      };
    }

    const points = this.grid.flat();
    let centerX = 0;
    let centerY = 0;
    let attractX = 0;
    let attractY = 0;
    let attractWeight = 0;
    let chromaSum = 0;
    let seed = 0;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      centerX += p.x;
      centerY += p.y;
      const chroma = Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
      const luminance = 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b;
      const weight = 0.35 + chroma * 1.5 + luminance * 0.6;
      attractX += p.x * weight;
      attractY += p.y * weight;
      attractWeight += weight;
      chromaSum += chroma;
      seed += (i + 1) * (p.x * 13.1 + p.y * 17.9 + p.r * 19.7 + p.g * 23.3 + p.b * 29.9);
    }

    const center = {
      x: centerX / points.length,
      y: centerY / points.length,
    };
    const attractor =
      attractWeight > 1e-6
        ? { x: attractX / attractWeight, y: attractY / attractWeight }
        : center;
    const left = this.averageColumn(0);
    const right = this.averageColumn(this.COLS - 1);
    const direction = normalizeVector(right.x - left.x, right.y - left.y, { du: 1, dv: 0 });
    const normal = { du: -direction.dv, dv: direction.du };
    const meanChroma = chromaSum / points.length;
    const noiseScale = 3.8 + meanChroma * 5.2;

    return {
      center,
      attractor,
      direction,
      normal,
      noiseScale,
      noiseOffsetX: fract(seed * 0.113) * 6.5,
      noiseOffsetY: fract(seed * 0.173) * 6.5,
    };
  }

  getFlowRuntime() {
    if (!this.flowRuntime) this.flowRuntime = this.buildFlowRuntime();
    return this.flowRuntime;
  }

  roundStateValue(value) {
    return Number(value.toFixed(4));
  }

  serializeState() {
    return encodeUrlState({
      v: 2,
      rows: this.ROWS,
      cols: this.COLS,
      flow: this.flowModeIndex,
      aspect: this.currentAspectMode().key,
      points: this.grid.flatMap((row) =>
        row.flatMap((p) => [
          this.roundStateValue(p.x),
          this.roundStateValue(p.y),
          this.roundStateValue(p.r),
          this.roundStateValue(p.g),
          this.roundStateValue(p.b),
        ])
      ),
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
      const state = decodeUrlState(encoded);
      const rows = state?.rows;
      const cols = state?.cols;
      const points = state?.points;
      const aspectModeIndex =
        typeof state?.aspect === "string" ? this.findAspectModeIndex(state.aspect) : -1;
      if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) return;
      if (!Array.isArray(points) || points.length !== rows * cols * 5) return;

      const grid: GradientPoint[][] = [];
      let i = 0;
      for (let row = 0; row < rows; row++) {
        const nextRow: GradientPoint[] = [];
        for (let col = 0; col < cols; col++) {
          const x = points[i++];
          const y = points[i++];
          const r = points[i++];
          const g = points[i++];
          const b = points[i++];
          if (![x, y, r, g, b].every(Number.isFinite)) return;
          nextRow.push({
            x: clamp(x, 0, 1),
            y: clamp(y, 0, 1),
            r: clamp(r, 0, 1),
            g: clamp(g, 0, 1),
            b: clamp(b, 0, 1),
          });
        }
        grid.push(nextRow);
      }

      this.ROWS = rows;
      this.COLS = cols;
      this.grid = grid;
      if (aspectModeIndex >= 0) this.aspectModeIndex = aspectModeIndex;
      this.applyFlowMode(Number.isInteger(state.flow) ? state.flow : this.flowModeIndex);
      this.lastSerializedState = encoded;
    } catch (error) {
      console.warn("Failed to restore canvas state from URL", error);
    }
  }

  pt(r, c) {
    return this.grid[r][c];
  }

  insertRow(afterRow, t = 0.5) {
    const newRow = [];
    for (let c = 0; c < this.COLS; c++) {
      const a = this.grid[afterRow][c];
      const b = this.grid[afterRow + 1][c];
      newRow.push({
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        r: lerp(a.r, b.r, t),
        g: lerp(a.g, b.g, t),
        b: lerp(a.b, b.b, t),
      });
    }
    this.grid.splice(afterRow + 1, 0, newRow);
    this.ROWS++;
  }

  insertCol(afterCol, t = 0.5) {
    for (let r = 0; r < this.ROWS; r++) {
      const a = this.grid[r][afterCol];
      const b = this.grid[r][afterCol + 1];
      this.grid[r].splice(afterCol + 1, 0, {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        r: lerp(a.r, b.r, t),
        g: lerp(a.g, b.g, t),
        b: lerp(a.b, b.b, t),
      });
    }
    this.COLS++;
  }

  removePointAt(row, col) {
    if (this.ROWS <= 2 || this.COLS <= 2) return false;
    this.grid.splice(row, 1);
    for (let r = 0; r < this.grid.length; r++) {
      this.grid[r].splice(col, 1);
    }
    this.ROWS--;
    this.COLS--;
    this.selected = null;
    this.dragging = null;
    this.hovered = null;
    this.colorPicker.hide();
    this.render();
    return true;
  }

  sampleInterpolatedField(u, v, blend = this.flowBlend) {
    const linear = this.sampleLinearField(u, v);
    const smooth = this.sampleSmoothField(u, v);
    return mixPoint(linear, smooth, blend);
  }

  sampleModeVector(field, u, v) {
    const flow = this.getFlowRuntime();
    const dx = u - flow.center.x;
    const dy = v - flow.center.y;

    switch (field) {
      case "directional": {
        const along = dx * flow.direction.du + dy * flow.direction.dv;
        const across = dx * flow.normal.du + dy * flow.normal.dv;
        const curve = clamp(across * 2.3 + Math.sin((along + 0.5) * Math.PI * 2) * 0.28, -1.35, 1.35);
        return normalizeVector(
          flow.direction.du + flow.normal.du * curve,
          flow.direction.dv + flow.normal.dv * curve,
          flow.direction
        );
      }
      case "radial":
        return normalizeVector(dx, dy, flow.direction);
      case "swirl":
        return normalizeVector(-dy + dx * 0.2, dx + dy * 0.2, flow.normal);
      case "attractor":
        return normalizeVector(flow.attractor.x - u, flow.attractor.y - v, flow.direction);
      case "turbulence": {
        const x = u * flow.noiseScale + flow.noiseOffsetX;
        const y = v * flow.noiseScale + flow.noiseOffsetY;
        const e = 0.22;
        const du = fractalNoise2D(x, y + e) - fractalNoise2D(x, y - e);
        const dv = fractalNoise2D(x - e, y) - fractalNoise2D(x + e, y);
        return normalizeVector(du + flow.direction.du * 0.35, dv + flow.direction.dv * 0.35, flow.direction);
      }
      default:
        return null;
    }
  }

  sampleFlowSource(u, v, mode) {
    let su = u;
    let sv = v;
    const steps = Math.max(1, mode.steps || 1);
    const stepSize = (mode.strength || 0) / steps;

    for (let i = 0; i < steps; i++) {
      const dir = this.sampleModeVector(mode.field, su, sv);
      if (!dir) break;
      su = clamp(su - dir.du * stepSize, 0, 1);
      sv = clamp(sv - dir.dv * stepSize, 0, 1);
    }

    return { u: su, v: sv };
  }

  sampleField(u, v) {
    const mode = this.currentFlowMode();
    const base = this.sampleInterpolatedField(u, v, mode.blend);
    if (mode.kind !== "advect") return base;

    const source = this.sampleFlowSource(u, v, mode);
    const flowed = this.sampleInterpolatedField(source.u, source.v, mode.blend);
    return { x: base.x, y: base.y, r: flowed.r, g: flowed.g, b: flowed.b };
  }

  sampleLinearField(u, v) {
    const x = clamp(u * (this.COLS - 1), 0, this.COLS - 1);
    const y = clamp(v * (this.ROWS - 1), 0, this.ROWS - 1);
    const pc = clamp(Math.floor(x), 0, this.COLS - 2);
    const pr = clamp(Math.floor(y), 0, this.ROWS - 2);
    const lu = x - pc;
    const lv = y - pr;
    return bilerp(
      this.pt(pr, pc),
      this.pt(pr, pc + 1),
      this.pt(pr + 1, pc),
      this.pt(pr + 1, pc + 1),
      lu,
      lv
    );
  }

  sampleSmoothField(u, v) {
    const x = clamp(u * (this.COLS - 1), 0, this.COLS - 1);
    const y = clamp(v * (this.ROWS - 1), 0, this.ROWS - 1);
    const pc = clamp(Math.floor(x), 0, this.COLS - 2);
    const pr = clamp(Math.floor(y), 0, this.ROWS - 2);
    const lu = x - pc;
    const lv = y - pr;
    const samplePoint = (r, c) => {
      const rr = clamp(r, 0, this.ROWS - 1);
      const cc = clamp(c, 0, this.COLS - 1);
      return this.grid[rr][cc];
    };

    const cubicBlend = (key) => {
      const rows = [];
      for (let r = -1; r <= 2; r++) {
        const p0 = samplePoint(pr + r, pc - 1)[key];
        const p1 = samplePoint(pr + r, pc)[key];
        const p2 = samplePoint(pr + r, pc + 1)[key];
        const p3 = samplePoint(pr + r, pc + 2)[key];
        rows.push(catmullRom(p0, p1, p2, p3, lu));
      }
      return catmullRom(rows[0], rows[1], rows[2], rows[3], lv);
    };

    return {
      x: clamp(cubicBlend("x"), 0, 1),
      y: clamp(cubicBlend("y"), 0, 1),
      r: clamp(cubicBlend("r"), 0, 1),
      g: clamp(cubicBlend("g"), 0, 1),
      b: clamp(cubicBlend("b"), 0, 1),
    };
  }

  sampleColor(u, v) {
    const p = this.sampleField(u, v);
    return { r: p.r, g: p.g, b: p.b };
  }

  findCellAt(u, v) {
    let best = null;
    const target = { x: u, y: v };
    const tolerance = 0.0012;

    for (let row = 0; row < this.ROWS - 1; row++) {
      for (let col = 0; col < this.COLS - 1; col++) {
        const tl = this.pt(row, col);
        const tr = this.pt(row, col + 1);
        const bl = this.pt(row + 1, col);
        const br = this.pt(row + 1, col + 1);
        const local = inverseBilinear(target, tl, tr, bl, br);
        const inside =
          local.u >= -tolerance &&
          local.u <= 1 + tolerance &&
          local.v >= -tolerance &&
          local.v <= 1 + tolerance;
        if (!inside) continue;
        if (!best || local.error < best.error) {
          best = { row, col, ...local, tl, tr, bl, br };
        }
      }
    }

    return best;
  }

  sampleTensorDirection(u, v, orthogonal = false) {
    const e = 0.014;
    const left = this.sampleColor(clamp(u - e, 0, 1), v);
    const right = this.sampleColor(clamp(u + e, 0, 1), v);
    const top = this.sampleColor(u, clamp(v - e, 0, 1));
    const bottom = this.sampleColor(u, clamp(v + e, 0, 1));

    const dxr = right.r - left.r;
    const dxg = right.g - left.g;
    const dxb = right.b - left.b;
    const dyr = bottom.r - top.r;
    const dyg = bottom.g - top.g;
    const dyb = bottom.b - top.b;

    const a = dxr * dxr + dxg * dxg + dxb * dxb;
    const b = dxr * dyr + dxg * dyg + dxb * dyb;
    const c = dyr * dyr + dyg * dyg + dyb * dyb;
    if (a + c < 1e-5) return null;

    const angle = 0.5 * Math.atan2(2 * b, a - c);
    let du = Math.cos(angle);
    let dv = Math.sin(angle);
    if (orthogonal) [du, dv] = [-dv, du];
    return { du, dv };
  }

  sampleFlowDirection(u, v, orthogonal = false) {
    const mode = this.currentFlowMode();
    if (mode.kind === "advect") {
      const dir = this.sampleModeVector(mode.field, u, v);
      if (dir) {
        if (!orthogonal) return dir;
        return { du: -dir.dv, dv: dir.du };
      }
    }
    return this.sampleTensorDirection(u, v, orthogonal);
  }

  traceFlowLine(seedU, seedV, orthogonal = false, stepSize = 0.012, maxSteps = 120) {
    const trace = (sign) => {
      const pts = [];
      let u = seedU;
      let v = seedV;
      let lastDir = null;

      for (let i = 0; i < maxSteps; i++) {
        if (u < 0 || u > 1 || v < 0 || v > 1) break;
        const p = this.sampleField(u, v);
        pts.push({ x: p.x, y: p.y });

        const dir = this.sampleFlowDirection(u, v, orthogonal);
        if (!dir) break;

        let du = dir.du;
        let dv = dir.dv;
        if (lastDir && du * lastDir.du + dv * lastDir.dv < 0) {
          du *= -1;
          dv *= -1;
        }
        lastDir = { du, dv };
        u += du * stepSize * sign;
        v += dv * stepSize * sign;
      }
      return pts;
    };

    const backward = trace(-1).reverse();
    const forward = trace(1);
    if (backward.length && forward.length) backward.pop();
    return backward.concat(forward);
  }

  buildFlowGridLines() {
    const interactionMode = Boolean(this.dragging);
    const seedCount: number = interactionMode ? 5 : 8;
    const stepSize = interactionMode ? 0.016 : 0.012;
    const maxSteps = interactionMode ? 84 : 120;
    const margin = 0.08;
    const along = [];
    const across = [];

    for (let i = 0; i < seedCount; i++) {
      const t = seedCount === 1 ? 0.5 : i / (seedCount - 1);
      const u = lerp(margin, 1 - margin, t);
      const v = lerp(margin, 1 - margin, t);
      along.push(this.traceFlowLine(margin, v, false, stepSize, maxSteps));
      across.push(this.traceFlowLine(u, margin, true, stepSize, maxSteps));
    }

    return { along, across };
  }

  getFlowGridLines() {
    const stateKey = `${this.serializeState()}|${this.W}|${this.H}|${this.dragging ? "drag" : "idle"}`;
    if (!this.flowGridCache || this.flowGridCache.key !== stateKey) {
      this.flowGridCache = { key: stateKey, lines: this.buildFlowGridLines() };
    }
    return this.flowGridCache.lines;
  }

  drawFlowPath(ctx, line, W, H) {
    if (!line || line.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(line[0].x * W, line[0].y * H);
    for (let i = 1; i < line.length; i++) ctx.lineTo(line[i].x * W, line[i].y * H);
    ctx.stroke();
  }

  addPointAt(x, y) {
    const u = x / this.W;
    const v = y / this.H;
    const cell = this.findCellAt(u, v);
    const color = this.sampleColor(u, v);

    if (!cell) return;

    const inset = 0.06;
    const rowT = clamp(cell.v, inset, 1 - inset);
    const colT = clamp(cell.u, inset, 1 - inset);
    const insertedPoint = bilerp(cell.tl, cell.tr, cell.bl, cell.br, colT, rowT);

    this.insertRow(cell.row, rowT);
    this.insertCol(cell.col, colT);
    const newR = cell.row + 1;
    const newC = cell.col + 1;
    this.grid[newR][newC] = {
      x: insertedPoint.x,
      y: insertedPoint.y,
      r: color.r,
      g: color.g,
      b: color.b,
    };
    this.render();
  }

  buildMesh(S) {
    const nTri = (this.ROWS - 1) * (this.COLS - 1) * S * S * 2;
    const pos = new Float32Array(nTri * 3 * 2);
    const col = new Float32Array(nTri * 3 * 3);
    let pi = 0;
    let ci = 0;
    for (let pr = 0; pr < this.ROWS - 1; pr++) {
      for (let pc = 0; pc < this.COLS - 1; pc++) {
        for (let si = 0; si < S; si++) {
          for (let sj = 0; sj < S; sj++) {
            const u0 = si / S;
            const u1 = (si + 1) / S;
            const v0 = sj / S;
            const v1 = (sj + 1) / S;
            const p00 = this.sampleField((pc + u0) / (this.COLS - 1), (pr + v0) / (this.ROWS - 1));
            const p10 = this.sampleField((pc + u1) / (this.COLS - 1), (pr + v0) / (this.ROWS - 1));
            const p01 = this.sampleField((pc + u0) / (this.COLS - 1), (pr + v1) / (this.ROWS - 1));
            const p11 = this.sampleField((pc + u1) / (this.COLS - 1), (pr + v1) / (this.ROWS - 1));
            pos[pi++] = p00.x;
            pos[pi++] = p00.y;
            pos[pi++] = p10.x;
            pos[pi++] = p10.y;
            pos[pi++] = p11.x;
            pos[pi++] = p11.y;
            col[ci++] = p00.r;
            col[ci++] = p00.g;
            col[ci++] = p00.b;
            col[ci++] = p10.r;
            col[ci++] = p10.g;
            col[ci++] = p10.b;
            col[ci++] = p11.r;
            col[ci++] = p11.g;
            col[ci++] = p11.b;
            pos[pi++] = p00.x;
            pos[pi++] = p00.y;
            pos[pi++] = p11.x;
            pos[pi++] = p11.y;
            pos[pi++] = p01.x;
            pos[pi++] = p01.y;
            col[ci++] = p00.r;
            col[ci++] = p00.g;
            col[ci++] = p00.b;
            col[ci++] = p11.r;
            col[ci++] = p11.g;
            col[ci++] = p11.b;
            col[ci++] = p01.r;
            col[ci++] = p01.g;
            col[ci++] = p01.b;
          }
        }
      }
    }
    return { pos, col, count: nTri * 3 };
  }

  render(isDragging = false) {
    this.flowRuntime = this.buildFlowRuntime();
    this.renderGL(isDragging ? this.SUBS_LO : this.SUBS_HI);
    this.renderPreview();
    this.renderOverlay();
    if (!isDragging) this.syncUrlState();
  }

  renderGL(S) {
    const gl = this.gl;
    gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
    gl.clearColor(0.05, 0.05, 0.05, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const { pos, col, count } = this.buildMesh(S);
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, col, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aCol);
    gl.vertexAttribPointer(this.aCol, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }

  renderOverlay() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    if (this.showGrid) this.drawGrid(ctx, this.W, this.H);
    this.drawHandles(ctx, this.W, this.H);
  }

  renderPreview() {
    const ctx = this.previewCtx;
    const w = this.preview.width;
    const h = this.preview.height;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, w, h);

    const sw = this.glCanvas.width;
    const sh = this.glCanvas.height;
    if (!sw || !sh) return;
    const scale = Math.min(w / sw, h / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    ctx.drawImage(this.glCanvas, 0, 0, sw, sh, dx, dy, dw, dh);
  }

  drawGrid(ctx, W, H) {
    ctx.save();
    const stroke = (style, w) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    for (let r = 0; r < this.ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(this.pt(r, 0).x * W, this.pt(r, 0).y * H);
      for (let c = 1; c < this.COLS; c++) ctx.lineTo(this.pt(r, c).x * W, this.pt(r, c).y * H);
      stroke("rgba(255,255,255,0.08)", 5);
      stroke("rgba(255,255,255,0.5)", 1.2);
    }
    for (let c = 0; c < this.COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(this.pt(0, c).x * W, this.pt(0, c).y * H);
      for (let r = 1; r < this.ROWS; r++) ctx.lineTo(this.pt(r, c).x * W, this.pt(r, c).y * H);
      stroke("rgba(255,255,255,0.08)", 5);
      stroke("rgba(255,255,255,0.5)", 1.2);
    }
    const flowLines = this.getFlowGridLines();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 0.85;
    for (const line of flowLines.along) this.drawFlowPath(ctx, line, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 0.65;
    for (const line of flowLines.across) this.drawFlowPath(ctx, line, W, H);
    ctx.restore();
  }

  drawHandles(ctx, W, H) {
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const p = this.grid[r][c];
        const x = p.x * W;
        const y = p.y * H;
        const isSel = this.selected && this.selected.row === r && this.selected.col === c;
        const isDrag = this.dragging && this.dragging.row === r && this.dragging.col === c;
        const isHov = this.hovered && this.hovered.row === r && this.hovered.col === c;
        const active = isSel || isDrag || isHov;
        const R = active ? 9 : 6.5;
        if (active) {
          ctx.beginPath();
          ctx.arc(x, y, R + 4, 0, Math.PI * 2);
          ctx.strokeStyle = isSel ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.13)";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.strokeStyle = active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, R - 2, 0, Math.PI * 2);
        ctx.fillStyle = rgbToHex(p.r, p.g, p.b);
        ctx.fill();
      }
    }
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
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const isCorner = (r === 0 || r === this.ROWS - 1) && (c === 0 || c === this.COLS - 1);
        const isEdge = !isCorner && (r === 0 || r === this.ROWS - 1 || c === 0 || c === this.COLS - 1);
        const hitRadius = isCorner ? R + 10 : isEdge ? R + 5 : R;
        const dx = mx - this.grid[r][c].x * this.W;
        const dy = my - this.grid[r][c].y * this.H;
        if (dx * dx + dy * dy < hitRadius * hitRadius) return { row: r, col: c };
      }
    }
    return null;
  }

  openPickerFor(rc) {
    this.colorMode = "point";
    const p = this.grid[rc.row][rc.col];
    const rect = this.ov.getBoundingClientRect();
    this.colorPicker.show(p.x * this.W + rect.left, p.y * this.H + rect.top, p.r, p.g, p.b);
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
    const hit = this.findPointAt(x, y);
    this.didDrag = false;
    if (hit) {
      this.dragging = hit;
      this.selected = hit;
      this.dragStart = { x, y };
      this.pointStart = { x: this.grid[hit.row][hit.col].x, y: this.grid[hit.row][hit.col].y };
      this.ov.style.cursor = "grabbing";
    } else {
      this.selected = null;
      this.colorPicker.hide();
    }
    this.renderOverlay();
  };

  _onOverlayMouseMove = (e: MouseEvent) => {
    const { x, y } = this.getMousePos(e);
    if (this.dragging && this.dragStart && this.pointStart) {
      const dx = x - this.dragStart.x;
      const dy = y - this.dragStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.didDrag = true;
      const p = this.grid[this.dragging.row][this.dragging.col];
      p.x = Math.max(0, Math.min(1, this.pointStart.x + dx / this.W));
      p.y = Math.max(0, Math.min(1, this.pointStart.y + dy / this.H));
      this.render(true);
    } else {
      const h = this.findPointAt(x, y);
      const same = h && this.hovered && h.row === this.hovered.row && h.col === this.hovered.col;
      if (!same) {
        this.hovered = h;
        this.ov.style.cursor = h ? "grab" : "crosshair";
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
    this.pointStart = null;
    this.ov.style.cursor = this.hovered ? "grab" : "crosshair";
  };

  _onOverlayDoubleClick = (e: MouseEvent) => {
    this._cancelPickerTimer();
    const { x, y } = this.getMousePos(e);
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
      this.pointStart = null;
      this.render(false);
    }
    this.hovered = null;
    this.ov.style.cursor = "crosshair";
    this.renderOverlay();
  };

  _onDocumentKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      this._cancelPickerTimer();
      this._stopPanelDrag();
      this._stopPreviewDrag();
      this.colorPicker.hide();
      this.selected = null;
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
    document.addEventListener("keydown", this._onDocumentKeyDown);
  }

  _onGridButtonClick = () => {
    this.showGrid = !this.showGrid;
    this.gridButton.classList.toggle("active", this.showGrid);
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
    this.applyFlowMode((this.flowModeIndex + 1) % this.flowModes.length);
    this.render();
  }

  toggleFullView() {
    this._stopPreviewDrag();
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
    this.renderGL(this.SUBS_HI);
    const a = document.createElement("a");
    a.download = "gradient.png";
    a.href = this.glCanvas.toDataURL("image/png");
    a.click();
  }

  destroy() {
    this._cancelPickerTimer();
    this._stopPanelDrag();
    this._stopPreviewDrag();

    this.ov.removeEventListener("mousedown", this._onOverlayMouseDown);
    this.ov.removeEventListener("mousemove", this._onOverlayMouseMove);
    this.ov.removeEventListener("mouseup", this._onOverlayMouseUp);
    this.ov.removeEventListener("dblclick", this._onOverlayDoubleClick);
    this.ov.removeEventListener("mouseleave", this._onOverlayMouseLeave);
    document.removeEventListener("keydown", this._onDocumentKeyDown);

    this.gridButton.removeEventListener("click", this._onGridButtonClick);
    this.uiMoveButton.removeEventListener("mousedown", this._onUiMoveMouseDown);
    this.toolbarMoveButton.removeEventListener("mousedown", this._onToolbarMoveMouseDown);
    this.borderToggleButton.removeEventListener("click", this._onBorderToggleClick);
    this.uiToggleButton.removeEventListener("click", this._onUiToggleClick);
    this.flowButton.removeEventListener("click", this._onFlowButtonClick);
    this.aspectButton.removeEventListener("click", this._onAspectButtonClick);
    this.randomizeButton.removeEventListener("click", this._onRandomizeButtonClick);
    this.colorButton.removeEventListener("click", this._onColorButtonClick);
    this.previewViewBtn.removeEventListener("click", this._onPreviewViewClick);
    this.previewMoveBtn.removeEventListener("mousedown", this._onPreviewMoveMouseDown);
    this.exportButton.removeEventListener("click", this._onExportButtonClick);

    this.resizeObserver.disconnect();
    this.colorPicker.hide();
    this.colorPicker.destroy();
    this.selected = null;
    this.dragging = null;
    this.hovered = null;
    this.ov.style.cursor = "crosshair";
    document.body.classList.remove("ui-hidden", "border-hidden", "preview-full");
  }
}

export function bootGradiatorApp(elements: GradiatorAppElements) {
  return new GradiatorApp(elements);
}

import "./style.css";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function bilerp(tl, tr, bl, br, u, v) {
  const h = (a, b) => lerp(a, b, u);
  return {
    x: lerp(h(tl.x, tr.x), h(bl.x, br.x), v),
    y: lerp(h(tl.y, tr.y), h(bl.y, br.y), v),
    r: lerp(h(tl.r, tr.r), h(bl.r, br.r), v),
    g: lerp(h(tl.g, tr.g), h(bl.g, br.g), v),
    b: lerp(h(tl.b, tr.b), h(bl.b, br.b), v),
  };
}

function colorBilerp(tl, tr, bl, br, u, v) {
  return {
    r: lerp(lerp(tl.r, tr.r, u), lerp(bl.r, br.r, u), v),
    g: lerp(lerp(tl.g, tr.g, u), lerp(bl.g, br.g, u), v),
    b: lerp(lerp(tl.b, tr.b, u), lerp(bl.b, br.b, u), v),
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function mixPoint(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  };
}

function fract(v) {
  return v - Math.floor(v);
}

function smoothstep01(t) {
  return t * t * (3 - 2 * t);
}

function normalizeVector(du, dv, fallback = { du: 1, dv: 0 }) {
  const len = Math.hypot(du, dv);
  if (len < 1e-6) {
    if (!fallback) return null;
    const fallbackLen = Math.hypot(fallback.du, fallback.dv);
    if (fallbackLen < 1e-6) return null;
    return { du: fallback.du / fallbackLen, dv: fallback.dv / fallbackLen };
  }
  return { du: du / len, dv: dv / len };
}

function hash2(x, y) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
}

function valueNoise2D(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep01(x - ix);
  const fy = smoothstep01(y - iy);
  const v00 = hash2(ix, iy);
  const v10 = hash2(ix + 1, iy);
  const v01 = hash2(ix, iy + 1);
  const v11 = hash2(ix + 1, iy + 1);
  return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
}

function fractalNoise2D(x, y, octaves = 2) {
  let total = 0;
  let amplitude = 0.6;
  let frequency = 1;
  let weight = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise2D(x * frequency, y * frequency) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }
  return weight > 0 ? total / weight : 0;
}

function encodeUrlState(value) {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeUrlState(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (base64.length % 4)) % 4;
  return JSON.parse(atob(base64 + "=".repeat(padding)));
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function rgbToHex(r, g, b) {
  const h = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return "#" + h(r) + h(g) + h(b);
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return { r: f(0), g: f(8), b: f(4) };
}

function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToRgb(h, s, v) {
  h /= 360;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return { r: c[0], g: c[1], b: c[2] };
}

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
  return s;
}

function createProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  return p;
}

class ColorPicker {
  constructor(onChange) {
    this.onChange = onChange;
    this.h = 0;
    this.s = 1;
    this.v = 1;
    this.visible = false;
    this.svDragging = false;
    this.panel = document.getElementById("cp-panel");
    this.svWrap = document.getElementById("cp-sv-wrap");
    this.svCanvas = document.getElementById("cp-sv-canvas");
    this.svCtx = this.svCanvas.getContext("2d");
    this.svCursor = document.getElementById("cp-sv-cursor");
    this.hueSlider = document.getElementById("cp-hue");
    this.hexInput = document.getElementById("cp-hex");
    this.swatch = document.getElementById("cp-swatch");
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
    this.hueSlider.value = this.h;
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

  _bind() {
    this.svWrap.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.svDragging = true;
      this._setSVFromClient(e.clientX, e.clientY);
    });
    window.addEventListener("mousemove", (e) => {
      if (this.svDragging) this._setSVFromClient(e.clientX, e.clientY);
    });
    window.addEventListener("mouseup", () => {
      this.svDragging = false;
    });
    this.hueSlider.addEventListener("input", (e) => {
      this.h = parseFloat(e.target.value);
      this._drawSV();
      this._syncBottom();
      this._emit();
    });
    this.hueSlider.addEventListener("mousedown", (e) => e.stopPropagation());
    this.hexInput.addEventListener("keydown", (e) => e.stopPropagation());
    this.hexInput.addEventListener("change", (e) => {
      const val = e.target.value.trim();
      const hex = val.startsWith("#") ? val : "#" + val;
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        const { r, g, b } = hexToRgb(hex);
        const hsv = rgbToHsv(r, g, b);
        this.h = hsv.h;
        this.s = hsv.s;
        this.v = hsv.v;
        this.hueSlider.value = this.h;
        this._drawSV();
        this._placeCursor();
        this.swatch.style.background = hex;
        this._emit();
      }
    });
    this.panel.addEventListener("mousedown", (e) => e.stopPropagation());
  }
}

class GradiatorApp {
  constructor() {
    this.container = document.getElementById("canvas-container");
    this.imageStage = document.getElementById("image-stage");
    this.glCanvas = document.getElementById("gl-canvas");
    this.ov = document.getElementById("overlay-canvas");
    this.preview = document.getElementById("preview-canvas");
    this.uiControls = document.getElementById("ui-controls");
    this.uiMoveButton = document.getElementById("btn-ui-move");
    this.toolbar = document.getElementById("toolbar");
    this.toolbarMoveButton = document.getElementById("btn-toolbar-move");
    this.previewFrame = document.getElementById("preview-frame");
    this.previewMoveBtn = document.getElementById("btn-move");
    this.previewViewBtn = document.getElementById("btn-view");
    this.borderToggleButton = document.getElementById("btn-border");
    this.uiToggleButton = document.getElementById("btn-ui");
    this.flowButton = document.getElementById("btn-flow");
    this.colorButton = document.getElementById("btn-color");
    this.ctx = this.ov.getContext("2d");
    this.previewCtx = this.preview.getContext("2d");

    this.ROWS = 4;
    this.COLS = 4;
    this.SUBS_HI = 28;
    this.SUBS_LO = 14;
    this.showGrid = true;
    this.fullView = false;
    this.flowModes = [
      { label: "Linear", blend: 0, kind: "blend" },
      { label: "Balanced", blend: 0.5, kind: "blend" },
      { label: "Fluid", blend: 1, kind: "blend" },
      { label: "Directional", blend: 0.88, kind: "advect", field: "directional", strength: 0.16, steps: 3 },
      { label: "Radial", blend: 0.92, kind: "advect", field: "radial", strength: 0.18, steps: 4 },
      { label: "Swirl", blend: 1, kind: "advect", field: "swirl", strength: 0.16, steps: 4 },
      { label: "Attractor", blend: 0.9, kind: "advect", field: "attractor", strength: 0.16, steps: 3 },
      { label: "Turbulence", blend: 1, kind: "advect", field: "turbulence", strength: 0.1, steps: 2 },
    ];
    this.flowModeIndex = 2;
    this.flowBlend = this.flowModes[this.flowModeIndex].blend;
    this.lastSerializedState = "";
    this.grid = [];
    this.selected = null;
    this.dragging = null;
    this.hovered = null;
    this.colorMode = "point";
    this.borderHidden = false;
    this.uiHidden = false;
    this.panelDragging = null;
    this.previewDragging = null;
    this.previewDockedStyle = null;
    this.flowGridCache = null;
    this.flowRuntime = null;
    this.W = 0;
    this.H = 0;

    this.colorPicker = new ColorPicker((r, g, b) => {
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
    });

    this.applyFlowMode(this.flowModeIndex);
    this.initGL();
    this.initPoints();
    this.restoreStateFromUrl();
    this.setupEvents();
    this.setupButtons();
    this.resize();

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.container);
    ro.observe(this.previewFrame);
  }

  initGL() {
    const gl =
      this.glCanvas.getContext("webgl", { preserveDrawingBuffer: true }) ||
      this.glCanvas.getContext("experimental-webgl", { preserveDrawingBuffer: true });
    if (!gl) {
      alert("WebGL not supported");
      return;
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
    const TL = hslToRgb(240, 80, 38);
    const TR = hslToRgb(315, 85, 48);
    const BL = hslToRgb(185, 75, 38);
    const BR = hslToRgb(32, 90, 52);
    this.grid = [];
    for (let row = 0; row < this.ROWS; row++) {
      const r = [];
      for (let col = 0; col < this.COLS; col++) {
        const u = col / (this.COLS - 1);
        const v = row / (this.ROWS - 1);
        const c = colorBilerp(TL, TR, BL, BR, u, v);
        r.push({ x: u, y: v, r: c.r, g: c.g, b: c.b });
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
      v: 1,
      rows: this.ROWS,
      cols: this.COLS,
      flow: this.flowModeIndex,
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
      if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) return;
      if (!Array.isArray(points) || points.length !== rows * cols * 5) return;

      const grid = [];
      let i = 0;
      for (let row = 0; row < rows; row++) {
        const nextRow = [];
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

  inverseBilinear(target, tl, tr, bl, br) {
    const bx = tr.x - tl.x;
    const by = tr.y - tl.y;
    const cx = bl.x - tl.x;
    const cy = bl.y - tl.y;
    const dx = tl.x - tr.x - bl.x + br.x;
    const dy = tl.y - tr.y - bl.y + br.y;
    let u = 0.5;
    let v = 0.5;

    for (let i = 0; i < 10; i++) {
      const fx = tl.x + bx * u + cx * v + dx * u * v - target.x;
      const fy = tl.y + by * u + cy * v + dy * u * v - target.y;
      const j00 = bx + dx * v;
      const j01 = cx + dx * u;
      const j10 = by + dy * v;
      const j11 = cy + dy * u;
      const det = j00 * j11 - j01 * j10;
      if (Math.abs(det) < 1e-8) break;
      const du = (fx * j11 - fy * j01) / det;
      const dv = (fy * j00 - fx * j10) / det;
      u -= du;
      v -= dv;
      if (du * du + dv * dv < 1e-10) break;
    }

    const projected = bilerp(tl, tr, bl, br, u, v);
    const error = (projected.x - target.x) ** 2 + (projected.y - target.y) ** 2;
    return { u, v, error, projected };
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
        const local = this.inverseBilinear(target, tl, tr, bl, br);
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
    const seedCount = interactionMode ? 5 : 8;
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

  resize() {
    const container = this.container;
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

  setupEvents() {
    const ov = this.ov;
    let dragStart = null;
    let pointStart = null;
    let didDrag = false;
    let pickerTimer = null;
    const cancelTimer = () => {
      if (pickerTimer) {
        clearTimeout(pickerTimer);
        pickerTimer = null;
      }
    };
    ov.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      cancelTimer();
      const { x, y } = this.getMousePos(e);
      const hit = this.findPointAt(x, y);
      didDrag = false;
      if (hit) {
        this.dragging = hit;
        this.selected = hit;
        dragStart = { x, y };
        pointStart = { x: this.grid[hit.row][hit.col].x, y: this.grid[hit.row][hit.col].y };
        ov.style.cursor = "grabbing";
      } else {
        this.selected = null;
        this.colorPicker.hide();
      }
      this.renderOverlay();
    });
    ov.addEventListener("mousemove", (e) => {
      const { x, y } = this.getMousePos(e);
      if (this.dragging && dragStart) {
        const dx = x - dragStart.x;
        const dy = y - dragStart.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
        const p = this.grid[this.dragging.row][this.dragging.col];
        p.x = Math.max(0, Math.min(1, pointStart.x + dx / this.W));
        p.y = Math.max(0, Math.min(1, pointStart.y + dy / this.H));
        this.render(true);
      } else {
        const h = this.findPointAt(x, y);
        const same = h && this.hovered && h.row === this.hovered.row && h.col === this.hovered.col;
        if (!same) {
          this.hovered = h;
          ov.style.cursor = h ? "grab" : "crosshair";
          this.renderOverlay();
        }
      }
    });
    ov.addEventListener("mouseup", () => {
      if (this.dragging) {
        const rc = this.dragging;
        if (!didDrag) {
          pickerTimer = setTimeout(() => {
            pickerTimer = null;
            this.openPickerFor(rc);
          }, 220);
        } else {
          this.render(false);
        }
        this.dragging = null;
        dragStart = null;
        ov.style.cursor = this.hovered ? "grab" : "crosshair";
      }
    });
    ov.addEventListener("dblclick", (e) => {
      cancelTimer();
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
    });
    ov.addEventListener("mouseleave", () => {
      if (this.dragging) {
        this.dragging = null;
        this.render(false);
      }
      this.hovered = null;
      ov.style.cursor = "crosshair";
      this.renderOverlay();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        cancelTimer();
        this._stopPanelDrag();
        this._stopPreviewDrag();
        this.colorPicker.hide();
        this.selected = null;
        if (this.fullView) this.toggleFullView();
        this.renderOverlay();
      }
    });
  }

  setupButtons() {
    document.getElementById("btn-grid").addEventListener("click", () => {
      this.showGrid = !this.showGrid;
      document.getElementById("btn-grid").classList.toggle("active", this.showGrid);
      this.renderOverlay();
    });
    this.uiMoveButton.addEventListener("mousedown", (e) =>
      this.startPanelDrag(e, this.uiControls, this.uiMoveButton)
    );
    this.toolbarMoveButton.addEventListener("mousedown", (e) =>
      this.startPanelDrag(e, this.toolbar, this.toolbarMoveButton)
    );
    this.borderToggleButton.addEventListener("click", () => this.toggleBorder());
    this.uiToggleButton.addEventListener("click", () => this.toggleUi());
    this.flowButton.addEventListener("click", () => this.cycleFlowMode());
    document.getElementById("btn-randomize").addEventListener("click", () => this.randomizeColors());
    this.colorButton.addEventListener("click", () => this.openGradientPicker());
    this.previewViewBtn.addEventListener("click", () => this.toggleFullView());
    this.previewMoveBtn.addEventListener("mousedown", (e) => this.startPreviewDrag(e));
    document.getElementById("btn-export").addEventListener("click", () => this.exportPng());
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
}

new GradiatorApp();

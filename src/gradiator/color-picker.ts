import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from "../utils/color.js";

type ColorPickerElements = {
  panel: HTMLDivElement;
  svWrap: HTMLDivElement;
  svCanvas: HTMLCanvasElement;
  svCursor: HTMLDivElement;
  hueSlider: HTMLInputElement;
  hexInput: HTMLInputElement;
  swatch: HTMLDivElement;
};

export class ColorPicker {
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

  constructor(
    elements: ColorPickerElements,
    onChange: (r: number, g: number, b: number) => void,
  ) {
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
    this.svWrap.removeEventListener("pointerdown", this._onSvWrapPointerDown);
    window.removeEventListener("pointermove", this._onWindowPointerMove);
    window.removeEventListener("pointerup", this._onWindowPointerUp);
    window.removeEventListener("pointercancel", this._onWindowPointerUp);
    this.hueSlider.removeEventListener("input", this._onHueInput);
    this.hueSlider.removeEventListener("pointerdown", this._stopPropagation);
    this.hexInput.removeEventListener("keydown", this._stopPropagation);
    this.hexInput.removeEventListener("change", this._onHexChange);
    this.panel.removeEventListener("pointerdown", this._stopPropagation);
  }

  _stopPropagation = (e: Event) => {
    e.stopPropagation();
  };

  _onSvWrapPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.svDragging = true;
    if (this.svWrap.setPointerCapture && typeof e.pointerId === "number") {
      try { this.svWrap.setPointerCapture(e.pointerId); } catch {}
    }
    this._setSVFromClient(e.clientX, e.clientY);
  };

  _onWindowPointerMove = (e: PointerEvent) => {
    if (this.svDragging) this._setSVFromClient(e.clientX, e.clientY);
  };

  _onWindowPointerUp = () => {
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
    this.svWrap.addEventListener("pointerdown", this._onSvWrapPointerDown);
    window.addEventListener("pointermove", this._onWindowPointerMove);
    window.addEventListener("pointerup", this._onWindowPointerUp);
    window.addEventListener("pointercancel", this._onWindowPointerUp);
    this.hueSlider.addEventListener("input", this._onHueInput);
    this.hueSlider.addEventListener("pointerdown", this._stopPropagation);
    this.hexInput.addEventListener("keydown", this._stopPropagation);
    this.hexInput.addEventListener("change", this._onHexChange);
    this.panel.addEventListener("pointerdown", this._stopPropagation);
  }
}

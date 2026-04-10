import { rgbToHex } from "../utils/color.js";
import type { FlowGridLines, GradientPoint, GridIndex } from "./types";

type SampleField = (u: number, v: number) => GradientPoint;

type RenderGlOptions = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  aPos: number;
  aCol: number;
  posBuf: WebGLBuffer;
  colBuf: WebGLBuffer;
  width: number;
  height: number;
  grid: GradientPoint[][];
  subdivisions: number;
  sampleField: SampleField;
};

type RenderPreviewOptions = {
  ctx: CanvasRenderingContext2D;
  targetCanvas: HTMLCanvasElement;
  sourceCanvas: HTMLCanvasElement;
};

type RenderOverlayOptions = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  grid: GradientPoint[][];
  showGrid: boolean;
  flowLines: FlowGridLines;
  selected: GridIndex | null;
  dragging: GridIndex | null;
  hovered: GridIndex | null;
};

export function renderGlMesh({
  gl,
  program,
  aPos,
  aCol,
  posBuf,
  colBuf,
  width,
  height,
  grid,
  subdivisions,
  sampleField,
}: RenderGlOptions) {
  const { pos, col, count } = buildGradientMesh(grid, subdivisions, sampleField);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0.05, 0.05, 0.05, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
  gl.bufferData(gl.ARRAY_BUFFER, col, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aCol);
  gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, count);
}

export function renderPreviewCanvas({ ctx, targetCanvas, sourceCanvas }: RenderPreviewOptions) {
  const width = targetCanvas.width;
  const height = targetCanvas.height;
  if (!width || !height) return;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, width, height);

  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  if (!sourceWidth || !sourceHeight) return;

  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;
  ctx.drawImage(sourceCanvas, 0, 0, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);
}

export function renderOverlayCanvas({
  ctx,
  width,
  height,
  grid,
  showGrid,
  flowLines,
  selected,
  dragging,
  hovered,
}: RenderOverlayOptions) {
  ctx.clearRect(0, 0, width, height);
  if (showGrid) drawGrid(ctx, width, height, grid, flowLines);
  drawHandles(ctx, width, height, grid, selected, dragging, hovered);
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename = "gradient.png") {
  const anchor = document.createElement("a");
  anchor.download = filename;
  anchor.href = canvas.toDataURL("image/png");
  anchor.click();
}

function buildGradientMesh(grid: GradientPoint[][], subdivisions: number, sampleField: SampleField) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const triangleCount = (rows - 1) * (cols - 1) * subdivisions * subdivisions * 2;
  const pos = new Float32Array(triangleCount * 3 * 2);
  const col = new Float32Array(triangleCount * 3 * 3);
  let posIndex = 0;
  let colorIndex = 0;

  for (let pointRow = 0; pointRow < rows - 1; pointRow++) {
    for (let pointCol = 0; pointCol < cols - 1; pointCol++) {
      for (let subRow = 0; subRow < subdivisions; subRow++) {
        for (let subCol = 0; subCol < subdivisions; subCol++) {
          const u0 = subRow / subdivisions;
          const u1 = (subRow + 1) / subdivisions;
          const v0 = subCol / subdivisions;
          const v1 = (subCol + 1) / subdivisions;
          const p00 = sampleField((pointCol + u0) / (cols - 1), (pointRow + v0) / (rows - 1));
          const p10 = sampleField((pointCol + u1) / (cols - 1), (pointRow + v0) / (rows - 1));
          const p01 = sampleField((pointCol + u0) / (cols - 1), (pointRow + v1) / (rows - 1));
          const p11 = sampleField((pointCol + u1) / (cols - 1), (pointRow + v1) / (rows - 1));

          pos[posIndex++] = p00.x;
          pos[posIndex++] = p00.y;
          pos[posIndex++] = p10.x;
          pos[posIndex++] = p10.y;
          pos[posIndex++] = p11.x;
          pos[posIndex++] = p11.y;
          col[colorIndex++] = p00.r;
          col[colorIndex++] = p00.g;
          col[colorIndex++] = p00.b;
          col[colorIndex++] = p10.r;
          col[colorIndex++] = p10.g;
          col[colorIndex++] = p10.b;
          col[colorIndex++] = p11.r;
          col[colorIndex++] = p11.g;
          col[colorIndex++] = p11.b;

          pos[posIndex++] = p00.x;
          pos[posIndex++] = p00.y;
          pos[posIndex++] = p11.x;
          pos[posIndex++] = p11.y;
          pos[posIndex++] = p01.x;
          pos[posIndex++] = p01.y;
          col[colorIndex++] = p00.r;
          col[colorIndex++] = p00.g;
          col[colorIndex++] = p00.b;
          col[colorIndex++] = p11.r;
          col[colorIndex++] = p11.g;
          col[colorIndex++] = p11.b;
          col[colorIndex++] = p01.r;
          col[colorIndex++] = p01.g;
          col[colorIndex++] = p01.b;
        }
      }
    }
  }

  return { pos, col, count: triangleCount * 3 };
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grid: GradientPoint[][],
  flowLines: FlowGridLines,
) {
  ctx.save();
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const stroke = (style: string, lineWidth: number) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  for (let row = 0; row < rows; row++) {
    ctx.beginPath();
    ctx.moveTo(grid[row][0].x * width, grid[row][0].y * height);
    for (let col = 1; col < cols; col++) ctx.lineTo(grid[row][col].x * width, grid[row][col].y * height);
    stroke("rgba(255,255,255,0.08)", 5);
    stroke("rgba(255,255,255,0.5)", 1.2);
  }

  for (let col = 0; col < cols; col++) {
    ctx.beginPath();
    ctx.moveTo(grid[0][col].x * width, grid[0][col].y * height);
    for (let row = 1; row < rows; row++) ctx.lineTo(grid[row][col].x * width, grid[row][col].y * height);
    stroke("rgba(255,255,255,0.08)", 5);
    stroke("rgba(255,255,255,0.5)", 1.2);
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 0.85;
  for (const line of flowLines.along) drawFlowPath(ctx, line, width, height);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 0.65;
  for (const line of flowLines.across) drawFlowPath(ctx, line, width, height);
  ctx.restore();
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grid: GradientPoint[][],
  selected: GridIndex | null,
  dragging: GridIndex | null,
  hovered: GridIndex | null,
) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const point = grid[row][col];
      const x = point.x * width;
      const y = point.y * height;
      const isSelected = selected && selected.row === row && selected.col === col;
      const isDragging = dragging && dragging.row === row && dragging.col === col;
      const isHovered = hovered && hovered.row === row && hovered.col === col;
      const active = isSelected || isDragging || isHovered;
      const radius = active ? 9 : 6.5;

      if (active) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.13)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
      ctx.fillStyle = rgbToHex(point.r, point.g, point.b);
      ctx.fill();
    }
  }
}

function drawFlowPath(ctx: CanvasRenderingContext2D, line: { x: number; y: number }[], width: number, height: number) {
  if (!line || line.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(line[0].x * width, line[0].y * height);
  for (let i = 1; i < line.length; i++) ctx.lineTo(line[i].x * width, line[i].y * height);
  ctx.stroke();
}

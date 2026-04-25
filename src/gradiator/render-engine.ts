import { rgbToHex } from "../utils/color.js";
import { clamp } from "../utils/math.js";
import type {
  AreaFlowControl,
  FlowGridLines,
  GradientPoint,
  GridAreaIndex,
  GridIndex,
  PointAnimationPath,
  Point2D,
  SelectionRect,
} from "./types";

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
  baseGrid: GradientPoint[][];
  showGrid: boolean;
  showPoints: boolean;
  showGradientTypes: boolean;
  flowLines: FlowGridLines;
  areaFlowControls: AreaFlowControl[];
  activeAreaFlowControl: GridAreaIndex | null;
  hoveredAreaFlowControl: GridAreaIndex | null;
  selectedAreaFlowControls: GridAreaIndex[];
  selected: GridIndex | null;
  selectedPoints: GridIndex[];
  dragging: GridIndex | null;
  hovered: GridIndex | null;
  animationPaths: PointAnimationPath[];
  selectedAnimationPathId: string | null;
  hoveredAnimationPathId: string | null;
  drawingAnimationPathPoint: GridIndex | null;
  draftAnimationPath: Point2D[];
  selectionRect: SelectionRect | null;
};

type BuildAreaFlowControlsOptions = {
  width: number;
  height: number;
  grid: GradientPoint[][];
  flowModeGrid: number[][];
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
  baseGrid,
  showGrid,
  showPoints,
  showGradientTypes,
  flowLines,
  areaFlowControls,
  activeAreaFlowControl,
  hoveredAreaFlowControl,
  selectedAreaFlowControls,
  selected,
  selectedPoints,
  dragging,
  hovered,
  animationPaths,
  selectedAnimationPathId,
  hoveredAnimationPathId,
  drawingAnimationPathPoint,
  draftAnimationPath,
  selectionRect,
}: RenderOverlayOptions) {
  ctx.clearRect(0, 0, width, height);
  if (showGrid) {
    drawGrid(ctx, width, height, grid, flowLines);
  }
  drawAnimationPaths(
    ctx,
    width,
    height,
    baseGrid,
    animationPaths,
    selectedAnimationPathId,
    hoveredAnimationPathId,
    drawingAnimationPathPoint,
    draftAnimationPath,
  );
  if (selectionRect) {
    drawSelectionRect(ctx, selectionRect);
  }
  if (showGradientTypes) {
    drawAreaFlowControls(
      ctx,
      areaFlowControls,
      activeAreaFlowControl,
      hoveredAreaFlowControl,
      selectedAreaFlowControls,
    );
  }
  if (showPoints) {
    drawHandles(ctx, width, height, grid, selected, selectedPoints, dragging, hovered);
  }
}

function drawAnimationPaths(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grid: GradientPoint[][],
  paths: PointAnimationPath[],
  selectedPathId: string | null,
  hoveredPathId: string | null,
  drawingPoint: GridIndex | null,
  draftPath: Point2D[],
) {
  if (!paths.length && !drawingPoint) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const path of paths) {
    const basePoint = grid[path.point.row]?.[path.point.col];
    if (!basePoint || path.points.length < 2) continue;
    const isSelected = path.id === selectedPathId;
    const isHovered = path.id === hoveredPathId;
    drawAnimationPathLine(ctx, width, height, basePoint, path.points, {
      strokeStyle: isSelected
        ? "rgba(255, 255, 255, 0.62)"
        : isHovered
          ? "rgba(255, 255, 255, 0.5)"
          : "rgba(255, 255, 255, 0.34)",
      lineWidth: isSelected ? 2.4 : 1.8,
      dash: [],
    });
    drawAnimationPathEndpoint(ctx, width, height, basePoint, path.points[path.points.length - 1], isSelected);
  }

  if (drawingPoint && draftPath.length >= 2) {
    const basePoint = grid[drawingPoint.row]?.[drawingPoint.col];
    if (basePoint) {
      drawAnimationPathLine(ctx, width, height, basePoint, draftPath, {
        strokeStyle: "rgba(255, 255, 255, 0.46)",
        lineWidth: 2,
        dash: [7, 5],
      });
    }
  }

  ctx.restore();
}

function drawAnimationPathLine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  basePoint: GradientPoint,
  points: Point2D[],
  style: { strokeStyle: string; lineWidth: number; dash: number[] },
) {
  ctx.beginPath();
  ctx.moveTo((basePoint.x + points[0].x) * width, (basePoint.y + points[0].y) * height);
  for (let index = 1; index < points.length; index++) {
    ctx.lineTo((basePoint.x + points[index].x) * width, (basePoint.y + points[index].y) * height);
  }

  ctx.setLineDash(style.dash);
  ctx.strokeStyle = style.strokeStyle;
  ctx.lineWidth = style.lineWidth;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawAnimationPathEndpoint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  basePoint: GradientPoint,
  point: Point2D,
  selected: boolean,
) {
  const x = (basePoint.x + point.x) * width;
  const y = (basePoint.y + point.y) * height;
  ctx.beginPath();
  ctx.arc(x, y, selected ? 4.8 : 3.8, 0, Math.PI * 2);
  ctx.fillStyle = selected ? "rgba(255, 255, 255, 0.62)" : "rgba(255, 255, 255, 0.42)";
  ctx.fill();
}

export function buildAreaFlowControls({ width, height, grid, flowModeGrid }: BuildAreaFlowControlsOptions) {
  const controls: AreaFlowControl[] = [];
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const tl = grid[row][col];
      const tr = grid[row][col + 1];
      const bl = grid[row + 1][col];
      const br = grid[row + 1][col + 1];
      const topSpan = distance(tl, tr, width, height);
      const bottomSpan = distance(bl, br, width, height);
      const leftSpan = distance(tl, bl, width, height);
      const rightSpan = distance(tr, br, width, height);
      const minSpan = Math.min((topSpan + bottomSpan) * 0.5, (leftSpan + rightSpan) * 0.5);
      const radius = clamp(minSpan * 0.12, 8, 14);

      controls.push({
        row,
        col,
        x: ((tl.x + tr.x + bl.x + br.x) * 0.25) * width,
        y: ((tl.y + tr.y + bl.y + br.y) * 0.25) * height,
        radius,
        modeIndex: flowModeGrid[row]?.[col] ?? 0,
      });
    }
  }

  return controls;
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename = "gradient.png") {
  const anchor = document.createElement("a");
  anchor.download = filename;
  anchor.href = canvas.toDataURL("image/png");
  anchor.click();
}

export function downloadBlob(blob: Blob, filename: string) {
  const anchor = document.createElement("a");
  const url = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.href = url;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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
  selectedPoints: GridIndex[],
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
      const isSelected =
        hasGridIndex(selectedPoints, row, col) || (selected && selected.row === row && selected.col === col);
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

function drawAreaFlowControls(
  ctx: CanvasRenderingContext2D,
  controls: AreaFlowControl[],
  activeAreaFlowControl: GridAreaIndex | null,
  hoveredAreaFlowControl: GridAreaIndex | null,
  selectedAreaFlowControls: GridAreaIndex[],
) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const control of controls) {
    const isActive =
      Boolean(activeAreaFlowControl) &&
      activeAreaFlowControl?.row === control.row &&
      activeAreaFlowControl?.col === control.col;
    const isSelected = hasGridIndex(selectedAreaFlowControls, control.row, control.col);
    const isHovered =
      Boolean(hoveredAreaFlowControl) &&
      hoveredAreaFlowControl?.row === control.row &&
      hoveredAreaFlowControl?.col === control.col;
    const outerRadius = control.radius + (isActive || isSelected ? 4 : 2);

    ctx.beginPath();
    ctx.arc(control.x, control.y, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = isActive || isSelected ? "rgba(5, 5, 5, 0.92)" : "rgba(8, 8, 8, 0.74)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(control.x, control.y, outerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = isActive || isSelected
      ? "rgba(255, 255, 255, 0.94)"
      : isHovered
        ? "rgba(255, 255, 255, 0.6)"
        : "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = isActive ? 1.8 : 1.1;
    ctx.stroke();

    ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.84)";
    ctx.font = `${Math.round(control.radius + 3)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillText("⚙", control.x, control.y + 0.5);
  }

  ctx.restore();
}

function drawSelectionRect(ctx: CanvasRenderingContext2D, rect: SelectionRect) {
  const left = Math.min(rect.startX, rect.endX);
  const top = Math.min(rect.startY, rect.endY);
  const width = Math.abs(rect.endX - rect.startX);
  const height = Math.abs(rect.endY - rect.startY);

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 1.25;
  ctx.setLineDash([6, 4]);
  ctx.fillRect(left, top, width, height);
  ctx.strokeRect(left, top, width, height);
  ctx.restore();
}

function hasGridIndex(indices: GridIndex[], row: number, col: number) {
  return indices.some((index) => index.row === row && index.col === col);
}

function drawFlowPath(ctx: CanvasRenderingContext2D, line: { x: number; y: number }[], width: number, height: number) {
  if (!line || line.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(line[0].x * width, line[0].y * height);
  for (let i = 1; i < line.length; i++) ctx.lineTo(line[i].x * width, line[i].y * height);
  ctx.stroke();
}

function distance(a: GradientPoint, b: GradientPoint, width: number, height: number) {
  const dx = (b.x - a.x) * width;
  const dy = (b.y - a.y) * height;
  return Math.hypot(dx, dy);
}

import { averageGridColumn } from "./model/grid-model";
import { clamp, fract, lerp, normalizeVector } from "../utils/math.js";
import { fractalNoise2D } from "../utils/noise.js";
import type { FlowGridLines, FlowMode, FlowRuntime, GradientPoint, Point2D } from "./types";

type FlowVector = {
  du: number;
  dv: number;
};

type SampleInterpolatedField = (u: number, v: number, blend: number) => GradientPoint;
type SampleTensorDirection = (u: number, v: number, orthogonal?: boolean) => FlowVector | null;
type SampleField = (u: number, v: number) => GradientPoint;
type SampleFlowDirection = (u: number, v: number, orthogonal?: boolean) => FlowVector | null;

type SampleFieldForModeOptions = {
  mode: FlowMode;
  u: number;
  v: number;
  sampleInterpolatedField: SampleInterpolatedField;
  sampleModeVector: (u: number, v: number) => FlowVector | null;
};

type SampleFlowDirectionForModeOptions = {
  mode: FlowMode;
  u: number;
  v: number;
  orthogonal?: boolean;
  sampleModeVector: (u: number, v: number) => FlowVector | null;
  sampleTensorDirection: SampleTensorDirection;
};

type TraceFlowLineOptions = {
  orthogonal?: boolean;
  stepSize?: number;
  maxSteps?: number;
  sampleField: SampleField;
  sampleFlowDirection: SampleFlowDirection;
};

type BuildFlowGridLinesOptions = {
  interactionMode: boolean;
  sampleField: SampleField;
  sampleFlowDirection: SampleFlowDirection;
};

export function buildFlowRuntime(grid: GradientPoint[][]): FlowRuntime {
  if (!grid.length) {
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

  const points = grid.flat();
  let centerX = 0;
  let centerY = 0;
  let attractX = 0;
  let attractY = 0;
  let attractWeight = 0;
  let chromaSum = 0;
  let seed = 0;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    centerX += point.x;
    centerY += point.y;
    const chroma = Math.max(point.r, point.g, point.b) - Math.min(point.r, point.g, point.b);
    const luminance = 0.2126 * point.r + 0.7152 * point.g + 0.0722 * point.b;
    const weight = 0.35 + chroma * 1.5 + luminance * 0.6;
    attractX += point.x * weight;
    attractY += point.y * weight;
    attractWeight += weight;
    chromaSum += chroma;
    seed += (i + 1) * (point.x * 13.1 + point.y * 17.9 + point.r * 19.7 + point.g * 23.3 + point.b * 29.9);
  }

  const center = {
    x: centerX / points.length,
    y: centerY / points.length,
  };
  const attractor =
    attractWeight > 1e-6
      ? { x: attractX / attractWeight, y: attractY / attractWeight }
      : center;
  const left = averageGridColumn(grid, 0);
  const right = averageGridColumn(grid, grid[0].length - 1);
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

export function sampleModeVector(
  flowRuntime: FlowRuntime,
  field: FlowMode["field"],
  u: number,
  v: number,
): FlowVector | null {
  const dx = u - flowRuntime.center.x;
  const dy = v - flowRuntime.center.y;

  switch (field) {
    case "directional": {
      const along = dx * flowRuntime.direction.du + dy * flowRuntime.direction.dv;
      const across = dx * flowRuntime.normal.du + dy * flowRuntime.normal.dv;
      const curve = clamp(across * 2.3 + Math.sin((along + 0.5) * Math.PI * 2) * 0.28, -1.35, 1.35);
      return normalizeVector(
        flowRuntime.direction.du + flowRuntime.normal.du * curve,
        flowRuntime.direction.dv + flowRuntime.normal.dv * curve,
        flowRuntime.direction,
      );
    }
    case "radial":
      return normalizeVector(dx, dy, flowRuntime.direction);
    case "swirl":
      return normalizeVector(-dy + dx * 0.2, dx + dy * 0.2, flowRuntime.normal);
    case "attractor":
      return normalizeVector(flowRuntime.attractor.x - u, flowRuntime.attractor.y - v, flowRuntime.direction);
    case "turbulence": {
      const x = u * flowRuntime.noiseScale + flowRuntime.noiseOffsetX;
      const y = v * flowRuntime.noiseScale + flowRuntime.noiseOffsetY;
      const epsilon = 0.22;
      const du = fractalNoise2D(x, y + epsilon) - fractalNoise2D(x, y - epsilon);
      const dv = fractalNoise2D(x - epsilon, y) - fractalNoise2D(x + epsilon, y);
      return normalizeVector(
        du + flowRuntime.direction.du * 0.35,
        dv + flowRuntime.direction.dv * 0.35,
        flowRuntime.direction,
      );
    }
    default:
      return null;
  }
}

export function sampleFlowSource(
  mode: FlowMode,
  u: number,
  v: number,
  sampleModeVectorAt: (u: number, v: number) => FlowVector | null,
) {
  let sourceU = u;
  let sourceV = v;
  const steps = Math.max(1, mode.steps || 1);
  const stepSize = (mode.strength || 0) / steps;

  for (let i = 0; i < steps; i++) {
    const direction = sampleModeVectorAt(sourceU, sourceV);
    if (!direction) break;
    sourceU = clamp(sourceU - direction.du * stepSize, 0, 1);
    sourceV = clamp(sourceV - direction.dv * stepSize, 0, 1);
  }

  return { u: sourceU, v: sourceV };
}

export function sampleFieldForMode({
  mode,
  u,
  v,
  sampleInterpolatedField,
  sampleModeVector,
}: SampleFieldForModeOptions) {
  const base = sampleInterpolatedField(u, v, mode.blend);
  if (mode.kind !== "advect") return base;

  const source = sampleFlowSource(mode, u, v, sampleModeVector);
  const flowed = sampleInterpolatedField(source.u, source.v, mode.blend);
  return { x: base.x, y: base.y, r: flowed.r, g: flowed.g, b: flowed.b };
}

export function sampleFlowDirectionForMode({
  mode,
  u,
  v,
  orthogonal = false,
  sampleModeVector,
  sampleTensorDirection,
}: SampleFlowDirectionForModeOptions) {
  if (mode.kind === "advect") {
    const direction = sampleModeVector(u, v);
    if (direction) {
      if (!orthogonal) return direction;
      return { du: -direction.dv, dv: direction.du };
    }
  }

  return sampleTensorDirection(u, v, orthogonal);
}

export function traceFlowLine(
  seedU: number,
  seedV: number,
  {
    orthogonal = false,
    stepSize = 0.012,
    maxSteps = 120,
    sampleField,
    sampleFlowDirection,
  }: TraceFlowLineOptions,
): Point2D[] {
  const trace = (sign: number) => {
    const points: Point2D[] = [];
    let u = seedU;
    let v = seedV;
    let lastDirection: FlowVector | null = null;

    for (let i = 0; i < maxSteps; i++) {
      if (u < 0 || u > 1 || v < 0 || v > 1) break;
      const point = sampleField(u, v);
      points.push({ x: point.x, y: point.y });

      const direction = sampleFlowDirection(u, v, orthogonal);
      if (!direction) break;

      let du = direction.du;
      let dv = direction.dv;
      if (lastDirection && du * lastDirection.du + dv * lastDirection.dv < 0) {
        du *= -1;
        dv *= -1;
      }
      lastDirection = { du, dv };
      u += du * stepSize * sign;
      v += dv * stepSize * sign;
    }

    return points;
  };

  const backward = trace(-1).reverse();
  const forward = trace(1);
  if (backward.length && forward.length) backward.pop();
  return backward.concat(forward);
}

export function buildFlowGridLines({
  interactionMode,
  sampleField,
  sampleFlowDirection,
}: BuildFlowGridLinesOptions): FlowGridLines {
  const seedCount: number = interactionMode ? 5 : 8;
  const stepSize = interactionMode ? 0.016 : 0.012;
  const maxSteps = interactionMode ? 84 : 120;
  const margin = 0.08;
  const along: Point2D[][] = [];
  const across: Point2D[][] = [];

  for (let i = 0; i < seedCount; i++) {
    const t = seedCount === 1 ? 0.5 : i / (seedCount - 1);
    const u = lerp(margin, 1 - margin, t);
    const v = lerp(margin, 1 - margin, t);
    along.push(
      traceFlowLine(margin, v, {
        orthogonal: false,
        stepSize,
        maxSteps,
        sampleField,
        sampleFlowDirection,
      }),
    );
    across.push(
      traceFlowLine(u, margin, {
        orthogonal: true,
        stepSize,
        maxSteps,
        sampleField,
        sampleFlowDirection,
      }),
    );
  }

  return { along, across };
}

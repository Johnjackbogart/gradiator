import type { AspectMode, FlowMode } from "./types";

export const FLOW_MODES: readonly FlowMode[] = [
  { label: "Linear", blend: 0, kind: "blend" },
  { label: "Balanced", blend: 0.5, kind: "blend" },
  { label: "Fluid", blend: 1, kind: "blend" },
  { label: "Directional", blend: 0.88, kind: "advect", field: "directional", strength: 0.16, steps: 3 },
  { label: "Radial", blend: 0.92, kind: "advect", field: "radial", strength: 0.18, steps: 4 },
  { label: "Swirl", blend: 1, kind: "advect", field: "swirl", strength: 0.16, steps: 4 },
  { label: "Attractor", blend: 0.9, kind: "advect", field: "attractor", strength: 0.16, steps: 3 },
  { label: "Turbulence", blend: 1, kind: "advect", field: "turbulence", strength: 0.1, steps: 2 },
];

export const ASPECT_MODES: readonly AspectMode[] = [
  { key: "square", label: "1:1", ratio: 1 },
  { key: "classic", label: "4:3", ratio: 4 / 3 },
  { key: "widescreen", label: "16:9", ratio: 16 / 9 },
  { key: "browser", label: "Browser", ratio: null },
];

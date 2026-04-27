export type GradientPoint = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
};

export type GridIndex = {
  row: number;
  col: number;
};

export type GridAreaIndex = {
  row: number;
  col: number;
};

export type SelectionRect = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type Point2D = {
  x: number;
  y: number;
};

export type AnimationEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export type PointAnimationPath = {
  id: string;
  point: GridIndex;
  points: Point2D[];
  durationMs: number;
  easing: AnimationEasing;
};

export type SerializedPointAnimationPath = {
  id?: string;
  row: number;
  col: number;
  duration: number;
  easing: AnimationEasing;
  points: number[];
};

export type FlowMode = {
  label: string;
  blend: number;
  kind: "blend" | "advect";
  field?: "directional" | "radial" | "swirl" | "attractor" | "turbulence";
  strength?: number;
  steps?: number;
};

export type AspectMode = {
  key: "square" | "classic" | "widescreen" | "browser";
  label: "1:1" | "4:3" | "16:9" | "Browser";
  ratio: number | null;
};

export type FlowRuntime = {
  center: Point2D;
  attractor: Point2D;
  direction: { du: number; dv: number };
  normal: { du: number; dv: number };
  noiseScale: number;
  noiseOffsetX: number;
  noiseOffsetY: number;
};

export type FlowLinePoint = Point2D;

export type FlowGridLines = {
  along: FlowLinePoint[][];
  across: FlowLinePoint[][];
};

export type AreaFlowControl = GridAreaIndex & {
  x: number;
  y: number;
  radius: number;
  modeIndex: number;
};

export type PanelDragState = {
  element: HTMLDivElement;
  handle: HTMLButtonElement;
  offsetX: number;
  offsetY: number;
};

export type PreviewDragState = {
  offsetX: number;
  offsetY: number;
  container: HTMLDivElement;
};

export type DockedStyle = {
  left: string;
  top: string;
  right: string;
  bottom: string;
};

export type SerializedGradiatorState = {
  v: number;
  rows: number;
  cols: number;
  flow: number;
  flows?: number[];
  aspect: AspectMode["key"];
  points: number[];
  animations?: SerializedPointAnimationPath[];
};

export type GradiatorAppElements = {
  container: HTMLDivElement;
  imageStage: HTMLDivElement;
  glCanvas: HTMLCanvasElement;
  overlayCanvas: HTMLCanvasElement;
  previewCanvas: HTMLCanvasElement;
  mobileToolsToggleButton: HTMLButtonElement;
  uiControls: HTMLDivElement;
  uiMoveButton: HTMLButtonElement;
  toolbar: HTMLDivElement;
  toolbarMoveButton: HTMLButtonElement;
  previewFrame: HTMLDivElement;
  previewMoveButton: HTMLButtonElement;
  previewViewButton: HTMLButtonElement;
  borderToggleButton: HTMLButtonElement;
  uiToggleButton: HTMLButtonElement;
  previewHideButton: HTMLButtonElement;
  titleHideButton: HTMLButtonElement;
  gridButton: HTMLButtonElement;
  pointsButton: HTMLButtonElement;
  gradientTypesButton: HTMLButtonElement;
  aspectButton: HTMLButtonElement;
  animateButton: HTMLButtonElement;
  colorButton: HTMLButtonElement;
  randomizeButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  animationToolbar: HTMLDivElement;
  animationPlayPauseButton: HTMLButtonElement;
  animationClearButton: HTMLButtonElement;
  animationPathControls: HTMLDivElement;
  animationPathLabel: HTMLSpanElement;
  animationDurationInput: HTMLInputElement;
  animationDurationValue: HTMLSpanElement;
  animationEasingSelect: HTMLSelectElement;
  areaFlowMenu: HTMLDivElement;
  areaFlowMenuTitle: HTMLDivElement;
  areaFlowMenuOptions: HTMLDivElement;
  colorPickerPanel: HTMLDivElement;
  colorPickerSvWrap: HTMLDivElement;
  colorPickerSvCanvas: HTMLCanvasElement;
  colorPickerSvCursor: HTMLDivElement;
  colorPickerHue: HTMLInputElement;
  colorPickerHex: HTMLInputElement;
  colorPickerSwatch: HTMLDivElement;
};

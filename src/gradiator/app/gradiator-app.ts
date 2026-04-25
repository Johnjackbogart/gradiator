import type { GradiatorAppElements } from "../types";
import { withAnimation } from "./animation";
import { GradiatorAppBase } from "./base";
import { withControls } from "./controls";
import { withExport } from "./export";
import { withInteraction } from "./interaction";
import { withLifecycle } from "./lifecycle";
import { withRendering } from "./rendering";
import { withSampling } from "./sampling";
import { withState } from "./state";

const GradiatorAppWithFeatures = withLifecycle(
  withExport(
    withControls(
      withInteraction(withRendering(withSampling(withState(withAnimation(GradiatorAppBase))))),
    ),
  ),
);

export class GradiatorApp extends GradiatorAppWithFeatures {
  constructor(elements: GradiatorAppElements) {
    super(elements);

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

    this.resizeObserver.observe(this.container);
    this.resizeObserver.observe(this.previewFrame);
  }
}

export function bootGradiatorApp(elements: GradiatorAppElements) {
  return new GradiatorApp(elements);
}

import { clamp } from "../../utils/math.js";
import type { AppConstructor } from "./mixin";

export function withAnimation<TBase extends AppConstructor<any>>(Base: TBase) {
  return class GradiatorAnimationApp extends Base {
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

    updateExportButtonState() {
      if (this.isExportingVideo) {
        this.exportButton.disabled = true;
        this.animateButton.disabled = true;
        this.exportButton.textContent = "Recording Video...";
        return;
      }

      this.exportButton.disabled = false;
      this.animateButton.disabled = false;
      this.exportButton.textContent = this.animatePoints ? "↓ Export Video" : "↓ Export PNG";
    }

    setPointAnimationEnabled(enabled: boolean) {
      this.animatePoints = Boolean(enabled);
      this.animateButton.classList.toggle("active", this.animatePoints);
      this.animateButton.setAttribute("aria-pressed", String(this.animatePoints));
      this.animateButton.textContent = this.animatePoints ? "Animate: On" : "Animate: Off";
      this.updateExportButtonState();

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
      if (this.isExportingVideo) return;
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
  };
}

import { useEffect, useRef, useState } from "react";

type TooltipMode = "closed" | "hover" | "pinned";

const BRAND_HELP =
  "Drag to warp. Click a point for color. Double-click the canvas to add a point.";

export function Title() {
  const [tooltipMode, setTooltipMode] = useState<TooltipMode>("closed");
  const helpRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tooltipMode !== "pinned") {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (helpRef.current?.contains(event.target as Node)) {
        return;
      }

      setTooltipMode("closed");
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setTooltipMode("closed");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [tooltipMode]);

  const isTooltipOpen = tooltipMode !== "closed";

  return (
    <div id="brand-mark">
      <div className="logo-symbol">
        <img className="logo-icon" src="/shield.svg" alt="" aria-hidden="true" />
      </div>
      <div className="logo brand-title-group">
        <div className="logo-text">Gradiator</div>
        <div
          className="logo-help"
          ref={helpRef}
          onMouseEnter={() => {
            setTooltipMode((mode) => (mode === "closed" ? "hover" : mode));
          }}
          onMouseLeave={() => {
            setTooltipMode((mode) => (mode === "hover" ? "closed" : mode));
          }}
        >
          <button
            type="button"
            className="logo-help-button"
            aria-label="Toggle Gradiator help"
            aria-controls="brand-mark-tooltip"
            aria-expanded={isTooltipOpen}
            onClick={() => {
              setTooltipMode((mode) => (mode === "pinned" ? "closed" : "pinned"));
            }}
            onFocus={() => {
              setTooltipMode((mode) => (mode === "closed" ? "hover" : mode));
            }}
            onBlur={() => {
              setTooltipMode((mode) => (mode === "hover" ? "closed" : mode));
            }}
          >
            ?
          </button>
          {isTooltipOpen ? (
            <div className="logo-tooltip" id="brand-mark-tooltip" role="tooltip">
              {BRAND_HELP}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

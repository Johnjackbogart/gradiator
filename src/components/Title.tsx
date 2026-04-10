import { useEffect, useLayoutEffect, useRef, useState } from "react";

type TooltipMode = "closed" | "hover" | "pinned";
type TooltipAnchor = { x: number; y: number };

const TOOLTIP_MARGIN = 12;

const BRAND_HELP = `Drag to warp. Click a point for color. Double-click the canvas to add a point.\n\n
   This site is inspired by meshgradient.com, I wanted a more robust option. \n\n
   I have been using it to make phone backgrounds
  `;

const tooltipText = BRAND_HELP.replace(/^[ \t]+/gm, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

export function Title() {
  const [tooltipMode, setTooltipMode] = useState<TooltipMode>("closed");
  const [tooltipAnchor, setTooltipAnchor] = useState<TooltipAnchor>({
    x: TOOLTIP_MARGIN,
    y: TOOLTIP_MARGIN,
  });
  const [tooltipPosition, setTooltipPosition] = useState<TooltipAnchor>({
    x: TOOLTIP_MARGIN,
    y: TOOLTIP_MARGIN,
  });
  const helpRef = useRef<HTMLDivElement | null>(null);
  const helpButtonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

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

  useLayoutEffect(() => {
    if (!isTooltipOpen) {
      return undefined;
    }

    function updateTooltipPosition() {
      const tooltip = tooltipRef.current;
      if (!tooltip) {
        return;
      }

      const tooltipRect = tooltip.getBoundingClientRect();
      const maxX = Math.max(
        TOOLTIP_MARGIN,
        window.innerWidth - tooltipRect.width - TOOLTIP_MARGIN,
      );
      const maxY = Math.max(
        TOOLTIP_MARGIN,
        window.innerHeight - tooltipRect.height - TOOLTIP_MARGIN,
      );
      const nextPosition = {
        x: Math.min(Math.max(tooltipAnchor.x, TOOLTIP_MARGIN), maxX),
        y: Math.min(Math.max(tooltipAnchor.y, TOOLTIP_MARGIN), maxY),
      };

      setTooltipPosition((currentPosition) =>
        currentPosition.x === nextPosition.x &&
        currentPosition.y === nextPosition.y
          ? currentPosition
          : nextPosition,
      );
    }

    updateTooltipPosition();
    window.addEventListener("resize", updateTooltipPosition);

    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
    };
  }, [isTooltipOpen, tooltipAnchor]);

  function setTooltipAnchorFromPointer(clientX: number, clientY: number) {
    setTooltipAnchor({ x: clientX, y: clientY });
  }

  function setTooltipAnchorFromButton() {
    const buttonRect = helpButtonRef.current?.getBoundingClientRect();

    if (!buttonRect) {
      return;
    }

    setTooltipAnchor({
      x: buttonRect.left,
      y: buttonRect.bottom + 8,
    });
  }

  return (
    <div id="brand-mark">
      <div className="logo-symbol">
        <img
          className="logo-icon"
          src="/shield.svg"
          alt=""
          aria-hidden="true"
        />
      </div>
      <div className="logo brand-title-group">
        <div className="logo-text">Gradiator</div>
        <div
          className="logo-help"
          ref={helpRef}
          onMouseLeave={() => {
            setTooltipMode((mode) => (mode === "hover" ? "closed" : mode));
          }}
        >
          <button
            type="button"
            className="logo-help-button"
            ref={helpButtonRef}
            aria-label="Toggle Gradiator help"
            aria-controls="brand-mark-tooltip"
            aria-expanded={isTooltipOpen}
            onMouseEnter={(event) => {
              setTooltipAnchorFromPointer(event.clientX, event.clientY);
              setTooltipMode((mode) => (mode === "closed" ? "hover" : mode));
            }}
            onMouseMove={(event) => {
              if (tooltipMode === "pinned") {
                return;
              }

              setTooltipAnchorFromPointer(event.clientX, event.clientY);
            }}
            onClick={(event) => {
              setTooltipAnchorFromPointer(event.clientX, event.clientY);
              setTooltipMode((mode) =>
                mode === "pinned" ? "closed" : "pinned",
              );
            }}
            onFocus={() => {
              setTooltipAnchorFromButton();
              setTooltipMode((mode) => (mode === "closed" ? "hover" : mode));
            }}
            onBlur={() => {
              setTooltipMode((mode) => (mode === "hover" ? "closed" : mode));
            }}
          >
            ?
          </button>
          {isTooltipOpen ? (
            <div
              className="logo-tooltip"
              id="brand-mark-tooltip"
              role="tooltip"
              ref={tooltipRef}
              style={{
                left: tooltipPosition.x,
                top: tooltipPosition.y,
              }}
            >
              {tooltipText}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

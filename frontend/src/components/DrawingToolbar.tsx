import type { ReactElement } from "react";
import type { Tool } from "./DrawingOverlay";

interface Props {
  tool: Tool;
  onTool: (t: Tool) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
}

const ICONS: Record<string, ReactElement> = {
  cursor: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M5 3l14 8-6 1.5L10 19 5 3z" />
    </svg>
  ),
  hline: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path stroke="currentColor" strokeWidth="2" d="M3 12h18" />
    </svg>
  ),
  trend: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path stroke="currentColor" strokeWidth="2" fill="none" d="M4 18L20 6" />
    </svg>
  ),
  rect: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <rect x="4" y="6" width="16" height="12" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ),
  fib: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path stroke="currentColor" strokeWidth="1.6" d="M3 5h18M3 10h18M3 14h18M3 19h18" />
    </svg>
  ),
  measure: (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path stroke="currentColor" strokeWidth="1.6" fill="none" d="M4 16l8-8 4 4-8 8z" />
      <path stroke="currentColor" strokeWidth="1.2" d="M8 12l1 1M11 9l1 1" />
    </svg>
  ),
};

const TOOLS: { tool: Tool; label: string }[] = [
  { tool: "cursor", label: "Cursor" },
  { tool: "hline", label: "Horizontal line" },
  { tool: "trend", label: "Trend line" },
  { tool: "rect", label: "Rectangle" },
  { tool: "fib", label: "Fib retracement" },
  { tool: "measure", label: "Measure" },
];

export function DrawingToolbar({ tool, onTool, onUndo, onClear, canUndo }: Props) {
  return (
    <div className="draw-rail">
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          className={`draw-tool ${tool === t.tool ? "active" : ""}`}
          title={t.label}
          onClick={() => onTool(t.tool)}
        >
          {ICONS[t.tool]}
        </button>
      ))}
      <div className="draw-sep" />
      <button className="draw-tool" title="Undo last" onClick={onUndo} disabled={!canUndo}>
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-1"
          />
        </svg>
      </button>
      <button className="draw-tool" title="Clear all" onClick={onClear} disabled={!canUndo}>
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            d="M6 7h12M9 7V5h6v2M7 7l1 13h8l1-13"
          />
        </svg>
      </button>
    </div>
  );
}

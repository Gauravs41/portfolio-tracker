import { useCallback, useEffect, useMemo, useRef } from "react";
import type { IChartApi, ISeriesApi, Logical, Time } from "lightweight-charts";
import type { ChartDrawing, DrawingPoint, DrawingType } from "../types";
import { SINGLE_CLICK, ScreenMapper, drawShape } from "../lib/drawings";

export type Tool = DrawingType | "cursor";

interface Props {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  tool: Tool;
  color: string;
  times: string[];
  drawings: ChartDrawing[];
  onChange: (drawings: ChartDrawing[]) => void;
  onToolDone: () => void;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Transparent canvas over the chart for drawing annotations. */
export function DrawingOverlay({
  chart,
  series,
  tool,
  color,
  times,
  drawings,
  onChange,
  onToolDone,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);
  const anchorRef = useRef<DrawingPoint | null>(null);
  const hoverRef = useRef<DrawingPoint | null>(null);
  const downXYRef = useRef<{ x: number; y: number } | null>(null);
  const brushRef = useRef<DrawingPoint[]>([]);
  const measureRef = useRef<ChartDrawing | null>(null);
  const renderRef = useRef<() => void>(() => {});

  // Map bar time <-> logical index. Anchoring drawings by logical index (rather
  // than time) keeps them glued to the chart while panning/zooming and lets the
  // coordinate round-trip stay exact, since logicalToCoordinate is the precise
  // inverse of coordinateToLogical and also resolves off-screen positions.
  const timeIndex = useMemo(() => {
    const m = new Map<string, number>();
    times.forEach((t, i) => m.set(t, i));
    return m;
  }, [times]);

  const mapper = useCallback(
    (): ScreenMapper => {
      const ts = chart.timeScale();
      // Resolve a point's logical bar index: prefer the stored float; fall back
      // to the snapped time (legacy points saved before logical anchoring).
      const logicalOf = (p: DrawingPoint): number | null => {
        if (p.logical != null) return p.logical;
        if (p.time != null) {
          const i = timeIndex.get(p.time);
          if (i != null) return i;
        }
        return null;
      };
      return {
        toX: (p) => {
          const l = logicalOf(p);
          if (l != null) return ts.logicalToCoordinate(l as Logical);
          // Time not on the current scale (e.g. interval switch): best effort.
          return p.time != null ? ts.timeToCoordinate(p.time as Time) : null;
        },
        toY: (price) => series.priceToCoordinate(price),
        idxOf: (p) => {
          const l = logicalOf(p);
          return l == null ? null : Math.round(l);
        },
      };
    },
    [chart, series, timeIndex],
  );

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    // Skip while the overlay has no box (e.g. mid-layout). Cap the backing store
    // so we never allocate an over-large canvas (Chrome renders that as a broken
    // image). Use one uniform scale for BOTH the backing store and the context
    // transform so drawings are never stretched away from the pointer.
    if (w <= 0 || h <= 0) return;
    const MAX = 6000;
    const scale = Math.min(dpr, MAX / w, MAX / h);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const m = mapper();
    for (const d of drawings) drawShape(ctx, d, m, w, h);
    if (measureRef.current) drawShape(ctx, measureRef.current, m, w, h);

    // Live preview of the in-progress drawing (drag or freehand).
    if (tool !== "cursor") {
      let pts: DrawingPoint[] | null = null;
      if (tool === "brush" && brushRef.current.length) {
        pts = brushRef.current;
      } else if (anchorRef.current && hoverRef.current) {
        pts = [anchorRef.current, hoverRef.current];
      }
      if (pts && pts.length) {
        drawShape(ctx, { id: "preview", type: tool, points: pts, color }, m, w, h);
      }
    }
  }, [tool, color, drawings, mapper]);

  // Keep latest render available to chart subscriptions.
  renderRef.current = render;

  useEffect(() => {
    render();
  }, [render]);

  // Redraw on pan/zoom + container resize.
  useEffect(() => {
    const ts = chart.timeScale();
    const cb = () => renderRef.current();
    ts.subscribeVisibleLogicalRangeChange(cb);
    const canvas = canvasRef.current;
    const ro = canvas ? new ResizeObserver(() => renderRef.current()) : null;
    if (canvas && ro) ro.observe(canvas);
    return () => {
      ts.unsubscribeVisibleLogicalRangeChange(cb);
      ro?.disconnect();
    };
  }, [chart]);

  // Reset in-progress state when the active tool changes.
  useEffect(() => {
    draggingRef.current = false;
    anchorRef.current = null;
    hoverRef.current = null;
    brushRef.current = [];
    if (tool !== "measure") measureRef.current = null;
    render();
  }, [tool]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map a mouse event to a drawing point. X is the exact fractional logical
  // bar index under the cursor (no snapping), so the drawing lands precisely
  // where pointed and stays anchored on pan/zoom. `time` is kept as a snapped
  // reference for display / legacy interop.
  const pointAt = (e: React.PointerEvent): DrawingPoint | null => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const price = series.coordinateToPrice(y);
    if (price == null) return null;
    const logical = chart.timeScale().coordinateToLogical(x);
    if (logical == null) return null;
    const point: DrawingPoint = { logical, price: Number(price) };
    if (times.length) {
      const idx = Math.max(0, Math.min(times.length - 1, Math.round(logical)));
      point.time = times[idx];
    }
    return point;
  };

  const commit = (d: Omit<ChartDrawing, "id" | "color">) => {
    onChange([...drawings, { id: uid(), color, ...d }]);
    onToolDone();
  };

  const onDown = (e: React.PointerEvent) => {
    if (tool === "cursor") return;
    const p = pointAt(e);
    if (!p) return;
    // Capture the pointer so a drag still finalizes if it leaves the canvas.
    canvasRef.current?.setPointerCapture(e.pointerId);
    downXYRef.current = { x: e.clientX, y: e.clientY };

    if (SINGLE_CLICK.has(tool)) {
      if (tool === "text") {
        const txt = window.prompt("Text label:");
        if (txt) commit({ type: "text", points: [p], text: txt });
      } else {
        // hline (price only) / vline (time only) place on a single click.
        commit({ type: tool, points: [p] });
      }
      return;
    }

    draggingRef.current = true;
    if (tool === "brush") {
      brushRef.current = [p];
    } else {
      anchorRef.current = p;
      hoverRef.current = p;
    }
    render();
  };

  const onMove = (e: React.PointerEvent) => {
    if (tool === "cursor") return;
    const p = pointAt(e);
    if (!p) return;
    hoverRef.current = p;
    if (draggingRef.current && tool === "brush") brushRef.current.push(p);
    render();
  };

  const moved = (e: React.PointerEvent) => {
    const d = downXYRef.current;
    if (!d) return true;
    return Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 4;
  };

  const onUp = (e: React.PointerEvent) => {
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
    if (tool === "cursor" || !draggingRef.current) return;
    draggingRef.current = false;

    if (tool === "brush") {
      const pts = brushRef.current;
      brushRef.current = [];
      if (pts.length >= 2) commit({ type: "brush", points: pts });
      else render();
      return;
    }

    const a = anchorRef.current;
    const b = pointAt(e) ?? hoverRef.current;
    anchorRef.current = null;
    // Treat a non-drag (tiny movement) as an accidental click → cancel.
    if (!a || !b || !moved(e)) {
      render();
      return;
    }
    if (tool === "measure") {
      measureRef.current = { id: uid(), type: "measure", points: [a, b], color };
      render();
    } else {
      commit({ type: tool, points: [a, b] });
    }
  };

  const onLeave = () => {
    // With pointer capture, an active drag keeps receiving events, so only
    // clear the hover preview here (don't cancel an in-progress drag).
    if (draggingRef.current) return;
    hoverRef.current = null;
    render();
  };

  return (
    <canvas
      ref={canvasRef}
      className="drawing-overlay"
      style={{ pointerEvents: tool === "cursor" ? "none" : "auto", cursor: "crosshair" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onLeave}
    />
  );
}

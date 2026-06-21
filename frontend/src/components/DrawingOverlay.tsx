import { useCallback, useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
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

function timeToStr(t: Time | null): string | null {
  if (t == null) return null;
  if (typeof t === "string") return t;
  if (typeof t === "number") return new Date(t * 1000).toISOString().slice(0, 10);
  const b = t as { year: number; month: number; day: number };
  const mm = String(b.month).padStart(2, "0");
  const dd = String(b.day).padStart(2, "0");
  return `${b.year}-${mm}-${dd}`;
}

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

  const mapper = useCallback(
    (): ScreenMapper => ({
      toX: (time) => chart.timeScale().timeToCoordinate(time as Time),
      toY: (price) => series.priceToCoordinate(price),
    }),
    [chart, series],
  );

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    // Skip while the overlay has no box (e.g. mid-layout) so we never allocate a
    // zero- or over-large backing store, which Chrome renders as a broken image.
    if (w <= 0 || h <= 0) return;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  // Map a mouse event to a {time, price}, clamping to the nearest bar at edges.
  const pointAt = (e: React.PointerEvent): DrawingPoint | null => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const price = series.coordinateToPrice(y);
    if (price == null) return null;
    let time = timeToStr(chart.timeScale().coordinateToTime(x));
    if (time == null && times.length) {
      // Past the last bar / before the first: clamp to an edge bar so the
      // drawing still anchors to data and survives interval switches.
      time = x <= 0 ? times[0] : times[times.length - 1];
    }
    if (time == null) return null;
    return { time, price: Number(price) };
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

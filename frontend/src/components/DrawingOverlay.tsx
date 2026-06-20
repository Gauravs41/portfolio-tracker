import { useCallback, useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { ChartDrawing, DrawingType } from "../types";
import { POINTS_NEEDED, ScreenMapper, drawShape } from "../lib/drawings";

export type Tool = DrawingType | "cursor";

interface Props {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  tool: Tool;
  color: string;
  drawings: ChartDrawing[];
  onChange: (drawings: ChartDrawing[]) => void;
  onToolDone: () => void;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function timeToStr(t: Time | null): string | null {
  if (t == null) return null;
  if (typeof t === "string") return t;
  if (typeof t === "number") return new Date(t * 1000).toISOString().slice(0, 10);
  // BusinessDay object
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
  drawings,
  onChange,
  onToolDone,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingRef = useRef<{ time: string; price: number }[]>([]);
  const hoverRef = useRef<{ time: string; price: number } | null>(null);
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
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const m = mapper();
    for (const d of drawings) drawShape(ctx, d, m, w);
    if (measureRef.current) drawShape(ctx, measureRef.current, m, w);

    // Live preview of the in-progress drawing.
    const pending = pendingRef.current;
    if (tool !== "cursor" && (pending.length > 0 || hoverRef.current)) {
      const pts = hoverRef.current ? [...pending, hoverRef.current] : pending;
      if (pts.length) {
        drawShape(
          ctx,
          { id: "preview", type: tool, points: pts, color },
          m,
          w,
        );
      }
    }
  }, [chart, series, tool, color, drawings, mapper]);

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
    pendingRef.current = [];
    if (tool !== "measure") measureRef.current = null;
    render();
  }, [tool]); // eslint-disable-line react-hooks/exhaustive-deps

  const eventPoint = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = timeToStr(chart.timeScale().coordinateToTime(x));
    const price = series.coordinateToPrice(y);
    if (time == null || price == null) return null;
    return { time, price: Number(price) };
  };

  const onClick = (e: React.MouseEvent) => {
    if (tool === "cursor") return;
    const p = eventPoint(e);
    if (!p) return;
    const next = [...pendingRef.current, p];
    if (next.length >= POINTS_NEEDED[tool]) {
      const d: ChartDrawing = { id: uid(), type: tool, points: next, color };
      pendingRef.current = [];
      if (tool === "measure") {
        measureRef.current = d;
        render();
      } else {
        onChange([...drawings, d]);
        onToolDone();
      }
    } else {
      pendingRef.current = next;
      render();
    }
  };

  const onMove = (e: React.MouseEvent) => {
    if (tool === "cursor") return;
    hoverRef.current = eventPoint(e);
    render();
  };

  const onLeave = () => {
    hoverRef.current = null;
    render();
  };

  return (
    <canvas
      ref={canvasRef}
      className="drawing-overlay"
      style={{ pointerEvents: tool === "cursor" ? "none" : "auto", cursor: "crosshair" }}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    />
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, Logical, Time } from "lightweight-charts";
import type { ChartDrawing, DrawingPoint, DrawingType } from "../types";
import {
  SINGLE_CLICK,
  ScreenMapper,
  drawSelection,
  drawShape,
  hitTest,
  type Hit,
} from "../lib/drawings";

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
  /** Open the alert dialog pre-bound to this drawing. */
  onAddAlert?: (drawingId: string) => void;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// Types whose price can be watched by a drawing-cross alert.
const ALERTABLE = new Set<DrawingType>(["hline", "trend", "ray"]);

interface ContextMenu {
  x: number;
  y: number;
  id: string;
}

/** Transparent canvas over the chart for drawing + editing annotations. */
export function DrawingOverlay({
  chart,
  series,
  tool,
  color,
  times,
  drawings,
  onChange,
  onToolDone,
  onAddAlert,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);
  const anchorRef = useRef<DrawingPoint | null>(null);
  const hoverRef = useRef<DrawingPoint | null>(null);
  const downXYRef = useRef<{ x: number; y: number } | null>(null);
  const brushRef = useRef<DrawingPoint[]>([]);
  const measureRef = useRef<ChartDrawing | null>(null);
  const renderRef = useRef<() => void>(() => {});

  // Cursor-mode editing state.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const editRef = useRef<
    { id: string; mode: "endpoint" | "body"; index: number; last: DrawingPoint } | null
  >(null);
  const [menu, setMenu] = useState<ContextMenu | null>(null);
  const drawingsRef = useRef(drawings);
  drawingsRef.current = drawings;

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

    // Selection handles (cursor mode).
    if (selectedId) {
      const sel = drawings.find((d) => d.id === selectedId);
      if (sel) drawSelection(ctx, sel, m);
    }

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
  }, [tool, color, drawings, mapper, selectedId]);

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
    if (tool !== "cursor") {
      setSelectedId(null);
      setMenu(null);
    }
    render();
  }, [tool]); // eslint-disable-line react-hooks/exhaustive-deps

  // In cursor mode the canvas is click-through by default so the chart pans;
  // flip it to interactive only while the pointer is over a drawing. A window
  // listener handles this so we can detect hover even though the canvas isn't
  // receiving events when it's click-through.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (tool !== "cursor") {
      canvas.style.pointerEvents = "auto";
      canvas.style.cursor = "crosshair";
      return;
    }
    canvas.style.cursor = "default";
    const onWinMove = (e: PointerEvent) => {
      if (editRef.current) return; // mid-edit: keep interactive
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        canvas.style.pointerEvents = "none";
        return;
      }
      const m = mapper();
      let hit: Hit | null = null;
      for (let i = drawingsRef.current.length - 1; i >= 0; i--) {
        hit = hitTest(drawingsRef.current[i], m, x, y);
        if (hit) break;
      }
      if (hit) {
        canvas.style.pointerEvents = "auto";
        canvas.style.cursor = hit.kind === "endpoint" ? "pointer" : "move";
      } else {
        canvas.style.pointerEvents = "none";
      }
    };
    window.addEventListener("pointermove", onWinMove);
    return () => window.removeEventListener("pointermove", onWinMove);
  }, [tool, mapper]);

  // Close the context menu / clear selection when clicking elsewhere.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".draw-context-menu")) return;
      setMenu(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  // Delete the selected drawing with Delete/Backspace.
  useEffect(() => {
    if (tool !== "cursor") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdRef.current) {
        onChange(drawingsRef.current.filter((d) => d.id !== selectedIdRef.current));
        setSelectedId(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tool, onChange]);

  // Map a pointer event to a drawing point (exact fractional logical index).
  const pointAt = (e: { clientX: number; clientY: number }): DrawingPoint | null => {
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

  const localXY = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const commit = (d: Omit<ChartDrawing, "id" | "color">) => {
    onChange([...drawings, { id: uid(), color, ...d }]);
    onToolDone();
  };

  const updateDrawing = (id: string, updater: (d: ChartDrawing) => ChartDrawing) => {
    onChange(drawingsRef.current.map((d) => (d.id === id ? updater(d) : d)));
  };

  // ---- Cursor-mode editing (select + drag) ----
  const onDownCursor = (e: React.PointerEvent) => {
    const { x, y } = localXY(e);
    const m = mapper();
    let target: { d: ChartDrawing; hit: Hit } | null = null;
    for (let i = drawings.length - 1; i >= 0; i--) {
      const hit = hitTest(drawings[i], m, x, y);
      if (hit) {
        target = { d: drawings[i], hit };
        break;
      }
    }
    if (!target) {
      setSelectedId(null);
      return;
    }
    e.preventDefault();
    setSelectedId(target.d.id);
    setMenu(null);
    const p = pointAt(e);
    if (!p) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    editRef.current = {
      id: target.d.id,
      mode: target.hit.kind,
      index: target.hit.index,
      last: p,
    };
  };

  const onMoveCursor = (e: React.PointerEvent) => {
    const edit = editRef.current;
    if (!edit) return;
    const p = pointAt(e);
    if (!p) return;
    if (edit.mode === "endpoint") {
      updateDrawing(edit.id, (d) => {
        const points = d.points.map((pt, i) => (i === edit.index ? p : pt));
        return { ...d, points };
      });
    } else {
      const dl = (p.logical ?? 0) - (edit.last.logical ?? 0);
      const dp = p.price - edit.last.price;
      updateDrawing(edit.id, (d) => {
        const points = d.points.map((pt) => {
          const logical = (pt.logical ?? 0) + dl;
          const price = pt.price + dp;
          const next: DrawingPoint = { logical, price };
          if (times.length) {
            const idx = Math.max(0, Math.min(times.length - 1, Math.round(logical)));
            next.time = times[idx];
          }
          return next;
        });
        return { ...d, points };
      });
    }
    edit.last = p;
  };

  const onUpCursor = (e: React.PointerEvent) => {
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
    editRef.current = null;
  };

  const onContextMenu = (e: React.PointerEvent | React.MouseEvent) => {
    if (tool !== "cursor") return;
    const { x, y } = localXY(e);
    const m = mapper();
    for (let i = drawings.length - 1; i >= 0; i--) {
      if (hitTest(drawings[i], m, x, y)) {
        e.preventDefault();
        setSelectedId(drawings[i].id);
        setMenu({ x, y, id: drawings[i].id });
        return;
      }
    }
  };

  // ---- Drawing-creation (tool !== cursor) ----
  const onDown = (e: React.PointerEvent) => {
    if (tool === "cursor") {
      onDownCursor(e);
      return;
    }
    const p = pointAt(e);
    if (!p) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    downXYRef.current = { x: e.clientX, y: e.clientY };

    if (SINGLE_CLICK.has(tool)) {
      if (tool === "text") {
        const txt = window.prompt("Text label:");
        if (txt) commit({ type: "text", points: [p], text: txt });
      } else {
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
    if (tool === "cursor") {
      onMoveCursor(e);
      return;
    }
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
    if (tool === "cursor") {
      onUpCursor(e);
      return;
    }
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
    if (!draggingRef.current) return;
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
    if (draggingRef.current || editRef.current) return;
    hoverRef.current = null;
    render();
  };

  const menuDrawing = menu ? drawings.find((d) => d.id === menu.id) : null;

  const rename = (d: ChartDrawing) => {
    const next = window.prompt("Label / note for this drawing:", d.name ?? "");
    if (next != null) updateDrawing(d.id, (x) => ({ ...x, name: next.trim() }));
    setMenu(null);
  };

  const removeDrawing = (id: string) => {
    onChange(drawingsRef.current.filter((d) => d.id !== id));
    setSelectedId(null);
    setMenu(null);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="drawing-overlay"
        style={{
          pointerEvents: tool === "cursor" ? "none" : "auto",
          cursor: tool === "cursor" ? "default" : "crosshair",
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onLeave}
        onContextMenu={onContextMenu}
      />
      {menu && menuDrawing && (
        <div
          className="draw-context-menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {onAddAlert && ALERTABLE.has(menuDrawing.type) && (
            <button
              onClick={() => {
                onAddAlert(menuDrawing.id);
                setMenu(null);
              }}
            >
              🔔 Add alert on this line
            </button>
          )}
          <button onClick={() => rename(menuDrawing)}>✏️ Rename / add note</button>
          <button onClick={() => removeDrawing(menuDrawing.id)}>🗑 Delete</button>
        </div>
      )}
    </>
  );
}

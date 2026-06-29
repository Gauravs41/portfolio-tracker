import type { ChartDrawing, DrawingPoint, DrawingType } from "../types";

/** Maps a drawing point (logical bar index / price) to overlay pixels. */
export interface ScreenMapper {
  toX: (p: DrawingPoint) => number | null;
  toY: (price: number) => number | null;
  /** Bar index of a point, for span measurements. null if off the scale. */
  idxOf: (p: DrawingPoint) => number | null;
}

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/** How many clicked points each tool needs before it is complete. */
export const POINTS_NEEDED: Record<DrawingType, number> = {
  hline: 1,
  vline: 1,
  text: 1,
  trend: 2,
  ray: 2,
  rect: 2,
  fib: 2,
  measure: 2,
  brush: 0, // freehand: finalized on pointer-up
};

/** Tools placed with a single click rather than a click-drag. */
export const SINGLE_CLICK: ReadonlySet<DrawingType> = new Set([
  "hline",
  "vline",
  "text",
]);

export const DEFAULT_COLOR = "#4c8dff";

interface Pt {
  x: number | null;
  y: number | null;
  price: number;
}

const map = (d: ChartDrawing, m: ScreenMapper): Pt[] =>
  d.points.map((p) => ({ x: m.toX(p), y: m.toY(p.price), price: p.price }));

function tag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
  ctx.save();
  ctx.font = "11px -apple-system, system-ui, sans-serif";
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = color;
  ctx.fillRect(x, y - 8, w, 16);
  ctx.fillStyle = "#0f1115";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 4, y + 1);
  ctx.restore();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Default display label for a drawing (used on chart + in the alert picker). */
export function drawingLabel(d: ChartDrawing, index: number): string {
  if (d.name && d.name.trim()) return d.name.trim();
  const pretty: Partial<Record<DrawingType, string>> = {
    trend: "Trend",
    ray: "Ray",
    hline: "H-Line",
    vline: "V-Line",
    rect: "Rect",
    fib: "Fib",
    brush: "Brush",
    text: "Text",
    measure: "Measure",
  };
  return `${pretty[d.type] ?? d.type} #${index + 1}`;
}

// --- Hit-testing (for selecting / editing drawings in cursor mode) ---
const HANDLE_R = 7; // px grab radius around an endpoint
const LINE_TOL = 6; // px grab distance to a line/edge

export interface Hit {
  kind: "endpoint" | "body";
  index: number; // endpoint index (or 0 for body)
}

function distToSeg(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Return what part of a drawing is under (x, y), or null if nothing is. */
export function hitTest(
  d: ChartDrawing,
  m: ScreenMapper,
  x: number,
  y: number,
): Hit | null {
  const pts = map(d, m);
  // Endpoints take priority so they stay grabbable even on top of the body.
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.x == null || p.y == null) continue;
    if (Math.hypot(p.x - x, p.y - y) <= HANDLE_R) return { kind: "endpoint", index: i };
  }

  switch (d.type) {
    case "hline": {
      const y0 = pts[0]?.y;
      return y0 != null && Math.abs(y - y0) <= LINE_TOL ? { kind: "body", index: 0 } : null;
    }
    case "vline": {
      const x0 = pts[0]?.x;
      return x0 != null && Math.abs(x - x0) <= LINE_TOL ? { kind: "body", index: 0 } : null;
    }
    case "trend":
    case "ray":
    case "measure": {
      const [a, b] = pts;
      if (a?.x == null || a.y == null || b?.x == null || b.y == null) return null;
      return distToSeg(x, y, a.x, a.y, b.x, b.y) <= LINE_TOL ? { kind: "body", index: 0 } : null;
    }
    case "rect":
    case "fib": {
      const [a, b] = pts;
      if (a?.x == null || a.y == null || b?.x == null || b.y == null) return null;
      const x1 = Math.min(a.x, b.x);
      const x2 = Math.max(a.x, b.x);
      const y1 = Math.min(a.y, b.y);
      const y2 = Math.max(a.y, b.y);
      const nearV = (Math.abs(x - x1) <= LINE_TOL || Math.abs(x - x2) <= LINE_TOL) &&
        y >= y1 - LINE_TOL && y <= y2 + LINE_TOL;
      const nearH = (Math.abs(y - y1) <= LINE_TOL || Math.abs(y - y2) <= LINE_TOL) &&
        x >= x1 - LINE_TOL && x <= x2 + LINE_TOL;
      return nearV || nearH ? { kind: "body", index: 0 } : null;
    }
    case "text": {
      const p = pts[0];
      if (p?.x == null || p.y == null) return null;
      return x >= p.x - 2 && x <= p.x + 90 && y >= p.y - 4 && y <= p.y + 18
        ? { kind: "body", index: 0 }
        : null;
    }
    case "brush": {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (a.x == null || a.y == null || b.x == null || b.y == null) continue;
        if (distToSeg(x, y, a.x, a.y, b.x, b.y) <= LINE_TOL) return { kind: "body", index: 0 };
      }
      return null;
    }
  }
  return null;
}

/** Outline a selected drawing's endpoints with grab handles. */
export function drawSelection(ctx: CanvasRenderingContext2D, d: ChartDrawing, m: ScreenMapper) {
  const pts = map(d, m);
  ctx.save();
  for (const p of pts) {
    if (p.x == null || p.y == null) continue;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#4c8dff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Render a single drawing onto the overlay canvas context. */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  d: ChartDrawing,
  m: ScreenMapper,
  width: number,
  height: number,
) {
  const pts = map(d, m);
  ctx.save();
  ctx.strokeStyle = d.color;
  ctx.fillStyle = d.color;
  ctx.lineWidth = 1.5;

  switch (d.type) {
    case "hline": {
      const y = pts[0]?.y;
      if (y == null) break;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      tag(ctx, width - 64, y, pts[0].price.toFixed(2), d.color);
      break;
    }

    case "vline": {
      const x = pts[0]?.x;
      if (x == null) break;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      break;
    }

    case "trend": {
      const [a, b] = pts;
      if (a?.x == null || a.y == null || b?.x == null || b.y == null) break;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      dot(ctx, a.x, a.y, d.color);
      dot(ctx, b.x, b.y, d.color);
      break;
    }

    case "ray": {
      const [a, b] = pts;
      if (a?.x == null || a.y == null || b?.x == null || b.y == null) break;
      // Extend the A→B direction to the canvas edge.
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const far = (width + height) * 2;
      const ex = a.x + (dx / len) * far;
      const ey = a.y + (dy / len) * far;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      dot(ctx, a.x, a.y, d.color);
      break;
    }

    case "rect": {
      const [a, b] = pts;
      if (a?.x == null || a.y == null || b?.x == null || b.y == null) break;
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      ctx.globalAlpha = 0.12;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeRect(x, y, w, h);
      break;
    }

    case "fib": {
      const [a, b] = pts;
      if (a?.x == null || a.y == null || b?.x == null || b.y == null) break;
      const x1 = Math.min(a.x, b.x);
      const x2 = Math.max(a.x, b.x);
      const hi = Math.max(a.price, b.price);
      const lo = Math.min(a.price, b.price);
      ctx.font = "10px -apple-system, system-ui, sans-serif";
      ctx.textBaseline = "bottom";
      for (const lvl of FIB_LEVELS) {
        const price = hi - (hi - lo) * lvl;
        const y = m.toY(price);
        if (y == null) continue;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillText(`${(lvl * 100).toFixed(1)}%  ${price.toFixed(2)}`, x1 + 4, y - 2);
      }
      break;
    }

    case "brush": {
      ctx.beginPath();
      let started = false;
      for (const p of pts) {
        if (p.x == null || p.y == null) continue;
        if (!started) {
          ctx.moveTo(p.x, p.y);
          started = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      if (started) ctx.stroke();
      break;
    }

    case "text": {
      const p = pts[0];
      if (p?.x == null || p.y == null) break;
      ctx.font = "13px -apple-system, system-ui, sans-serif";
      ctx.textBaseline = "top";
      ctx.fillStyle = d.color;
      ctx.fillText(d.text ?? "", p.x, p.y);
      break;
    }

    case "measure": {
      const [a, b] = pts;
      if (a?.x == null || a.y == null || b?.x == null || b.y == null) break;
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      const up = b.price >= a.price;
      ctx.strokeStyle = up ? "#26a69a" : "#ef5350";
      ctx.fillStyle = up ? "#26a69a" : "#ef5350";
      ctx.globalAlpha = 0.12;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      const diff = b.price - a.price;
      const pct = a.price ? (diff / a.price) * 100 : 0;
      const ia = m.idxOf(d.points[0]);
      const ib = m.idxOf(d.points[1]);
      const bars = ia != null && ib != null ? Math.abs(ib - ia) : null;
      const span = bars != null ? `, ${bars} bar${bars === 1 ? "" : "s"}` : "";
      const label = `${diff >= 0 ? "+" : ""}${diff.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)${span}`;
      tag(ctx, x + w / 2 - 40, y - 2, label, up ? "#26a69a" : "#ef5350");
      break;
    }
  }

  // User label (name/note) drawn near the drawing's first on-screen anchor.
  if (d.name && d.name.trim() && d.type !== "text") {
    const anchor = pts.find((p) => p.x != null && p.y != null);
    if (anchor && anchor.x != null && anchor.y != null) {
      ctx.font = "11px -apple-system, system-ui, sans-serif";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = d.color;
      ctx.fillText(d.name.trim(), anchor.x + 6, anchor.y - 6);
    }
  }
  ctx.restore();
}

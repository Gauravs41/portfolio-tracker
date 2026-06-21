import type { ChartDrawing, DrawingType } from "../types";

/** Maps data values (bar time / price) to pixel coordinates on the overlay. */
export interface ScreenMapper {
  toX: (time: string) => number | null;
  toY: (price: number) => number | null;
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
  d.points.map((p) => ({ x: m.toX(p.time), y: m.toY(p.price), price: p.price }));

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
      const label = `${diff >= 0 ? "+" : ""}${diff.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`;
      tag(ctx, x + w / 2 - 40, y - 2, label, up ? "#26a69a" : "#ef5350");
      break;
    }
  }
  ctx.restore();
}

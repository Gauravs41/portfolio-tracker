import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Candle, ChartDrawing, RsiInterval } from "../types";
import {
  DEFAULT_INDICATORS,
  StockChart,
  type IndicatorState,
} from "./StockChart";
import { DrawingToolbar } from "./DrawingToolbar";
import type { Tool } from "./DrawingOverlay";

const INTERVALS: { value: RsiInterval; label: string }[] = [
  { value: "day", label: "1D" },
  { value: "week", label: "1W" },
  { value: "month", label: "1M" },
];

const TOGGLES: { key: keyof IndicatorState; label: string; color: string }[] = [
  { key: "sma20", label: "SMA 20", color: "#2962FF" },
  { key: "sma50", label: "SMA 50", color: "#FF6D00" },
  { key: "ema20", label: "EMA 20", color: "#AB47BC" },
  { key: "bollinger", label: "Bollinger", color: "#787B86" },
  { key: "volume", label: "Volume", color: "#26a69a" },
  { key: "rsi", label: "RSI 14", color: "#c792ea" },
];

const STORE_KEY = "chart:indicators";

function loadIndicators(): IndicatorState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...DEFAULT_INDICATORS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_INDICATORS;
}

interface Props {
  instrumentKey: string;
  symbol: string;
  name: string;
}

/** Interval pills + indicator menu + drawing rail + data fetch + persistence. */
export function ChartView({ instrumentKey, symbol, name }: Props) {
  const [interval, setIntervalState] = useState<RsiInterval>("day");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [indicators, setIndicators] = useState<IndicatorState>(loadIndicators);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("cursor");
  const [color, setColor] = useState("#4c8dff");
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const skipSaveRef = useRef(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .candles(instrumentKey, interval)
      .then((r) => alive && setCandles(r.candles))
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [instrumentKey, interval]);

  // Load saved drawings for the instrument (shared across intervals).
  useEffect(() => {
    let alive = true;
    skipSaveRef.current = true;
    api
      .getDrawings(instrumentKey)
      .then((r) => alive && setDrawings(r.drawings ?? []))
      .catch(() => alive && setDrawings([]));
    return () => {
      alive = false;
    };
  }, [instrumentKey]);

  // Debounced persistence on change (skips the initial load).
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      api.saveDrawings(instrumentKey, drawings).catch(() => {});
    }, 600);
    return () => window.clearTimeout(t);
  }, [drawings, instrumentKey]);

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(indicators));
  }, [indicators]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // Esc cancels an in-progress drawing / returns to cursor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && tool !== "cursor") setTool("cursor");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tool]);

  const toggle = (key: keyof IndicatorState) =>
    setIndicators((s) => ({ ...s, [key]: !s[key] }));

  const last = candles.length ? candles[candles.length - 1] : undefined;
  const prev = candles.length > 1 ? candles[candles.length - 2] : undefined;
  const change =
    last && prev && prev.close ? ((last.close - prev.close) / prev.close) * 100 : null;

  return (
    <div className="chart-view">
      <div className="chart-toolbar">
        <div className="chart-title">
          <span className="chart-symbol">{symbol}</span>
          <span className="chart-name">{name}</span>
          {last && (
            <span className="chart-quote">
              ₹{last.close.toFixed(2)}
              {change !== null && (
                <span className={change >= 0 ? "pos" : "neg"}>
                  {" "}
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(2)}%
                </span>
              )}
            </span>
          )}
        </div>

        <div className="row" style={{ gap: 8 }}>
          <div className="chart-intervals">
            {INTERVALS.map((iv) => (
              <button
                key={iv.value}
                className={`chart-iv ${interval === iv.value ? "active" : ""}`}
                onClick={() => setIntervalState(iv.value)}
              >
                {iv.label}
              </button>
            ))}
          </div>

          <input
            type="color"
            className="draw-color"
            value={color}
            title="Drawing color"
            onChange={(e) => setColor(e.target.value)}
          />

          <div className="col-menu-wrap" ref={menuRef}>
            <button className="ghost" onClick={() => setMenuOpen((o) => !o)}>
              Indicators ▾
            </button>
            {menuOpen && (
              <div className="col-menu">
                {TOGGLES.map((t) => (
                  <label key={t.key} className="col-menu-item">
                    <input
                      type="checkbox"
                      checked={indicators[t.key]}
                      onChange={() => toggle(t.key)}
                    />
                    <span className="ind-swatch" style={{ background: t.color }} />
                    {t.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="chart-main">
        <DrawingToolbar
          tool={tool}
          onTool={setTool}
          onUndo={() => setDrawings((d) => d.slice(0, -1))}
          onClear={() => setDrawings([])}
          canUndo={drawings.length > 0}
        />
        <div className="chart-canvas">
          {error ? (
            <div className="error">{error}</div>
          ) : loading && candles.length === 0 ? (
            <p className="muted">Loading chart…</p>
          ) : candles.length === 0 ? (
            <p className="muted">No candle data available.</p>
          ) : (
            <StockChart
              candles={candles}
              indicators={indicators}
              tool={tool}
              drawingColor={color}
              drawings={drawings}
              onDrawingsChange={setDrawings}
              onToolDone={() => setTool("cursor")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

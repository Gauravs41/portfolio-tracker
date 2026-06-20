import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Candle, RsiInterval } from "../types";
import { StockChart } from "./StockChart";

const INTERVALS: { value: RsiInterval; label: string }[] = [
  { value: "day", label: "1D" },
  { value: "week", label: "1W" },
  { value: "month", label: "1M" },
];

interface Props {
  instrumentKey: string;
  symbol: string;
  name: string;
  onClose: () => void;
}

export function ChartModal({ instrumentKey, symbol, name, onClose }: Props) {
  const [interval, setInterval] = useState<RsiInterval>("day");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const last = candles.length ? candles[candles.length - 1] : undefined;
  const prev = candles.length > 1 ? candles[candles.length - 2] : undefined;
  const change =
    last && prev && prev.close ? ((last.close - prev.close) / prev.close) * 100 : null;

  return (
    <div className="chart-overlay" onMouseDown={onClose}>
      <div className="chart-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="chart-head">
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
                  onClick={() => setInterval(iv.value)}
                >
                  {iv.label}
                </button>
              ))}
            </div>
            <button className="ghost chart-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="chart-body">
          {error ? (
            <div className="error">{error}</div>
          ) : loading && candles.length === 0 ? (
            <p className="muted">Loading chart…</p>
          ) : candles.length === 0 ? (
            <p className="muted">No candle data available.</p>
          ) : (
            <StockChart candles={candles} />
          )}
        </div>
      </div>
    </div>
  );
}

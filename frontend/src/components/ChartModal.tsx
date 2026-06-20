import { useEffect, useState } from "react";
import { ChartView } from "./ChartView";

interface Props {
  instrumentKey: string;
  symbol: string;
  name: string;
  onClose: () => void;
}

export function ChartModal({ instrumentKey, symbol, name, onClose }: Props) {
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (full) setFull(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, full]);

  const newTabHref =
    `/chart/${encodeURIComponent(instrumentKey)}` +
    `?symbol=${encodeURIComponent(symbol)}&name=${encodeURIComponent(name)}`;

  return (
    <div className="chart-overlay" onMouseDown={onClose}>
      <div
        className={`chart-modal ${full ? "full" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="chart-head">
          <span className="chart-head-label">Chart</span>
          <div className="row" style={{ gap: 8 }}>
            <a
              className="ghost chart-link"
              href={newTabHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              New tab ↗
            </a>
            <button className="ghost" onClick={() => setFull((f) => !f)}>
              {full ? "Exit full screen" : "Full screen"}
            </button>
            <button className="ghost chart-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="chart-body">
          <ChartView instrumentKey={instrumentKey} symbol={symbol} name={name} />
        </div>
      </div>
    </div>
  );
}

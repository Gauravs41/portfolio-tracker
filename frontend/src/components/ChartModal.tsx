import { useEffect, useId, useRef } from "react";

const TV_SRC = "https://s3.tradingview.com/tv.js";
let tvLoader: Promise<void> | null = null;

/** Load TradingView's tv.js once and cache the promise. */
function loadTradingView(): Promise<void> {
  if (typeof window !== "undefined" && (window as any).TradingView) {
    return Promise.resolve();
  }
  if (tvLoader) return tvLoader;
  tvLoader = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = TV_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      tvLoader = null;
      reject(new Error("Failed to load TradingView"));
    };
    document.head.appendChild(s);
  });
  return tvLoader;
}

/** Build a TradingView ticker ("NSE:RELIANCE") from our instrument key + symbol. */
function tvSymbol(instrumentKey: string, symbol: string): string {
  const ex = (instrumentKey.split("_")[0] || "NSE").toUpperCase();
  const prefix = ex === "BSE" ? "BSE" : "NSE";
  return `${prefix}:${symbol.toUpperCase()}`;
}

interface Props {
  instrumentKey: string;
  symbol: string;
  name: string;
  onClose: () => void;
}

export function ChartModal({ instrumentKey, symbol, name, onClose }: Props) {
  const rawId = useId();
  const containerId = "tv_" + rawId.replace(/[^a-zA-Z0-9_]/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const sym = tvSymbol(instrumentKey, symbol);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    loadTradingView()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        // eslint-disable-next-line no-new
        new (window as any).TradingView.widget({
          container_id: containerId,
          symbol: sym,
          autosize: true,
          interval: "D",
          timezone: "Asia/Kolkata",
          theme: "dark",
          style: "1", // candles
          locale: "in",
          toolbar_bg: "#0f1115",
          enable_publishing: false,
          withdateranges: true,
          hide_side_toolbar: false, // drawing tools
          allow_symbol_change: true,
          details: true,
          show_popup_button: true,
          popup_width: "1200",
          popup_height: "740",
        });
      })
      .catch(() => {
        /* network blocked; widget simply won't render */
      });
    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [sym, containerId]);

  const tvUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(sym)}`;

  return (
    <div className="chart-overlay" onMouseDown={onClose}>
      <div className="chart-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="chart-head">
          <div className="chart-title">
            <span className="chart-symbol">{symbol}</span>
            <span className="chart-name">{name}</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <a
              className="chart-newtab"
              href={tvUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in new tab ↗
            </a>
            <button className="ghost chart-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>
        <div className="chart-body">
          <div id={containerId} ref={containerRef} className="tv-container" />
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { ChartView } from "../components/ChartView";
import { SymbolSearch } from "../components/SymbolSearch";
import { WatchlistPanel } from "../components/WatchlistPanel";
import { AlertsManager } from "../components/AlertsManager";
import type { Instrument, WatchlistItem } from "../types";

/** Full-bleed chart page: search + drawing chart + watchlist/alerts (opened in a new tab). */
export default function ChartPage() {
  const { instrumentKey = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<"watchlist" | "alerts">("watchlist");

  const key = decodeURIComponent(instrumentKey);
  const symbol = params.get("symbol") ?? key;
  const name = params.get("name") ?? "";

  const goTo = (k: string, sym: string, nm: string) => {
    const qs = new URLSearchParams({ symbol: sym, name: nm }).toString();
    navigate(`/chart/${encodeURIComponent(k)}?${qs}`);
  };

  return (
    <div className="chart-page">
      <div className="chart-page-head">
        <Link to="/watchlists" className="ghost chart-link">
          ← Back
        </Link>
        <SymbolSearch
          onSelect={(ins: Instrument) =>
            goTo(ins.instrument_key, ins.symbol, ins.name)
          }
        />
      </div>
      <div className="chart-page-body">
        <ChartView key={key} instrumentKey={key} symbol={symbol} name={name} />
        <div className="chart-side">
          <div className="chart-side-tabs">
            <button
              className={`chart-side-tab ${panel === "watchlist" ? "active" : ""}`}
              onClick={() => setPanel("watchlist")}
            >
              Watchlist
            </button>
            <button
              className={`chart-side-tab ${panel === "alerts" ? "active" : ""}`}
              onClick={() => setPanel("alerts")}
            >
              Alerts
            </button>
          </div>
          {panel === "watchlist" ? (
            <WatchlistPanel
              activeKey={key}
              onPick={(it: WatchlistItem) => goTo(it.instrument_key, it.symbol, it.name)}
            />
          ) : (
            <div className="chart-side-alerts">
              <AlertsManager instrumentKey={key} symbol={symbol} name={name} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { ChartView } from "../components/ChartView";
import { SymbolSearch } from "../components/SymbolSearch";
import { WatchlistPanel } from "../components/WatchlistPanel";
import type { Instrument, WatchlistItem } from "../types";

/** Full-bleed chart page: search + drawing chart + watchlist (opened in a new tab). */
export default function ChartPage() {
  const { instrumentKey = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

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
        <WatchlistPanel
          activeKey={key}
          onPick={(it: WatchlistItem) => goTo(it.instrument_key, it.symbol, it.name)}
        />
      </div>
    </div>
  );
}

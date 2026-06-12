import { useEffect, useState } from "react";
import { api } from "../api/client";
import { BullBearBadge } from "../components/BullBearBadge";
import { Num, Pct } from "../components/format";
import type { Diversification, HoldingsPerformance, HoldingPerformanceRow } from "../types";

export default function Dashboard() {
  const [perf, setPerf] = useState<HoldingsPerformance | null>(null);
  const [div, setDiv] = useState<Diversification | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.holdingsPerformance(), api.diversification()])
      .then(([p, d]) => { setPerf(p); setDiv(d); })
      .catch((e) => setError(String(e)));
  }, []);

  const movers: HoldingPerformanceRow[] = perf
    ? [...perf.rows]
        .filter((r) => r.change_1d !== null)
        .sort((a, b) => Math.abs(b.change_1d ?? 0) - Math.abs(a.change_1d ?? 0))
        .slice(0, 5)
    : [];

  return (
    <div>
      <h2>Dashboard</h2>
      {error && <div className="error">{error}</div>}

      {perf && (
        <div className="cards">
          <div className="card">
            <div className="label">Portfolio Value</div>
            <div className="value"><Num value={perf.total_market_value} prefix="₹" /></div>
          </div>
          <div className="card">
            <div className="label">Invested</div>
            <div className="value"><Num value={perf.total_invested} prefix="₹" /></div>
          </div>
          <div className="card">
            <div className="label">Total P&L</div>
            <div className="value"><Num value={perf.total_pnl} prefix="₹" /></div>
          </div>
          <div className="card">
            <div className="label">Return</div>
            <div className="value"><Pct value={perf.total_pnl_pct} /></div>
          </div>
          <div className="card">
            <div className="label">Holdings</div>
            <div className="value">{perf.rows.length}</div>
          </div>
        </div>
      )}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Top Movers (1D)</h3>
        {movers.length === 0 ? (
          <p className="muted">Add holdings to see movers.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Symbol</th><th>LTP</th><th>1D</th><th>1W</th><th>Sentiment</th></tr>
            </thead>
            <tbody>
              {movers.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.symbol}</strong></td>
                  <td><Num value={r.last_price} prefix="₹" /></td>
                  <td><Pct value={r.change_1d} /></td>
                  <td><Pct value={r.change_1w} /></td>
                  <td><BullBearBadge sentiment={r.sentiment} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {div && div.by_sector.length > 0 && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Sector Allocation</h3>
          <table>
            <thead><tr><th>Sector</th><th>Value</th><th>Weight</th><th>Stocks</th></tr></thead>
            <tbody>
              {div.by_sector.map((s) => (
                <tr key={s.label}>
                  <td>{s.label}</td>
                  <td><Num value={s.value} prefix="₹" /></td>
                  <td><Num value={s.pct} />%</td>
                  <td>{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

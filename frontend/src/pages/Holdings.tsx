import { useEffect, useState } from "react";
import { api } from "../api/client";
import { SymbolSearch } from "../components/SymbolSearch";
import { BullBearBadge } from "../components/BullBearBadge";
import { Num, Pct } from "../components/format";
import type { HoldingsPerformance, Instrument } from "../types";

const SECTORS = [
  "Energy", "Financials", "IT", "Healthcare", "Consumer", "Industrials",
  "Materials", "Utilities", "Telecom", "Realty", "Auto", "Other",
];

export default function Holdings() {
  const [data, setData] = useState<HoldingsPerformance | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // add-holding form
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [sector, setSector] = useState("Other");

  async function load() {
    setLoading(true);
    try {
      setData(await api.holdingsPerformance());
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addHolding() {
    if (!selected || !qty || !price) return;
    await api.createHolding({
      instrument_key: selected.instrument_key,
      symbol: selected.symbol,
      name: selected.name,
      quantity: Number(qty),
      avg_buy_price: Number(price),
      sector,
    });
    setSelected(null);
    setQty("");
    setPrice("");
    await load();
  }

  async function updateSector(id: number, value: string) {
    await api.updateHolding(id, { sector: value });
    await load();
  }

  async function remove(id: number) {
    await api.deleteHolding(id);
    await load();
  }

  return (
    <div>
      <h2>Holdings</h2>

      {data && (
        <div className="cards">
          <div className="card">
            <div className="label">Market Value</div>
            <div className="value"><Num value={data.total_market_value} prefix="₹" /></div>
          </div>
          <div className="card">
            <div className="label">Invested</div>
            <div className="value"><Num value={data.total_invested} prefix="₹" /></div>
          </div>
          <div className="card">
            <div className="label">Total P&L</div>
            <div className="value"><Num value={data.total_pnl} prefix="₹" /></div>
          </div>
          <div className="card">
            <div className="label">Return</div>
            <div className="value"><Pct value={data.total_pnl_pct} /></div>
          </div>
        </div>
      )}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Add holding</h3>
        <div className="row">
          {selected ? (
            <span><strong>{selected.symbol}</strong> <span className="muted">{selected.name}</span></span>
          ) : (
            <SymbolSearch onSelect={setSelected} />
          )}
          {selected && (
            <>
              <input style={{ width: 100 }} placeholder="Qty" value={qty}
                onChange={(e) => setQty(e.target.value)} type="number" />
              <input style={{ width: 130 }} placeholder="Avg buy price" value={price}
                onChange={(e) => setPrice(e.target.value)} type="number" />
              <select value={sector} onChange={(e) => setSector(e.target.value)}>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={addHolding}>Add</button>
              <button className="ghost" onClick={() => setSelected(null)}>Cancel</button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="panel">
        {loading ? <p className="muted">Loading…</p> : !data || data.rows.length === 0 ? (
          <p className="muted">No holdings yet. Add one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Qty</th>
                <th>Avg</th>
                <th>LTP</th>
                <th>Value</th>
                <th>Alloc%</th>
                <th>1D</th>
                <th>P&L</th>
                <th>P&L%</th>
                <th>RSI</th>
                <th>Sentiment</th>
                <th>Sector</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.symbol}</strong></td>
                  <td><Num value={r.quantity} /></td>
                  <td><Num value={r.avg_buy_price} prefix="₹" /></td>
                  <td><Num value={r.last_price} prefix="₹" /></td>
                  <td><Num value={r.market_value} prefix="₹" /></td>
                  <td><Num value={r.allocation_pct} />%</td>
                  <td><Pct value={r.change_1d} /></td>
                  <td><Num value={r.pnl} prefix="₹" /></td>
                  <td><Pct value={r.pnl_pct} /></td>
                  <td><Num value={r.rsi_14} /></td>
                  <td><BullBearBadge sentiment={r.sentiment} /></td>
                  <td>
                    <select
                      value={r.sector ?? "Other"}
                      onChange={(e) => updateSector(r.id, e.target.value)}
                    >
                      {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><button className="danger" onClick={() => remove(r.id)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

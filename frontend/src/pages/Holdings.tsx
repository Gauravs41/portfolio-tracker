import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "../api/client";
import { SymbolSearch } from "../components/SymbolSearch";
import { DataTable } from "../components/DataTable";
import { TagsCell } from "../components/TagsCell";
import { NotesCell } from "../components/NotesCell";
import { GrowthCell } from "../components/GrowthCell";
import { RsiSelector } from "../components/RsiSelector";
import { BullBearBadge } from "../components/BullBearBadge";
import { Num, Pct } from "../components/format";
import type { HoldingPerformanceRow, HoldingsPerformance, Instrument, RsiInterval } from "../types";

const SECTORS = [
  "Energy", "Financials", "IT", "Healthcare", "Consumer", "Industrials",
  "Materials", "Utilities", "Telecom", "Realty", "Auto", "Other",
];

const RSI_LABEL: Record<RsiInterval, string> = { day: "D", week: "W", month: "M" };

export default function Holdings() {
  const [data, setData] = useState<HoldingsPerformance | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [rsi, setRsi] = useState<RsiInterval>("day");
  const [knownTags, setKnownTags] = useState<string[]>([]);

  // add-holding form
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [sector, setSector] = useState("Other");

  async function load() {
    setLoading(true);
    try {
      setData(await api.holdingsPerformance(rsi));
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadTags() {
    try { setKnownTags(await api.listTags()); } catch { /* non-fatal */ }
  }

  const refresh = () => { load(); loadTags(); };

  useEffect(() => { load(); }, [rsi]);
  useEffect(() => { loadTags(); }, []);

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

  const columns = useMemo<ColumnDef<HoldingPerformanceRow, any>[]>(() => [
    { accessorKey: "symbol", header: "Symbol", meta: { label: "Symbol", filterVariant: "text" }, cell: (c) => <strong>{c.getValue()}</strong> },
    { accessorKey: "quantity", header: "Qty", meta: { label: "Qty", filterVariant: "number" }, cell: (c) => <Num value={c.getValue()} /> },
    { accessorKey: "avg_buy_price", header: "Avg", meta: { label: "Avg", filterVariant: "number" }, cell: (c) => <Num value={c.getValue()} prefix="₹" /> },
    { accessorKey: "last_price", header: "LTP", meta: { label: "LTP", filterVariant: "number" }, cell: (c) => <Num value={c.getValue()} prefix="₹" /> },
    { accessorKey: "market_value", header: "Value", meta: { label: "Value", filterVariant: "number" }, cell: (c) => <Num value={c.getValue()} prefix="₹" /> },
    { accessorKey: "allocation_pct", header: "Alloc%", meta: { label: "Alloc%", filterVariant: "number" }, cell: (c) => <><Num value={c.getValue()} />%</> },
    { accessorKey: "change_1d", header: "1D", meta: { label: "1D %", filterVariant: "number" }, cell: (c) => <Pct value={c.getValue()} /> },
    { accessorKey: "pnl", header: "P&L", meta: { label: "P&L", filterVariant: "number" }, cell: (c) => <Num value={c.getValue()} prefix="₹" /> },
    { accessorKey: "pnl_pct", header: "P&L%", meta: { label: "P&L%", filterVariant: "number" }, cell: (c) => <Pct value={c.getValue()} /> },
    { accessorKey: "rsi_14", header: `RSI (${RSI_LABEL[rsi]})`, meta: { label: "RSI", filterVariant: "number" }, cell: (c) => <Num value={c.getValue()} /> },
    { accessorKey: "rev_growth_year", header: "Rev YoY (E)", meta: { label: "Rev growth — year (E)", filterVariant: "number" }, cell: (c) => <GrowthCell instrumentKey={c.row.original.instrument_key} symbol={c.row.original.symbol} name={c.row.original.name} field="rev_growth_year" value={c.getValue()} onChange={refresh} /> },
    { accessorKey: "rev_growth_quarter", header: "Rev QoQ (E)", meta: { label: "Rev growth — quarter (E)", filterVariant: "number" }, cell: (c) => <GrowthCell instrumentKey={c.row.original.instrument_key} symbol={c.row.original.symbol} name={c.row.original.name} field="rev_growth_quarter" value={c.getValue()} onChange={refresh} /> },
    { accessorKey: "profit_growth_year", header: "Profit YoY (E)", meta: { label: "Profit growth — year (E)", filterVariant: "number" }, cell: (c) => <GrowthCell instrumentKey={c.row.original.instrument_key} symbol={c.row.original.symbol} name={c.row.original.name} field="profit_growth_year" value={c.getValue()} onChange={refresh} /> },
    { accessorKey: "profit_growth_quarter", header: "Profit QoQ (E)", meta: { label: "Profit growth — quarter (E)", filterVariant: "number" }, cell: (c) => <GrowthCell instrumentKey={c.row.original.instrument_key} symbol={c.row.original.symbol} name={c.row.original.name} field="profit_growth_quarter" value={c.getValue()} onChange={refresh} /> },
    { accessorKey: "sentiment", header: "Sentiment", meta: { label: "Sentiment", filterVariant: "select" }, cell: (c) => <BullBearBadge sentiment={c.getValue()} /> },
    {
      accessorKey: "sector",
      header: "Sector",
      meta: { label: "Sector", filterVariant: "select" },
      cell: (c) => (
        <select
          value={c.row.original.sector ?? "Other"}
          onChange={(e) => updateSector(c.row.original.id, e.target.value)}
        >
          {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      ),
    },
    {
      id: "tags",
      header: "Tags",
      accessorFn: (r) => (r.tags ?? []).join(", "),
      enableSorting: false,
      meta: { label: "Tags", filterVariant: "text" },
      cell: (c) => (
        <TagsCell
          instrumentKey={c.row.original.instrument_key}
          symbol={c.row.original.symbol}
          name={c.row.original.name}
          tags={c.row.original.tags ?? []}
          knownTags={knownTags}
          onChange={refresh}
        />
      ),
    },
    {
      accessorKey: "notes",
      header: "Notes",
      enableSorting: false,
      meta: { label: "Notes", filterVariant: "text" },
      cell: (c) => (
        <NotesCell
          instrumentKey={c.row.original.instrument_key}
          symbol={c.row.original.symbol}
          name={c.row.original.name}
          notes={c.row.original.notes ?? ""}
          onChange={refresh}
        />
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { label: "Remove", filterVariant: "none" },
      cell: (c) => <button className="danger" onClick={() => remove(c.row.original.id)}>×</button>,
    },
  ], [rsi, knownTags]);

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
          <DataTable
            columns={columns}
            data={data.rows}
            tableId="holdings"
            toolbar={<RsiSelector value={rsi} onChange={setRsi} />}
          />
        )}
      </div>
    </div>
  );
}

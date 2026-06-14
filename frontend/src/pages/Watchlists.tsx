import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "../api/client";
import { SymbolSearch } from "../components/SymbolSearch";
import { DataTable } from "../components/DataTable";
import { TagsCell } from "../components/TagsCell";
import { NotesCell } from "../components/NotesCell";
import { BullBearBadge } from "../components/BullBearBadge";
import { Num, Pct } from "../components/format";
import type { Instrument, PerformanceRow, Watchlist } from "../types";

export default function Watchlists() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadWatchlists() {
    const wl = await api.listWatchlists();
    setWatchlists(wl);
    if (wl.length && activeId === null) setActiveId(wl[0].id);
    if (!wl.length) setActiveId(null);
  }

  async function loadPerformance(id: number) {
    setLoading(true);
    setError("");
    try {
      setRows(await api.watchlistPerformance(id));
    } catch (e) {
      setError(String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadWatchlists().catch((e) => setError(String(e))); }, []);
  useEffect(() => { if (activeId !== null) loadPerformance(activeId); }, [activeId]);

  const active = watchlists.find((w) => w.id === activeId);

  async function createWatchlist() {
    if (!newName.trim()) return;
    const wl = await api.createWatchlist(newName.trim());
    setNewName("");
    await loadWatchlists();
    setActiveId(wl.id);
  }

  async function addStock(ins: Instrument) {
    if (activeId === null) return;
    try {
      await api.addWatchlistItem(activeId, ins);
      await loadWatchlists();
      await loadPerformance(activeId);
    } catch (e) {
      setError(String(e));
    }
  }

  async function removeStock(row: PerformanceRow) {
    if (activeId === null || !active) return;
    const item = active.items.find((i) => i.instrument_key === row.instrument_key);
    if (!item) return;
    await api.removeWatchlistItem(activeId, item.id);
    await loadWatchlists();
    await loadPerformance(activeId);
  }

  async function deleteWatchlist(id: number) {
    await api.deleteWatchlist(id);
    setActiveId(null);
    await loadWatchlists();
  }

  const refresh = () => { if (activeId !== null) loadPerformance(activeId); };

  const columns = useMemo<ColumnDef<PerformanceRow, any>[]>(() => [
    {
      accessorKey: "symbol",
      header: "Symbol",
      meta: { label: "Symbol", filterVariant: "text" },
      cell: (c) => (
        <div>
          <strong>{c.row.original.symbol}</strong>
          <div className="muted" style={{ fontSize: 12 }}>{c.row.original.name}</div>
        </div>
      ),
    },
    { accessorKey: "last_price", header: "LTP", meta: { label: "LTP", filterVariant: "number" }, cell: (c) => <Num value={c.getValue()} prefix="₹" /> },
    { accessorKey: "change_1d", header: "1D", meta: { label: "1D %", filterVariant: "number" }, cell: (c) => <Pct value={c.getValue()} /> },
    { accessorKey: "change_3d", header: "3D", meta: { label: "3D %", filterVariant: "number" }, cell: (c) => <Pct value={c.getValue()} /> },
    { accessorKey: "change_1w", header: "1W", meta: { label: "1W %", filterVariant: "number" }, cell: (c) => <Pct value={c.getValue()} /> },
    { accessorKey: "change_2w", header: "2W", meta: { label: "2W %", filterVariant: "number" }, cell: (c) => <Pct value={c.getValue()} /> },
    { accessorKey: "change_1m", header: "1M", meta: { label: "1M %", filterVariant: "number" }, cell: (c) => <Pct value={c.getValue()} /> },
    { accessorKey: "pe_ratio", header: "P/E", meta: { label: "P/E", filterVariant: "number" }, cell: (c) => <Num value={c.getValue()} /> },
    { accessorKey: "rsi_14", header: "RSI", meta: { label: "RSI", filterVariant: "number" }, cell: (c) => <Num value={c.getValue()} /> },
    { accessorKey: "trend", header: "Trend", meta: { label: "Trend", filterVariant: "select" }, cell: (c) => <span className="muted">{String(c.getValue() ?? "").replace("_", " ")}</span> },
    { accessorKey: "sentiment", header: "Sentiment", meta: { label: "Sentiment", filterVariant: "select" }, cell: (c) => <BullBearBadge sentiment={c.getValue()} /> },
    {
      id: "tags",
      header: "Tags",
      accessorFn: (r) => (r.tags ?? []).join(", "),
      meta: { label: "Tags", filterVariant: "text" },
      cell: (c) => (
        <TagsCell
          instrumentKey={c.row.original.instrument_key}
          symbol={c.row.original.symbol}
          name={c.row.original.name}
          tags={c.row.original.tags ?? []}
          onChange={refresh}
        />
      ),
    },
    {
      accessorKey: "notes",
      header: "Notes",
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
      cell: (c) => <button className="danger" onClick={() => removeStock(c.row.original)}>Remove</button>,
    },
  ], [activeId, active]);

  return (
    <div>
      <h2>Watchlists</h2>

      <div className="row" style={{ marginBottom: 16 }}>
        <input
          placeholder="New watchlist name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button onClick={createWatchlist}>Create</button>
      </div>

      <div className="tabs">
        {watchlists.map((w) => (
          <div
            key={w.id}
            className={`tab ${w.id === activeId ? "active" : ""}`}
            onClick={() => setActiveId(w.id)}
          >
            {w.name} <span className="muted">({w.items.length})</span>
          </div>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      {active && (
        <div className="panel">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
            <SymbolSearch onSelect={addStock} />
            <button className="danger" onClick={() => deleteWatchlist(active.id)}>
              Delete watchlist
            </button>
          </div>
          {loading ? <p className="muted">Loading…</p> : rows.length === 0 ? (
            <p className="muted">No stocks yet.</p>
          ) : (
            <DataTable columns={columns} data={rows} tableId="watchlist" />
          )}
        </div>
      )}

      {!watchlists.length && <p className="muted">Create your first watchlist to get started.</p>}
    </div>
  );
}

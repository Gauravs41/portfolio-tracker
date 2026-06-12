import { useEffect, useState } from "react";
import { api } from "../api/client";
import { SymbolSearch } from "../components/SymbolSearch";
import { PerformanceTable } from "../components/PerformanceTable";
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
          {loading ? <p className="muted">Loading…</p> : (
            <PerformanceTable rows={rows} onRemove={removeStock} />
          )}
        </div>
      )}

      {!watchlists.length && <p className="muted">Create your first watchlist to get started.</p>}
    </div>
  );
}

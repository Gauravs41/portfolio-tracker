import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Watchlist, WatchlistItem } from "../types";

interface Props {
  activeKey: string;
  onPick: (item: WatchlistItem) => void;
}

/** Right-hand watchlist panel on the full-screen chart page. */
export function WatchlistPanel({ activeKey, onPick }: Props) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listWatchlists()
      .then((wl) => {
        if (!alive) return;
        setWatchlists(wl);
        if (wl.length) setActiveId((id) => id ?? wl[0].id);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const active = watchlists.find((w) => w.id === activeId);

  return (
    <aside className="chart-watch">
      <div className="chart-watch-head">
        <span>Watchlist</span>
        {watchlists.length > 0 && (
          <select
            value={activeId ?? ""}
            onChange={(e) => setActiveId(Number(e.target.value))}
          >
            {watchlists.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.items.length})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="chart-watch-list">
        {!watchlists.length && <p className="muted" style={{ padding: 12 }}>No watchlists.</p>}
        {active?.items.map((it) => (
          <button
            key={it.id}
            className={`chart-watch-item ${it.instrument_key === activeKey ? "active" : ""}`}
            onClick={() => onPick(it)}
            title={it.name}
          >
            <strong>{it.symbol}</strong>
            <span className="muted">{it.name}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

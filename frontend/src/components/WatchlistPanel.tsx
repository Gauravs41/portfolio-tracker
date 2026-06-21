import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { PerformanceRow, Watchlist, WatchlistItem } from "../types";

interface Props {
  activeKey: string;
  onPick: (item: WatchlistItem) => void;
}

type ColKey =
  | "last_price"
  | "change_1d"
  | "change_3d"
  | "change_1w"
  | "change_2w"
  | "change_1m"
  | "rsi_14"
  | "pe_ratio"
  | "sentiment";

interface ColDef {
  key: ColKey;
  label: string;
  fmt: (r: PerformanceRow) => string;
  cls?: (r: PerformanceRow) => string;
}

const num = (v: number | null, d = 2) => (v == null ? "–" : v.toFixed(d));
const pct = (v: number | null) =>
  v == null ? "–" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const signCls = (v: number | null) => (v == null ? "" : v >= 0 ? "pos" : "neg");

const COLUMNS: ColDef[] = [
  { key: "last_price", label: "Last", fmt: (r) => num(r.last_price) },
  { key: "change_1d", label: "Chg%", fmt: (r) => pct(r.change_1d), cls: (r) => signCls(r.change_1d) },
  { key: "change_3d", label: "3D", fmt: (r) => pct(r.change_3d), cls: (r) => signCls(r.change_3d) },
  { key: "change_1w", label: "1W", fmt: (r) => pct(r.change_1w), cls: (r) => signCls(r.change_1w) },
  { key: "change_2w", label: "2W", fmt: (r) => pct(r.change_2w), cls: (r) => signCls(r.change_2w) },
  { key: "change_1m", label: "1M", fmt: (r) => pct(r.change_1m), cls: (r) => signCls(r.change_1m) },
  { key: "rsi_14", label: "RSI", fmt: (r) => num(r.rsi_14, 0) },
  { key: "pe_ratio", label: "P/E", fmt: (r) => num(r.pe_ratio, 1) },
  { key: "sentiment", label: "Sentiment", fmt: (r) => r.sentiment ?? "" },
];

const COLS_KEY = "chart-watch-cols";

function loadCols(): ColKey[] {
  try {
    const raw = localStorage.getItem(COLS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return ["last_price", "change_1d"];
}

/** Right-hand watchlist panel on the full-screen chart page. */
export function WatchlistPanel({ activeKey, onPick }: Props) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [perf, setPerf] = useState<Record<string, PerformanceRow>>({});
  const [loading, setLoading] = useState(false);
  const [cols, setCols] = useState<ColKey[]>(loadCols);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Pull live performance data for the active watchlist (LTP, % changes, RSI…).
  useEffect(() => {
    if (activeId == null) return;
    let alive = true;
    setLoading(true);
    setPerf({});
    api
      .watchlistPerformance(activeId)
      .then((rows) => {
        if (!alive) return;
        const m: Record<string, PerformanceRow> = {};
        for (const r of rows) m[r.instrument_key] = r;
        setPerf(m);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [activeId]);

  useEffect(() => {
    localStorage.setItem(COLS_KEY, JSON.stringify(cols));
  }, [cols]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const active = watchlists.find((w) => w.id === activeId);
  const visible = COLUMNS.filter((c) => cols.includes(c.key));
  const toggleCol = (k: ColKey) =>
    setCols((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  return (
    <aside className="chart-watch">
      <div className="chart-watch-head">
        <span>Watchlist</span>
        <div className="row" style={{ gap: 6 }}>
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
          <div className="col-menu-wrap" ref={menuRef}>
            <button
              className="ghost"
              style={{ padding: "4px 8px", fontSize: 12 }}
              onClick={() => setMenuOpen((o) => !o)}
            >
              Columns ▾
            </button>
            {menuOpen && (
              <div className="col-menu">
                {COLUMNS.map((c) => (
                  <label key={c.key} className="col-menu-item">
                    <input
                      type="checkbox"
                      checked={cols.includes(c.key)}
                      onChange={() => toggleCol(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="chart-watch-list">
        {!watchlists.length && (
          <p className="muted" style={{ padding: 12 }}>No watchlists.</p>
        )}
        {active && (
          <table className="watch-table">
            <thead>
              <tr>
                <th>Symbol</th>
                {visible.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.items.map((it) => {
                const r = perf[it.instrument_key];
                return (
                  <tr
                    key={it.id}
                    className={`watch-row ${it.instrument_key === activeKey ? "active" : ""}`}
                    onClick={() => onPick(it)}
                    title={it.name}
                  >
                    <td>
                      <strong>{it.symbol}</strong>
                    </td>
                    {visible.map((c) => (
                      <td key={c.key} className={r && c.cls ? c.cls(r) : ""}>
                        {r ? c.fmt(r) : loading ? "…" : "–"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </aside>
  );
}

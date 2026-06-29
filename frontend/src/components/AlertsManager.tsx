import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { AlertDialog } from "./AlertDialog";
import { SymbolSearch } from "./SymbolSearch";
import type { AlertRule, ChartDrawing, Instrument } from "../types";

const CONDITION_TEXT: Record<string, string> = {
  price_cross_up: "crossing up",
  price_cross_down: "crossing down",
  price_above: "greater than",
  price_below: "less than",
  pct_change_above: "1D % above",
  pct_change_below: "1D % below",
  rsi_above: "RSI above",
  rsi_below: "RSI below",
  price_cross_sma: "crossing SMA",
  drawing_cross: "crossing line",
};

const TYPE_LABEL: Record<string, string> = {
  price_cross_up: "Price",
  price_cross_down: "Price",
  price_above: "Price",
  price_below: "Price",
  pct_change_above: "% Change",
  pct_change_below: "% Change",
  rsi_above: "Indicator",
  rsi_below: "Indicator",
  price_cross_sma: "Indicator",
  drawing_cross: "Drawing",
};

function describe(a: AlertRule): string {
  const txt = CONDITION_TEXT[a.condition] ?? a.condition;
  if (a.condition === "drawing_cross") return `Price ${txt}`;
  if (a.condition === "price_cross_sma") {
    return `Price ${txt}${a.params?.period ? ` ${a.params.period}` : ""}`;
  }
  const pct = a.condition.startsWith("pct_change");
  const rsi = a.condition.startsWith("rsi");
  const unit = pct ? "%" : rsi ? "" : "₹";
  return `${rsi ? "RSI" : "Price"} ${txt} ${unit}${a.value}`.replace("RSI RSI", "RSI");
}

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
};

interface DialogState {
  instrumentKey: string;
  symbol: string;
  name: string;
  drawings: ChartDrawing[];
  editing: AlertRule | null;
}

interface Props {
  /** When set, the manager is scoped to one instrument (chart-page tab). */
  instrumentKey?: string;
  symbol?: string;
  name?: string;
}

/** TradingView-style alerts table used on the Alerts page + chart-page tab. */
export function AlertsManager({ instrumentKey, symbol, name }: Props) {
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [picking, setPicking] = useState(false);

  const scoped = Boolean(instrumentKey);

  const reload = () => {
    setLoading(true);
    api
      .listAlerts(instrumentKey)
      .then(setAlerts)
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [instrumentKey]);

  const openDialog = async (key: string, sym: string, nm: string, editing: AlertRule | null) => {
    let drawings: ChartDrawing[] = [];
    try {
      drawings = (await api.getDrawings(key)).drawings ?? [];
    } catch {
      /* ignore */
    }
    setDialog({ instrumentKey: key, symbol: sym, name: nm, drawings, editing });
    setPicking(false);
  };

  const onNew = () => {
    if (scoped) {
      openDialog(instrumentKey!, symbol ?? instrumentKey!, name ?? "", null);
    } else {
      setPicking((p) => !p);
    }
  };

  const toggle = async (a: AlertRule) => {
    const updated = await api.updateAlert(a.id, { is_active: !a.is_active });
    setAlerts((list) => list.map((x) => (x.id === a.id ? updated : x)));
  };
  const remove = async (a: AlertRule) => {
    await api.deleteAlert(a.id);
    setAlerts((list) => list.filter((x) => x.id !== a.id));
  };
  const test = async (a: AlertRule) => {
    try {
      await api.testAlert(a.id);
    } catch {
      /* ignore */
    }
  };

  const onSaved = (rule: AlertRule) => {
    setAlerts((list) => {
      const i = list.findIndex((a) => a.id === rule.id);
      if (i === -1) return [rule, ...list];
      const copy = [...list];
      copy[i] = rule;
      return copy;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return alerts;
    return alerts.filter(
      (a) =>
        a.symbol.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        describe(a).toLowerCase().includes(q),
    );
  }, [alerts, search]);

  return (
    <div className="alerts-mgr">
      <div className="alerts-mgr-head">
        <input
          className="alerts-search"
          placeholder="Search alerts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="primary" onClick={onNew}>
          + New alert
        </button>
      </div>

      {!scoped && picking && (
        <div className="alerts-pick">
          <SymbolSearch
            onSelect={(ins: Instrument) =>
              openDialog(ins.instrument_key, ins.symbol, ins.name, null)
            }
          />
        </div>
      )}

      {loading ? (
        <p className="muted">Loading alerts…</p>
      ) : filtered.length === 0 ? (
        <p className="muted">No alerts yet. Click “New alert” to create one.</p>
      ) : (
        <table className="alerts-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Type</th>
              <th>Triggered</th>
              <th>Created on</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className={a.is_active ? "" : "off"}>
                <td>
                  <div className="alerts-name">
                    {!scoped && (
                      <Link
                        className="alerts-sym"
                        to={`/chart/${encodeURIComponent(a.instrument_key)}?symbol=${encodeURIComponent(a.symbol)}&name=${encodeURIComponent(a.name)}`}
                      >
                        {a.symbol}
                      </Link>
                    )}
                    <button className="link-btn" onClick={() => openDialog(a.instrument_key, a.symbol, a.name, a)}>
                      {describe(a)}
                    </button>
                  </div>
                </td>
                <td>
                  <span className={`badge ${a.is_active ? "on" : "off"}`}>
                    {a.is_active ? "ENABLED" : "DISABLED"}
                  </span>
                </td>
                <td>
                  <span className="badge type">{TYPE_LABEL[a.condition] ?? "Price"}</span>
                </td>
                <td className="muted">
                  {a.trigger_count > 0
                    ? `${a.trigger_count}×${a.last_triggered_at ? ` · ${fmtDate(a.last_triggered_at)}` : ""}`
                    : "N/A"}
                </td>
                <td className="muted">{fmtDate(a.created_at)}</td>
                <td className="alerts-actions">
                  <button title="Test" onClick={() => test(a)}>▶</button>
                  <button title={a.is_active ? "Pause" : "Resume"} onClick={() => toggle(a)}>
                    {a.is_active ? "⏸" : "▶︎"}
                  </button>
                  <button title="Delete" onClick={() => remove(a)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialog && (
        <AlertDialog
          instrumentKey={dialog.instrumentKey}
          symbol={dialog.symbol}
          name={dialog.name}
          drawings={dialog.drawings}
          editing={dialog.editing}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

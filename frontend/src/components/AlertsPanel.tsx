import { api } from "../api/client";
import type { AlertRule } from "../types";

interface Props {
  alerts: AlertRule[];
  onChange: (alerts: AlertRule[]) => void;
  onEdit: (rule: AlertRule) => void;
  onClose: () => void;
}

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

function summarize(a: AlertRule): string {
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

/** Side panel listing the instrument's alerts with quick actions. */
export function AlertsPanel({ alerts, onChange, onEdit, onClose }: Props) {
  const toggle = async (a: AlertRule) => {
    const updated = await api.updateAlert(a.id, { is_active: !a.is_active });
    onChange(alerts.map((x) => (x.id === a.id ? updated : x)));
  };
  const remove = async (a: AlertRule) => {
    await api.deleteAlert(a.id);
    onChange(alerts.filter((x) => x.id !== a.id));
  };
  const test = async (a: AlertRule) => {
    try {
      await api.testAlert(a.id);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="alerts-panel">
      <div className="alerts-panel-head">
        <span>Alerts ({alerts.length})</span>
        <button className="alert-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {alerts.length === 0 ? (
        <p className="muted alerts-empty">No alerts yet. Click the bell to add one.</p>
      ) : (
        <ul className="alerts-list">
          {alerts.map((a) => (
            <li key={a.id} className={`alert-row ${a.is_active ? "" : "off"}`}>
              <div className="alert-row-main" onClick={() => onEdit(a)}>
                <div className="alert-row-title">{summarize(a)}</div>
                <div className="alert-row-meta muted">
                  {a.frequency === "once"
                    ? "Once"
                    : a.frequency === "once_per_bar"
                      ? "Once/bar"
                      : "Every time"}
                  {a.trigger_count > 0 && ` · fired ${a.trigger_count}×`}
                  {!a.is_active && " · inactive"}
                </div>
              </div>
              <div className="alert-row-actions">
                <button title="Test" onClick={() => test(a)}>
                  ▶
                </button>
                <button
                  title={a.is_active ? "Pause" : "Resume"}
                  onClick={() => toggle(a)}
                >
                  {a.is_active ? "⏸" : "▶︎"}
                </button>
                <button title="Delete" onClick={() => remove(a)}>
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

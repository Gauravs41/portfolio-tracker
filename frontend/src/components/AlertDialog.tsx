import { useMemo, useState } from "react";
import { api } from "../api/client";
import type {
  AlertCondition,
  AlertFrequency,
  AlertRule,
  AlertRuleInput,
  ChartDrawing,
} from "../types";

interface Props {
  instrumentKey: string;
  symbol: string;
  name: string;
  currentPrice?: number;
  drawings: ChartDrawing[];
  editing?: AlertRule | null;
  onClose: () => void;
  onSaved: (rule: AlertRule) => void;
}

const CONDITIONS: { value: AlertCondition; label: string; group: string }[] = [
  { value: "price_cross_up", label: "Crossing Up", group: "Price" },
  { value: "price_cross_down", label: "Crossing Down", group: "Price" },
  { value: "price_above", label: "Greater Than", group: "Price" },
  { value: "price_below", label: "Less Than", group: "Price" },
  { value: "pct_change_above", label: "1D % Change Above", group: "% Change" },
  { value: "pct_change_below", label: "1D % Change Below", group: "% Change" },
  { value: "rsi_above", label: "RSI Above", group: "Indicator" },
  { value: "rsi_below", label: "RSI Below", group: "Indicator" },
  { value: "price_cross_sma", label: "Price Crossing SMA", group: "Indicator" },
  { value: "drawing_cross", label: "Price Crossing Drawing", group: "Drawing" },
];

const FREQUENCIES: { value: AlertFrequency; label: string; hint: string }[] = [
  { value: "once", label: "Only Once", hint: "Fire one time, then stop" },
  { value: "once_per_bar", label: "Once Per Bar", hint: "At most once per day" },
  { value: "always", label: "Every Time", hint: "Every check while true" },
];

// Lines a drawing-cross alert can attach to.
const LINE_TYPES = new Set(["hline", "trend", "ray"]);

/** TradingView-style create/edit alert modal. */
export function AlertDialog({
  instrumentKey,
  symbol,
  name,
  currentPrice,
  drawings,
  editing,
  onClose,
  onSaved,
}: Props) {
  const [condition, setCondition] = useState<AlertCondition>(
    editing?.condition ?? "price_cross_down",
  );
  const [value, setValue] = useState<string>(
    editing ? String(editing.value) : currentPrice ? currentPrice.toFixed(2) : "",
  );
  const [frequency, setFrequency] = useState<AlertFrequency>(
    editing?.frequency ?? "once",
  );
  const [interval, setIntervalState] = useState<string>(
    (editing?.params?.interval as string) ?? "day",
  );
  const [period, setPeriod] = useState<string>(
    editing?.params?.period ? String(editing.params.period) : "50",
  );
  const [drawingId, setDrawingId] = useState<string>(
    editing?.drawing_id ?? "",
  );
  const [message, setMessage] = useState<string>(editing?.message ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const lineDrawings = useMemo(
    () => drawings.filter((d) => LINE_TYPES.has(d.type)),
    [drawings],
  );

  const needsValue =
    condition !== "drawing_cross" && condition !== "price_cross_sma";
  const isPct = condition.startsWith("pct_change");
  const isRsi = condition.startsWith("rsi");
  const isSma = condition === "price_cross_sma";
  const isDrawing = condition === "drawing_cross";

  const unit = isPct || isRsi ? "" : "₹";

  const save = async () => {
    setError("");
    if (needsValue && !value.trim()) {
      setError("Enter a value.");
      return;
    }
    if (isDrawing && !drawingId) {
      setError("Pick a drawing to watch.");
      return;
    }
    const params: Record<string, unknown> = {};
    if (isRsi) params.interval = interval;
    if (isSma) params.period = Number(period) || 50;

    const payload: AlertRuleInput = {
      instrument_key: instrumentKey,
      symbol,
      name,
      condition,
      value: needsValue ? Number(value) : 0,
      params,
      drawing_id: isDrawing ? drawingId : null,
      frequency,
      message,
    };

    setSaving(true);
    try {
      const rule = editing
        ? await api.updateAlert(editing.id, payload)
        : await api.createAlert(payload);
      onSaved(rule);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="alert-modal-backdrop" onMouseDown={onClose}>
      <div className="alert-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="alert-modal-head">
          <div>
            <div className="alert-modal-title">
              {editing ? "Edit Alert" : "Create Alert"}
            </div>
            <div className="alert-modal-sub">
              {symbol} {name && <span className="muted">· {name}</span>}
              {currentPrice != null && (
                <span className="muted"> · LTP ₹{currentPrice.toFixed(2)}</span>
              )}
            </div>
          </div>
          <button className="alert-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="alert-modal-body">
          <label className="alert-field">
            <span>Condition</span>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as AlertCondition)}
            >
              {["Price", "% Change", "Indicator", "Drawing"].map((g) => (
                <optgroup key={g} label={g}>
                  {CONDITIONS.filter((c) => c.group === g).map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          {isSma && (
            <label className="alert-field">
              <span>SMA Period</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="20">SMA 20</option>
                <option value="50">SMA 50</option>
              </select>
            </label>
          )}

          {isRsi && (
            <label className="alert-field">
              <span>Timeframe</span>
              <select
                value={interval}
                onChange={(e) => setIntervalState(e.target.value)}
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </label>
          )}

          {isDrawing && (
            <label className="alert-field">
              <span>Drawing</span>
              <select
                value={drawingId}
                onChange={(e) => setDrawingId(e.target.value)}
              >
                <option value="">Select a line…</option>
                {lineDrawings.map((d, i) => (
                  <option key={d.id} value={d.id}>
                    {d.type} #{i + 1}
                  </option>
                ))}
              </select>
              {lineDrawings.length === 0 && (
                <small className="alert-hint neg">
                  Draw a trend line or horizontal line first.
                </small>
              )}
            </label>
          )}

          {needsValue && (
            <label className="alert-field">
              <span>{isPct ? "Percent" : isRsi ? "RSI Level" : "Value"}</span>
              <div className="alert-value-row">
                {unit && <span className="alert-unit">{unit}</span>}
                <input
                  type="number"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={isRsi ? "70" : isPct ? "5" : "0.00"}
                  autoFocus
                />
                {isPct && <span className="alert-unit">%</span>}
              </div>
            </label>
          )}

          <label className="alert-field">
            <span>Trigger</span>
            <div className="alert-freq">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  title={f.hint}
                  className={`alert-freq-btn ${frequency === f.value ? "active" : ""}`}
                  onClick={() => setFrequency(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </label>

          <label className="alert-field">
            <span>Message</span>
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional note sent with the alert…"
            />
          </label>

          {error && <div className="alert-error">{error}</div>}
        </div>

        <div className="alert-modal-foot">
          <button className="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : editing ? "Update Alert" : "Create Alert"}
          </button>
        </div>
      </div>
    </div>
  );
}

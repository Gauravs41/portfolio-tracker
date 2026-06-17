import type { RsiInterval } from "../types";

interface Props {
  value: RsiInterval;
  onChange: (v: RsiInterval) => void;
}

const OPTIONS: { value: RsiInterval; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

/** Picks the timeframe used for the RSI column across the whole table. */
export function RsiSelector({ value, onChange }: Props) {
  return (
    <label className="rsi-selector">
      <span className="muted">RSI</span>
      <select value={value} onChange={(e) => onChange(e.target.value as RsiInterval)}>
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

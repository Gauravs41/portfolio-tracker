import type { PerformanceRow } from "../types";
import { BullBearBadge } from "./BullBearBadge";
import { Num, Pct } from "./format";

interface Props {
  rows: PerformanceRow[];
  onRemove?: (row: PerformanceRow) => void;
}

export function PerformanceTable({ rows, onRemove }: Props) {
  if (rows.length === 0) return <p className="muted">No stocks yet.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>LTP</th>
          <th>1D</th>
          <th>3D</th>
          <th>1W</th>
          <th>2W</th>
          <th>1M</th>
          <th>RSI</th>
          <th>Trend</th>
          <th>Sentiment</th>
          {onRemove && <th></th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.instrument_key}>
            <td>
              <strong>{r.symbol}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{r.name}</div>
            </td>
            <td><Num value={r.last_price} prefix="₹" /></td>
            <td><Pct value={r.change_1d} /></td>
            <td><Pct value={r.change_3d} /></td>
            <td><Pct value={r.change_1w} /></td>
            <td><Pct value={r.change_2w} /></td>
            <td><Pct value={r.change_1m} /></td>
            <td><Num value={r.rsi_14} /></td>
            <td className="muted">{r.trend.replace("_", " ")}</td>
            <td><BullBearBadge sentiment={r.sentiment} /></td>
            {onRemove && (
              <td>
                <button className="danger" onClick={() => onRemove(r)}>Remove</button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

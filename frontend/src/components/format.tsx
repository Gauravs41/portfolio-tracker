export function Pct({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="muted">—</span>;
  const cls = value > 0 ? "pos" : value < 0 ? "neg" : "";
  const sign = value > 0 ? "+" : "";
  return <span className={cls}>{sign}{value.toFixed(2)}%</span>;
}

export function Num({ value, prefix = "" }: { value: number | null; prefix?: string }) {
  if (value === null || value === undefined) return <span className="muted">—</span>;
  return <span>{prefix}{value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>;
}

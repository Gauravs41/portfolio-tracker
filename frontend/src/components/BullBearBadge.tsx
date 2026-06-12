export function BullBearBadge({ sentiment }: { sentiment: string }) {
  const label = sentiment === "bullish" ? "Bullish" : sentiment === "bearish" ? "Bearish" : "Neutral";
  return <span className={`badge ${sentiment}`}>{label}</span>;
}

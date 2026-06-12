import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Instrument } from "../types";

export function SymbolSearch({ onSelect }: { onSelect: (ins: Instrument) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Instrument[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        setError("");
        const r = await api.searchInstruments(q.trim());
        setResults(r);
        setOpen(true);
      } catch (e) {
        setError(String(e));
      }
    }, 300);
    return () => window.clearTimeout(timer.current);
  }, [q]);

  return (
    <div style={{ position: "relative" }}>
      <input
        placeholder="Search symbol (e.g. RELIANCE)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        style={{ width: 360 }}
      />
      {error && <div className="error">{error}</div>}
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((ins) => (
            <div
              key={ins.instrument_key}
              onClick={() => {
                onSelect(ins);
                setQ("");
                setResults([]);
                setOpen(false);
              }}
            >
              <strong>{ins.symbol}</strong> <span className="muted">{ins.name}</span>{" "}
              <span className="muted">· {ins.exchange} · {ins.board_type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

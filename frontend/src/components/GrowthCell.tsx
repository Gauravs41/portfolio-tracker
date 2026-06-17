import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { GrowthField } from "../types";

interface Props {
  instrumentKey: string;
  symbol: string;
  name: string;
  field: GrowthField;
  value: number | null;
  onChange: () => void;
}

/** Inline-editable manual growth estimate (percent). Click to edit. */
export function GrowthCell({ instrumentKey, symbol, name, field, value, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setDraft(value == null ? "" : String(value)); }, [value, editing]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  async function save() {
    setEditing(false);
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && Number.isNaN(next)) return; // ignore invalid
    if (next === value) return;
    setBusy(true);
    try {
      await api.updateInstrumentMeta(instrumentKey, { symbol, name, [field]: next });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={ref}
        className="growth-input"
        type="number"
        step="0.1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") { setDraft(value == null ? "" : String(value)); setEditing(false); }
        }}
        placeholder="%"
      />
    );
  }

  const cls = value == null ? "muted" : value >= 0 ? "pos" : "neg";
  return (
    <span
      className={`growth-view ${cls}`}
      onClick={() => !busy && setEditing(true)}
      title="Click to edit"
    >
      {value == null ? "—" : `${value > 0 ? "+" : ""}${value}%`}
    </span>
  );
}

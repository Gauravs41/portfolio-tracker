import { useState } from "react";
import { api } from "../api/client";

interface Props {
  instrumentKey: string;
  symbol: string;
  name: string;
  tags: string[];
  onChange: () => void; // refresh parent after save
}

export function TagsCell({ instrumentKey, symbol, name, tags, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(next: string[]) {
    setBusy(true);
    try {
      await api.updateInstrumentMeta(instrumentKey, { symbol, name, tags: next });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  function addTag() {
    const t = draft.trim();
    setDraft("");
    setAdding(false);
    if (!t || tags.includes(t)) return;
    save([...tags, t]);
  }

  function removeTag(t: string) {
    save(tags.filter((x) => x !== t));
  }

  return (
    <div className="chips">
      {tags.map((t) => (
        <span key={t} className="chip">
          {t}
          <button className="chip-x" disabled={busy} onClick={() => removeTag(t)} title="Remove tag">×</button>
        </span>
      ))}
      {adding ? (
        <input
          className="chip-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={addTag}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTag();
            if (e.key === "Escape") { setDraft(""); setAdding(false); }
          }}
          placeholder="tag…"
        />
      ) : (
        <button className="chip-add" disabled={busy} onClick={() => setAdding(true)}>+ tag</button>
      )}
    </div>
  );
}

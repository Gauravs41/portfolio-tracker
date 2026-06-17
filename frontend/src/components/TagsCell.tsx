import { useId, useState } from "react";
import { api } from "../api/client";

interface Props {
  instrumentKey: string;
  symbol: string;
  name: string;
  tags: string[];
  knownTags?: string[]; // for autocomplete suggestions
  onChange: () => void; // refresh parent after save
}

export function TagsCell({ instrumentKey, symbol, name, tags, knownTags = [], onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const listId = useId();

  // Suggest tags that exist elsewhere but aren't already on this stock.
  const suggestions = knownTags.filter((t) => !tags.includes(t));

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
        <>
          <input
            className="chip-input"
            autoFocus
            list={listId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={addTag}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTag();
              if (e.key === "Escape") { setDraft(""); setAdding(false); }
            }}
            placeholder="tag…"
          />
          <datalist id={listId}>
            {suggestions.map((t) => <option key={t} value={t} />)}
          </datalist>
        </>
      ) : (
        <button className="chip-add" disabled={busy} onClick={() => setAdding(true)}>+ tag</button>
      )}
    </div>
  );
}

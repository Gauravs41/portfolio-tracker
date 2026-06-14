import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

interface Props {
  instrumentKey: string;
  symbol: string;
  name: string;
  notes: string;
  onChange: () => void;
}

export function NotesCell({ instrumentKey, symbol, name, notes, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (!editing) setDraft(notes); }, [notes, editing]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  async function save() {
    setEditing(false);
    if (draft === notes) return;
    setBusy(true);
    try {
      await api.updateInstrumentMeta(instrumentKey, { symbol, name, notes: draft });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        className="notes-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          if (e.key === "Escape") { setDraft(notes); setEditing(false); }
        }}
        placeholder="note…"
      />
    );
  }

  return (
    <div
      className={`notes-view ${notes ? "" : "muted"}`}
      onClick={() => !busy && setEditing(true)}
      title="Click to edit"
    >
      {notes || "add note"}
    </div>
  );
}

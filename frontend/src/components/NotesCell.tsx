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
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      // place caret at end
      const v = ref.current.value;
      ref.current.setSelectionRange(v.length, v.length);
    }
  }, [editing]);

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
      <div className="notes-editor">
        <textarea
          ref={ref}
          className="notes-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            if (e.key === "Escape") { setDraft(notes); setEditing(false); }
          }}
          placeholder="Write a note…"
        />
        <div className="notes-actions">
          <span className="notes-hint">⌘/Ctrl+Enter to save · Esc to cancel</span>
          <button className="notes-save" onMouseDown={(e) => e.preventDefault()} onClick={save}>
            Save
          </button>
        </div>
      </div>
    );
  }

  if (!notes) {
    return (
      <button
        className="notes-add"
        disabled={busy}
        onClick={() => setEditing(true)}
        title="Add a note"
      >
        <span className="notes-add-icon">＋</span> note
      </button>
    );
  }

  return (
    <div
      className="notes-chip"
      onClick={() => !busy && setEditing(true)}
      title="Click to edit"
    >
      <span className="notes-chip-icon">🗒</span>
      <span className="notes-chip-text">{notes}</span>
    </div>
  );
}

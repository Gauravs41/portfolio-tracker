import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { AlertNotification } from "../types";

const POLL_MS = 20_000;

/** Short beep via the Web Audio API (no asset needed). */
function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
    osc.onended = () => ctx.close();
  } catch {
    /* audio not available */
  }
}

function showBrowserNotification(n: AlertNotification) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    new Notification(n.title, { body: n.body, tag: `alert-${n.id}` });
  }
}

/**
 * Polls the backend for triggered alert notifications and surfaces them as
 * browser notifications + in-app toasts + a beep. Marks each as read so it
 * only fires once. Mounted once near the app root.
 */
export function AlertNotifier() {
  const [toasts, setToasts] = useState<AlertNotification[]>([]);
  const seen = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const notes = await api.listNotifications(true);
        if (!alive) return;
        const fresh = notes.filter((n) => !seen.current.has(n.id));
        if (fresh.length) {
          for (const n of fresh) {
            seen.current.add(n.id);
            showBrowserNotification(n);
            api.markNotificationRead(n.id).catch(() => {});
          }
          beep();
          setToasts((t) => [...fresh, ...t].slice(0, 5));
        }
      } catch {
        /* backend unreachable; retry next tick */
      } finally {
        if (alive) timer = window.setTimeout(poll, POLL_MS);
      }
    };

    poll();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = (id: number) => setToasts((t) => t.filter((n) => n.id !== id));

  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((n) => (
        <div key={n.id} className="toast" role="alert">
          <div className="toast-icon">🔔</div>
          <div className="toast-body">
            <div className="toast-title">{n.title}</div>
            {n.body && <div className="toast-text">{n.body}</div>}
          </div>
          <button className="toast-x" onClick={() => dismiss(n.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

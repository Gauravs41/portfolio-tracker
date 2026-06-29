import type {
  AlertNotification,
  AlertRule,
  AlertRuleInput,
  CandlesResponse,
  ChartDrawing,
  ChartDrawingsResponse,
  Diversification,
  Holding,
  HoldingsPerformance,
  Instrument,
  InstrumentMeta,
  PerformanceRow,
  RsiInterval,
  Watchlist,
  WatchlistItem,
} from "../types";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status}: ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // instruments
  searchInstruments: (q: string) =>
    req<Instrument[]>(`/instruments/search?q=${encodeURIComponent(q)}`),

  // instrument metadata (tags / notes / growth, global per stock)
  getInstrumentMeta: (key: string) =>
    req<InstrumentMeta>(`/instrument-meta/${encodeURIComponent(key)}`),
  updateInstrumentMeta: (key: string, payload: Partial<InstrumentMeta>) =>
    req<InstrumentMeta>(`/instrument-meta/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  listTags: () => req<string[]>("/instrument-meta/tags"),

  // watchlists
  listWatchlists: () => req<Watchlist[]>("/watchlists"),
  createWatchlist: (name: string) =>
    req<Watchlist>("/watchlists", { method: "POST", body: JSON.stringify({ name }) }),
  deleteWatchlist: (id: number) =>
    req<void>(`/watchlists/${id}`, { method: "DELETE" }),
  addWatchlistItem: (id: number, ins: Instrument) =>
    req<WatchlistItem>(`/watchlists/${id}/items`, {
      method: "POST",
      body: JSON.stringify({
        instrument_key: ins.instrument_key,
        symbol: ins.symbol,
        name: ins.name,
      }),
    }),
  removeWatchlistItem: (id: number, itemId: number) =>
    req<void>(`/watchlists/${id}/items/${itemId}`, { method: "DELETE" }),

  // holdings
  listHoldings: () => req<Holding[]>("/holdings"),
  createHolding: (payload: Partial<Holding>) =>
    req<Holding>("/holdings", { method: "POST", body: JSON.stringify(payload) }),
  updateHolding: (id: number, payload: Partial<Holding>) =>
    req<Holding>(`/holdings/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteHolding: (id: number) =>
    req<void>(`/holdings/${id}`, { method: "DELETE" }),

  // performance
  watchlistPerformance: (id: number, rsi: RsiInterval = "day") =>
    req<PerformanceRow[]>(`/performance/watchlist/${id}?rsi=${rsi}`),
  holdingsPerformance: (rsi: RsiInterval = "day") =>
    req<HoldingsPerformance>(`/performance/holdings?rsi=${rsi}`),

  // diversification
  diversification: () => req<Diversification>("/diversification"),

  // candles (OHLCV for charts)
  candles: (instrumentKey: string, interval: RsiInterval = "day") =>
    req<CandlesResponse>(
      `/candles/${encodeURIComponent(instrumentKey)}?interval=${interval}`,
    ),

  // chart drawings (user annotations, persisted per instrument)
  getDrawings: (instrumentKey: string) =>
    req<ChartDrawingsResponse>(`/chart-drawings/${encodeURIComponent(instrumentKey)}`),
  saveDrawings: (instrumentKey: string, drawings: ChartDrawing[]) =>
    req<ChartDrawingsResponse>(`/chart-drawings/${encodeURIComponent(instrumentKey)}`, {
      method: "PUT",
      body: JSON.stringify({ drawings }),
    }),

  // alerts (TradingView-style price/indicator/drawing alerts)
  listAlerts: (instrumentKey?: string) =>
    req<AlertRule[]>(
      `/alerts${instrumentKey ? `?instrument_key=${encodeURIComponent(instrumentKey)}` : ""}`,
    ),
  createAlert: (payload: AlertRuleInput) =>
    req<AlertRule>("/alerts", { method: "POST", body: JSON.stringify(payload) }),
  updateAlert: (id: number, payload: Partial<AlertRuleInput> & { is_active?: boolean }) =>
    req<AlertRule>(`/alerts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAlert: (id: number) => req<void>(`/alerts/${id}`, { method: "DELETE" }),
  testAlert: (id: number) =>
    req<AlertNotification>(`/alerts/${id}/test`, { method: "POST" }),

  // alert notifications (polled by the browser for push/toast)
  listNotifications: (unreadOnly = false) =>
    req<AlertNotification[]>(`/alerts/notifications${unreadOnly ? "?unread_only=true" : ""}`),
  markNotificationRead: (id: number) =>
    req<AlertNotification>(`/alerts/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () =>
    req<void>("/alerts/notifications/read-all", { method: "POST" }),
};

import type {
  Diversification,
  Holding,
  HoldingsPerformance,
  Instrument,
  InstrumentMeta,
  PerformanceRow,
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

  // instrument metadata (tags / notes, global per stock)
  getInstrumentMeta: (key: string) =>
    req<InstrumentMeta>(`/instrument-meta/${encodeURIComponent(key)}`),
  updateInstrumentMeta: (key: string, payload: Partial<InstrumentMeta>) =>
    req<InstrumentMeta>(`/instrument-meta/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

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
  watchlistPerformance: (id: number) =>
    req<PerformanceRow[]>(`/performance/watchlist/${id}`),
  holdingsPerformance: () => req<HoldingsPerformance>("/performance/holdings"),

  // diversification
  diversification: () => req<Diversification>("/diversification"),
};

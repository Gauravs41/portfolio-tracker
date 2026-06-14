export interface Instrument {
  instrument_key: string;
  symbol: string;
  name: string;
  exchange: string;
  segment: string;
  instrument_type: string;
  board_type: string;
}

export interface InstrumentMeta {
  instrument_key: string;
  symbol: string;
  name: string;
  tags: string[];
  notes: string;
  sector: string | null;
  board_type: string;
}

export interface WatchlistItem {
  id: number;
  instrument_key: string;
  symbol: string;
  name: string;
  sort_order: number;
}

export interface Watchlist {
  id: number;
  name: string;
  created_at: string;
  items: WatchlistItem[];
}

export interface Holding {
  id: number;
  instrument_key: string;
  symbol: string;
  name: string;
  quantity: number;
  avg_buy_price: number;
  sector: string | null;
  created_at: string;
}

export interface PerformanceRow {
  instrument_key: string;
  symbol: string;
  name: string;
  last_price: number | null;
  prev_close: number | null;
  change_1d: number | null;
  change_3d: number | null;
  change_1w: number | null;
  change_2w: number | null;
  change_1m: number | null;
  rsi_14: number | null;
  sma_20: number | null;
  sma_50: number | null;
  pe_ratio: number | null;
  trend: string;
  sentiment: string;
  tags: string[];
  notes: string;
}

export interface HoldingPerformanceRow extends PerformanceRow {
  id: number;
  quantity: number;
  avg_buy_price: number;
  market_value: number | null;
  invested: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  allocation_pct: number | null;
  sector: string | null;
  board_type: string;
}

export interface HoldingsPerformance {
  total_market_value: number;
  total_invested: number;
  total_pnl: number;
  total_pnl_pct: number;
  rows: HoldingPerformanceRow[];
}

export interface DiversificationSlice {
  label: string;
  value: number;
  pct: number;
  count: number;
}

export interface Diversification {
  total_market_value: number;
  by_sector: DiversificationSlice[];
  by_board: DiversificationSlice[];
}

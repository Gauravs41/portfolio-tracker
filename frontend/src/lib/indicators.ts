import type { Candle } from "../types";

export interface LinePoint {
  time: string;
  value: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Simple moving average of closes. Emits points once `period` bars exist. */
export function sma(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time, value: round(sum / period) });
  }
  return out;
}

/** Exponential moving average of closes (seeded with the first SMA). */
export function ema(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  if (candles.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += candles[i].close;
  let prev = seed / period;
  out.push({ time: candles[period - 1].time, value: round(prev) });
  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k);
    out.push({ time: candles[i].time, value: round(prev) });
  }
  return out;
}

export interface Bands {
  upper: LinePoint[];
  mid: LinePoint[];
  lower: LinePoint[];
}

/** Bollinger Bands: SMA(period) ± mult * population stddev. */
export function bollinger(candles: Candle[], period = 20, mult = 2): Bands {
  const upper: LinePoint[] = [];
  const mid: LinePoint[] = [];
  const lower: LinePoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    const mean = sum / period;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = candles[j].close - mean;
      variance += d * d;
    }
    const sd = Math.sqrt(variance / period);
    const t = candles[i].time;
    mid.push({ time: t, value: round(mean) });
    upper.push({ time: t, value: round(mean + mult * sd) });
    lower.push({ time: t, value: round(mean - mult * sd) });
  }
  return { upper, mid, lower };
}

export interface SuperTrendPoint {
  time: string;
  value: number;
  /** 1 = uptrend (band below price, green); -1 = downtrend (band above, red). */
  trend: 1 | -1;
}

/**
 * SuperTrend (ATR-based). Wilder-smoothed ATR(period), bands at
 * (high+low)/2 ± factor*ATR, with the usual final-band locking + flip logic.
 */
export function supertrend(candles: Candle[], period = 10, factor = 3): SuperTrendPoint[] {
  const n = candles.length;
  if (n < period + 1) return [];

  // True Range -> Wilder ATR.
  const atr: number[] = new Array(n).fill(NaN);
  let trSum = 0;
  for (let i = 1; i <= period; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    trSum += Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  }
  atr[period] = trSum / period;
  for (let i = period + 1; i < n; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
    atr[i] = (atr[i - 1] * (period - 1) + tr) / period;
  }

  const out: SuperTrendPoint[] = [];
  let prevUpper = 0;
  let prevLower = 0;
  let prevSt = 0;
  let started = false;
  for (let i = period; i < n; i++) {
    const c = candles[i];
    const mid = (c.high + c.low) / 2;
    const basicUpper = mid + factor * atr[i];
    const basicLower = mid - factor * atr[i];
    const closePrev = candles[i - 1].close;

    if (!started) {
      prevUpper = basicUpper;
      prevLower = basicLower;
      const trend: 1 | -1 = c.close >= mid ? 1 : -1;
      prevSt = trend === 1 ? prevLower : prevUpper;
      started = true;
      out.push({ time: c.time, value: round(prevSt), trend });
      continue;
    }

    const finalUpper = basicUpper < prevUpper || closePrev > prevUpper ? basicUpper : prevUpper;
    const finalLower = basicLower > prevLower || closePrev < prevLower ? basicLower : prevLower;

    let trend: 1 | -1;
    if (prevSt === prevUpper) {
      trend = c.close <= finalUpper ? -1 : 1; // was in downtrend
    } else {
      trend = c.close >= finalLower ? 1 : -1; // was in uptrend
    }
    const st = trend === 1 ? finalLower : finalUpper;
    out.push({ time: c.time, value: round(st), trend });

    prevUpper = finalUpper;
    prevLower = finalLower;
    prevSt = st;
  }
  return out;
}

export interface RelVolumePoint {
  time: string;
  value: number; // volume / SMA(volume, period)
  up: boolean; // candle direction (close >= open)
}

/** Relative volume: each bar's volume divided by its SMA(period) average. */
export function relVolume(candles: Candle[], period = 20): RelVolumePoint[] {
  const out: RelVolumePoint[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].volume;
    if (i >= period) sum -= candles[i - period].volume;
    if (i >= period - 1) {
      const avg = sum / period;
      const rel = avg > 0 ? candles[i].volume / avg : 0;
      out.push({
        time: candles[i].time,
        value: round(rel),
        up: candles[i].close >= candles[i].open,
      });
    }
  }
  return out;
}

/** RSI(period) using Wilder's smoothing. */
export function rsi(candles: Candle[], period = 14): LinePoint[] {
  const out: LinePoint[] = [];
  if (candles.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const push = (i: number) => {
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const value = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
    out.push({ time: candles[i].time, value: round(value) });
  };
  push(period);
  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const g = diff >= 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    push(i);
  }
  return out;
}

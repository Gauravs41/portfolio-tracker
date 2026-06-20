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

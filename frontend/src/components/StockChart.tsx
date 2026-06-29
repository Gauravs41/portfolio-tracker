import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type Time,
  type WhitespaceData,
} from "lightweight-charts";
import type { Candle } from "../types";
import {
  bollinger,
  ema,
  relVolume,
  rsi,
  sma,
  supertrend,
  type LinePoint,
} from "../lib/indicators";
import { DrawingOverlay, type Tool } from "./DrawingOverlay";
import type { AlertRule, ChartDrawing } from "../types";

const UP = "#26a69a";
const DOWN = "#ef5350";
const SMA20 = "#2962FF";
const SMA50 = "#FF6D00";
const EMA20 = "#AB47BC";
const BB = "#787B86";
const RSI = "#c792ea";
const ST_UP = "#22c55e";
const ST_DOWN = "#ef4444";

export interface IndicatorState {
  sma20: boolean;
  sma50: boolean;
  ema20: boolean;
  bollinger: boolean;
  supertrend: boolean;
  volume: boolean;
  relVolume: boolean;
  rsi: boolean;
}

export const DEFAULT_INDICATORS: IndicatorState = {
  sma20: true,
  sma50: true,
  ema20: false,
  bollinger: false,
  supertrend: true,
  volume: true,
  relVolume: false,
  rsi: true,
};

interface Props {
  candles: Candle[];
  indicators: IndicatorState;
  height?: number;
  tool?: Tool;
  drawingColor?: string;
  drawings?: ChartDrawing[];
  onDrawingsChange?: (drawings: ChartDrawing[]) => void;
  onToolDone?: () => void;
  alerts?: AlertRule[];
  onAddAlert?: (drawingId: string) => void;
}

// Price-level conditions whose threshold maps to a horizontal line on the chart.
const PRICE_LEVEL_CONDITIONS = new Set([
  "price_cross_up",
  "price_cross_down",
  "price_above",
  "price_below",
]);

const toLine = (pts: LinePoint[]): LineData<Time>[] =>
  pts.map((p) => ({ time: p.time as Time, value: p.value }));

/** TradingView Lightweight Charts: candles + overlays + volume + RSI pane. */
export function StockChart({
  candles,
  indicators,
  height,
  tool = "cursor",
  drawingColor = "#4c8dff",
  drawings = [],
  onDrawingsChange,
  onToolDone,
  alerts = [],
  onAddAlert,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [ready, setReady] = useState(false);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const sma50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMidRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowRef = useRef<ISeriesApi<"Line"> | null>(null);
  const stUpRef = useRef<ISeriesApi<"Line"> | null>(null);
  const stDownRef = useRef<ISeriesApi<"Line"> | null>(null);
  const relVolRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiLinesRef = useRef<IPriceLine[]>([]);
  const alertLinesRef = useRef<IPriceLine[]>([]);

  // Build the chart + all series once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#0f1115" },
        textColor: "#d1d4dc",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      grid: {
        vertLines: { color: "rgba(42,47,58,0.6)" },
        horzLines: { color: "rgba(42,47,58,0.6)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#2a2f3a" },
      timeScale: { borderColor: "#2a2f3a", rightOffset: 6 },
    });

    const price = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const overlay = (color: string, width: 1 | 2 = 2, style = LineStyle.Solid) =>
      chart.addSeries(LineSeries, {
        color,
        lineWidth: width,
        lineStyle: style,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

    sma20Ref.current = overlay(SMA20);
    sma50Ref.current = overlay(SMA50);
    ema20Ref.current = overlay(EMA20);
    bbUpRef.current = overlay(BB, 1);
    bbMidRef.current = overlay(BB, 1, LineStyle.Dashed);
    bbLowRef.current = overlay(BB, 1);

    // SuperTrend: two overlapping line series (green uptrend / red downtrend)
    // sharing the price scale; each is whitespace where the other is active.
    stUpRef.current = overlay(ST_UP, 2);
    stDownRef.current = overlay(ST_DOWN, 2);

    // RSI on its own pane (index 1).
    const rsiSeries = chart.addSeries(
      LineSeries,
      { color: RSI, lineWidth: 2, priceLineVisible: false, lastValueVisible: true },
      1,
    );
    chart.panes()[1]?.setHeight(120);

    // Relative volume histogram on its own pane (index 2).
    const relVol = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false },
      2,
    );
    chart.panes()[2]?.setHeight(100);

    // Manual, clamped sizing (instead of autoSize) so a layout glitch can never
    // grow the canvas past the browser's max size — which is what made the chart
    // blank out to a white area with a broken-image icon after a few seconds.
    const resize = () => {
      const w = Math.min(el.clientWidth, 6000);
      const h = Math.min(el.clientHeight, 6000);
      if (w > 0 && h > 0) chart.resize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    chartRef.current = chart;
    priceRef.current = price;
    volRef.current = vol;
    rsiRef.current = rsiSeries;
    relVolRef.current = relVol;
    setReady(true);

    return () => {
      ro.disconnect();
      chart.remove();
      setReady(false);
      chartRef.current = null;
      priceRef.current = null;
      volRef.current = null;
      sma20Ref.current = null;
      sma50Ref.current = null;
      ema20Ref.current = null;
      bbUpRef.current = null;
      bbMidRef.current = null;
      bbLowRef.current = null;
      stUpRef.current = null;
      stDownRef.current = null;
      relVolRef.current = null;
      rsiRef.current = null;
      rsiLinesRef.current = [];
    };
  }, []);

  // Push data whenever candles change.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !priceRef.current || !volRef.current) return;

    const priceData: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const volData: HistogramData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? "rgba(38,166,154,0.5)" : "rgba(239,83,80,0.5)",
    }));

    priceRef.current.setData(priceData);
    volRef.current.setData(volData);

    sma20Ref.current?.setData(toLine(sma(candles, 20)));
    sma50Ref.current?.setData(toLine(sma(candles, 50)));
    ema20Ref.current?.setData(toLine(ema(candles, 20)));
    const bb = bollinger(candles, 20, 2);
    bbUpRef.current?.setData(toLine(bb.upper));
    bbMidRef.current?.setData(toLine(bb.mid));
    bbLowRef.current?.setData(toLine(bb.lower));
    rsiRef.current?.setData(toLine(rsi(candles, 14)));

    // SuperTrend: split into green (uptrend) / red (downtrend) line series.
    // Each bar is whitespace on the inactive series so the lines break at flips;
    // the flip bar is included in both so the segments visually connect.
    const st = supertrend(candles, 10, 3);
    const upData: (LineData<Time> | WhitespaceData<Time>)[] = [];
    const downData: (LineData<Time> | WhitespaceData<Time>)[] = [];
    for (let i = 0; i < st.length; i++) {
      const p = st[i];
      const t = p.time as Time;
      const flip = i > 0 && st[i - 1].trend !== p.trend;
      const onUp = p.trend === 1 || (flip && st[i - 1].trend === 1);
      const onDown = p.trend === -1 || (flip && st[i - 1].trend === -1);
      upData.push(onUp ? { time: t, value: p.value } : { time: t });
      downData.push(onDown ? { time: t, value: p.value } : { time: t });
    }
    stUpRef.current?.setData(upData);
    stDownRef.current?.setData(downData);

    // Relative volume: brighter bar when at/above the average (rel >= 1).
    const relVolData: HistogramData<Time>[] = relVolume(candles, 20).map((p) => ({
      time: p.time as Time,
      value: p.value,
      color: p.up
        ? p.value >= 1 ? "rgba(38,166,154,0.9)" : "rgba(38,166,154,0.4)"
        : p.value >= 1 ? "rgba(239,83,80,0.9)" : "rgba(239,83,80,0.4)",
    }));
    relVolRef.current?.setData(relVolData);

    // Guide lines at 70/30 on the RSI pane.
    const rsiSeries = rsiRef.current;
    if (rsiSeries) {
      for (const pl of rsiLinesRef.current) rsiSeries.removePriceLine(pl);
      rsiLinesRef.current = [70, 30].map((price) =>
        rsiSeries.createPriceLine({
          price,
          color: "#3a3f4b",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: String(price),
        }),
      );
    }

    // Show the most recent ~120 bars but keep full history scrollable to the left.
    const n = candles.length;
    if (n > 0) {
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 3 });
    }
  }, [candles]);

  // Toggle series visibility without rebuilding the chart.
  useEffect(() => {
    sma20Ref.current?.applyOptions({ visible: indicators.sma20 });
    sma50Ref.current?.applyOptions({ visible: indicators.sma50 });
    ema20Ref.current?.applyOptions({ visible: indicators.ema20 });
    bbUpRef.current?.applyOptions({ visible: indicators.bollinger });
    bbMidRef.current?.applyOptions({ visible: indicators.bollinger });
    bbLowRef.current?.applyOptions({ visible: indicators.bollinger });
    stUpRef.current?.applyOptions({ visible: indicators.supertrend });
    stDownRef.current?.applyOptions({ visible: indicators.supertrend });
    volRef.current?.applyOptions({ visible: indicators.volume });
    relVolRef.current?.applyOptions({ visible: indicators.relVolume });
    rsiRef.current?.applyOptions({ visible: indicators.rsi });
    const panes = chartRef.current?.panes();
    panes?.[1]?.setHeight(indicators.rsi ? 120 : 1);
    panes?.[2]?.setHeight(indicators.relVolume ? 100 : 1);
  }, [indicators]);

  // Draw a dashed horizontal line for each price-level alert (TradingView-style).
  useEffect(() => {
    const series = priceRef.current;
    if (!ready || !series) return;
    for (const pl of alertLinesRef.current) series.removePriceLine(pl);
    alertLinesRef.current = alerts
      .filter((a) => a.is_active && PRICE_LEVEL_CONDITIONS.has(a.condition) && a.value > 0)
      .map((a) => {
        const down =
          a.condition === "price_below" || a.condition === "price_cross_down";
        return series.createPriceLine({
          price: a.value,
          color: down ? DOWN : UP,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `⏰ ${a.value}`,
        });
      });
  }, [alerts, ready]);

  return (
    <div
      className="stock-chart-wrap"
      style={height ? { width: "100%", height } : undefined}
    >
      <div ref={containerRef} className="stock-chart" />
      {ready && chartRef.current && priceRef.current && onDrawingsChange && (
        <DrawingOverlay
          chart={chartRef.current}
          series={priceRef.current}
          tool={tool}
          color={drawingColor}
          times={candles.map((c) => c.time)}
          drawings={drawings}
          onChange={onDrawingsChange}
          onToolDone={onToolDone ?? (() => {})}
          onAddAlert={onAddAlert}
        />
      )}
    </div>
  );
}

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
} from "lightweight-charts";
import type { Candle } from "../types";
import { bollinger, ema, rsi, sma, type LinePoint } from "../lib/indicators";
import { DrawingOverlay, type Tool } from "./DrawingOverlay";
import type { ChartDrawing } from "../types";

const UP = "#26a69a";
const DOWN = "#ef5350";
const SMA20 = "#2962FF";
const SMA50 = "#FF6D00";
const EMA20 = "#AB47BC";
const BB = "#787B86";
const RSI = "#c792ea";

export interface IndicatorState {
  sma20: boolean;
  sma50: boolean;
  ema20: boolean;
  bollinger: boolean;
  volume: boolean;
  rsi: boolean;
}

export const DEFAULT_INDICATORS: IndicatorState = {
  sma20: true,
  sma50: true,
  ema20: false,
  bollinger: false,
  volume: true,
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
}

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
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiLinesRef = useRef<IPriceLine[]>([]);

  // Build the chart + all series once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
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

    // RSI on its own pane (index 1).
    const rsiSeries = chart.addSeries(
      LineSeries,
      { color: RSI, lineWidth: 2, priceLineVisible: false, lastValueVisible: true },
      1,
    );
    chart.panes()[1]?.setHeight(120);

    chartRef.current = chart;
    priceRef.current = price;
    volRef.current = vol;
    rsiRef.current = rsiSeries;
    setReady(true);

    return () => {
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
    volRef.current?.applyOptions({ visible: indicators.volume });
    rsiRef.current?.applyOptions({ visible: indicators.rsi });
    chartRef.current?.panes()[1]?.setHeight(indicators.rsi ? 120 : 1);
  }, [indicators]);

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
          drawings={drawings}
          onChange={onDrawingsChange}
          onToolDone={onToolDone ?? (() => {})}
        />
      )}
    </div>
  );
}

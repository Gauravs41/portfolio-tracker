import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { Candle } from "../types";

const UP = "#26a69a";
const DOWN = "#ef5350";

interface Props {
  candles: Candle[];
  height?: number;
}

/** TradingView Lightweight Charts candlestick + volume renderer. */
export function StockChart({ candles, height = 460 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Create the chart once.
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
      timeScale: { borderColor: "#2a2f3a", rightOffset: 6, fixLeftEdge: true },
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
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    priceRef.current = price;
    volRef.current = vol;

    return () => {
      chart.remove();
      chartRef.current = null;
      priceRef.current = null;
      volRef.current = null;
    };
  }, []);

  // Push data whenever candles change.
  useEffect(() => {
    if (!priceRef.current || !volRef.current) return;

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
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}

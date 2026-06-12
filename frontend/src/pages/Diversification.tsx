import { useEffect, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "../api/client";
import { Num } from "../components/format";
import type { Diversification as DivData, DiversificationSlice } from "../types";

const COLORS = [
  "#4c8dff", "#2ecc71", "#ff5c5c", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#3498db", "#e74c3c", "#16a085",
  "#8e44ad", "#95a5a6",
];

function DivPie({ title, slices }: { title: string; slices: DiversificationSlice[] }) {
  return (
    <div className="panel" style={{ flex: 1, minWidth: 320 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {slices.length === 0 ? (
        <p className="muted">No data.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              outerRadius={100}
              label={(e) => `${e.label} ${e.pct.toFixed(0)}%`}
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, _name, props) =>
                [`₹${value.toLocaleString("en-IN")} (${props.payload.pct}%)`, props.payload.label]
              }
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function Diversification() {
  const [data, setData] = useState<DivData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.diversification().then(setData).catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <h2>Diversification</h2>
      {error && <div className="error">{error}</div>}
      {data && (
        <>
          <div className="cards">
            <div className="card">
              <div className="label">Portfolio Market Value</div>
              <div className="value"><Num value={data.total_market_value} prefix="₹" /></div>
            </div>
          </div>
          <div className="row" style={{ alignItems: "stretch", gap: 16 }}>
            <DivPie title="By Industry / Sector" slices={data.by_sector} />
            <DivPie title="By Board (SME vs Mainboard)" slices={data.by_board} />
          </div>
        </>
      )}
      {!data && !error && <p className="muted">Loading…</p>}
    </div>
  );
}

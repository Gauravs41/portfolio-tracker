import { useParams, useSearchParams, Link } from "react-router-dom";
import { ChartView } from "../components/ChartView";

/** Full-bleed chart page (opened in a new tab from the chart modal). */
export default function ChartPage() {
  const { instrumentKey = "" } = useParams();
  const [params] = useSearchParams();
  const key = decodeURIComponent(instrumentKey);
  const symbol = params.get("symbol") ?? key;
  const name = params.get("name") ?? "";

  return (
    <div className="chart-page">
      <div className="chart-page-head">
        <Link to="/watchlists" className="ghost chart-link">
          ← Back
        </Link>
      </div>
      <div className="chart-page-body">
        <ChartView instrumentKey={key} symbol={symbol} name={name} />
      </div>
    </div>
  );
}

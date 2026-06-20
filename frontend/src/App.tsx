import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Watchlists from "./pages/Watchlists";
import Holdings from "./pages/Holdings";
import Diversification from "./pages/Diversification";
import ChartPage from "./pages/ChartPage";

function Shell() {
  return (
    <div className="layout">
      <nav className="sidebar">
        <h1>Portfolio Tracker</h1>
        <NavLink to="/dashboard" className="nav-link">Dashboard</NavLink>
        <NavLink to="/watchlists" className="nav-link">Watchlists</NavLink>
        <NavLink to="/holdings" className="nav-link">Holdings</NavLink>
        <NavLink to="/diversification" className="nav-link">Diversification</NavLink>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/watchlists" element={<Watchlists />} />
          <Route path="/holdings" element={<Holdings />} />
          <Route path="/diversification" element={<Diversification />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Full-bleed chart route (opened in a new tab) — no sidebar. */}
      <Route path="/chart/:instrumentKey" element={<ChartPage />} />
      <Route path="/*" element={<Shell />} />
    </Routes>
  );
}

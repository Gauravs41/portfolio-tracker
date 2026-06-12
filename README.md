# Portfolio Tracker

A single-user portfolio tracker for Indian equities (NSE/BSE), powered by the
Upstox API. Phase 1 covers watchlists, holdings with allocation & indicators,
multi-window performance (1D/3D/1W/2W/1M) with bullish/bearish signals, and
diversification by sector and SME/mainboard.

- **Frontend:** React + TypeScript (Vite)
- **Backend:** Python FastAPI
- **Database:** Supabase (Postgres). Falls back to local SQLite if unconfigured.
- **Market data:** Upstox API

## Project layout
```
portfolio-tracker/
├── backend/    # FastAPI app, services, schema.sql, render.yaml
└── frontend/   # React app (Vite), pages & components, vercel.json
```

## Security
Never commit secrets. The Upstox token and database URL live only in
`backend/.env` (gitignored). **Regenerate the Upstox token if it was ever
shared in plain text.**

## Local setup

### 1. Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then edit .env
uvicorn app.main:app --reload --port 8000
```
- `.env` needs `UPSTOX_TOKEN`. `DATABASE_URL` is optional locally (defaults to
  `./portfolio.db` SQLite). Tables auto-create on startup.
- Verify: open http://localhost:8000/health and http://localhost:8000/docs

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env        # default VITE_API_BASE=/api is fine for local dev
npm run dev                 # http://localhost:5173 (proxies /api -> :8000)
```

## Supabase (production database)
1. Create a free project at supabase.com.
2. Project Settings → Database → copy the connection URI.
3. Set `DATABASE_URL` in `backend/.env` using the `+pg8000` driver, e.g.
   `postgresql+pg8000://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres`
4. Optionally run `backend/schema.sql` in the Supabase SQL editor (the app also
   auto-creates tables on startup).

## Deployment (free tiers)
- **Backend → Render:** `backend/render.yaml` is preconfigured. Set
  `UPSTOX_TOKEN`, `DATABASE_URL`, and `CORS_ORIGINS` (your Vercel URL) as env
  vars in the Render dashboard.
- **Frontend → Vercel:** import the `frontend/` directory. `vercel.json` handles
  SPA routing. Set `VITE_API_BASE` to your Render backend URL.

## API overview
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Service + config status |
| GET | `/instruments/search?q=` | Search instruments (Upstox master) |
| GET/POST/DELETE | `/watchlists[...]` | Manage watchlists & items |
| GET/POST/PATCH/DELETE | `/holdings[...]` | Manage holdings |
| GET | `/performance/watchlist/{id}` | Watchlist performance rows |
| GET | `/performance/holdings` | Holdings perf + allocation + totals |
| GET | `/diversification` | Sector & SME/mainboard breakdown |

## Future-readiness
Stub services and tables are already in place so these can be added without
restructuring:
- **AI** (`services/ai.py`, `ai_insights` table)
- **Financials** (`services/financials.py`, `financials` table)
- **Notifications** (`services/notifications.py`, `notifications` + `alert_rules`)

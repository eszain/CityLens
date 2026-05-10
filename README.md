# CityLens

Urban climate and income-inequality mapping for Toronto. Visualises how heat, air quality, flood risk, and green space overlap with income at the city-block level — and lets residents draft AI-assisted petitions to submit to city officials.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser  (Next.js 16 · React 19 · TypeScript)                   │
│                                                                   │
│  /          LandingView       Marketing / entry page              │
│  /map       HomeShell         Full map workspace (default)        │
│  /dashboard DashboardPanel    City-wide equity overview           │
│  /block/[id]                  Block detail + AI scoring           │
│                                                                   │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  MapView   │  │  InfoPanel   │  │  PetitionPanel / Right   │  │
│  │  Mapbox GL │  │  (left)      │  │  (right)                 │  │
│  │  choropleth│  │  block list  │  │  city overview           │  │
│  │  + overlays│  │  AI alerts   │  │  petition draft + PDF    │  │
│  └────────────┘  └──────────────┘  └──────────────────────────┘  │
└────────────────────────┬─────────────────────────────────────────┘
                         │ REST (fetch, no-store)
              ┌──────────┴──────────┐
              │  FastAPI  :8000     │
              │  asyncpg · PostGIS  │
              │                     │
              │  /blocks            │  GeoJSON + block detail
              │  /layers            │  Overlays, AQ, FIRMS
              │  /risk-scores       │  AI composite scores
              │  /equity            │  City equity snapshots
              │  /interventions     │  Recommended actions
              │  /work-orders       │  Remediation tracking
              │  /ingest            │  External data pipelines
              └──────────┬──────────┘
                         │
              ┌──────────┴──────────┐
              │  PostgreSQL+PostGIS  │
              │  (Supabase hosted   │
              │   or local Docker)  │
              └─────────────────────┘
```

**AI integrations**

| Feature | Provider | Model |
|---------|----------|-------|
| Block climate-risk scoring | Featherless AI | IBM Granite / Qwen 2.5 |
| Block detail AI analysis | IBM watsonx | IBM Granite |
| Petition drafting | Anthropic (Next.js Route Handler) | claude-haiku-4-5 |

**External data sources**

| Source | Data | Router / Service |
|--------|------|-----------------|
| OpenAQ | Air quality (PM2.5, PM10, O3) | `services/openaq.py` |
| NASA FIRMS | Thermal hotspots | `services/nasa_firms.py` |
| Sentinel Hub | Land surface temperature | `services/sentinel_hub.py` |
| IBM watsonx | ML block scoring | `services/watsonx.py` |

## Repository layout

```
CityLens/
├── frontend/               Next.js 16 app
│   └── src/
│       ├── app/
│       │   ├── api/petition/route.ts   Claude Haiku petition endpoint
│       │   ├── block/[id]/page.tsx     Block detail (server component)
│       │   ├── dashboard/page.tsx      Equity dashboard
│       │   ├── map/page.tsx            Full map workspace
│       │   ├── landing/page.tsx        Landing page
│       │   └── api.ts                  fetchJson helper + mapApiBlockRow
│       ├── components/
│       │   ├── HomeShell.tsx           Root layout + state for /map
│       │   ├── MapView.tsx             Mapbox GL choropleth + overlays
│       │   ├── InfoPanel.tsx           Left panel: block list + alerts
│       │   ├── PetitionPanel.tsx       Right panel: petition editor
│       │   ├── PetitionStore.tsx       Context + localStorage persistence
│       │   ├── AnalyticsPanel.tsx      City equity metrics
│       │   ├── DashboardPanel.tsx      /dashboard standalone view
│       │   └── ui/                     Shared primitives (AccentCard, MetricTile…)
│       ├── lib/
│       │   ├── api.ts                  API client (demo-aware)
│       │   ├── demoData.ts             Fixture data for demo mode
│       │   ├── petition.ts             Petition draft helpers
│       │   └── utils.ts                cn() + misc
│       └── types.ts                    Shared TypeScript types
│
├── backend/                FastAPI service
│   └── app/
│       ├── main.py                     App factory, CORS, lifespan
│       ├── config.py                   pydantic-settings config
│       ├── db.py / deps.py             asyncpg pool + DI
│       ├── routers/
│       │   ├── blocks.py               /blocks — GeoJSON + detail + rescore
│       │   ├── layers.py               /layers — overlays, AQ, FIRMS
│       │   ├── risk_scores.py          /risk-scores — composite AI scores
│       │   ├── equity.py               /equity — snapshots + alerts
│       │   ├── interventions.py        /interventions — ROI recommendations
│       │   ├── work_orders.py          /work-orders — remediation tracking
│       │   └── ingest.py               /ingest — pipeline triggers
│       └── services/
│           ├── featherless.py          Featherless AI (Granite/Qwen) scoring
│           ├── watsonx.py              IBM watsonx ML scoring
│           ├── scoring.py              Rule-based vulnerability fallback
│           ├── equity.py               Equity score computation
│           ├── openaq.py               OpenAQ ingest
│           ├── nasa_firms.py           NASA FIRMS ingest
│           ├── sentinel_hub.py         Sentinel Hub LST ingest
│           └── pipeline.py             Orchestrated ingest pipeline
│
├── supabase/
│   └── migrations/
│       └── 20250509000001_citylens_core.sql   Full PostGIS schema
│
├── scripts/
│   ├── seed_toronto.py                 Seed blocks + demographics
│   ├── seed_toronto_land_cover.py      Seed canopy/zoning overlays
│   ├── seed_toronto_official_overlays.py
│   └── seed_toronto_street_trees.py
│
└── infra/
    └── docker-compose.yml              Local Supabase stack
```

## Database schema

Core tables (PostGIS, UUID PKs):

| Table | Purpose |
|-------|---------|
| `cities` | Multi-city config (slug, JSONB config) |
| `blocks` | City blocks with geometry, LST, canopy, vulnerability score |
| `demographics` | Census income + population per block per year |
| `map_overlays` | Toggleable polygon layers: `canopy`, `zoning`, `flood_risk` |
| `air_quality_readings` | Point AQ readings spatially joined to blocks at query time |
| `block_thermal_snapshots` | Historical LST time series per block |
| `firms_hotspots` | NASA thermal hotspot points |
| `equity_snapshots` | Daily equity scores and under-resourced alerts per block |
| `interventions` | Recommended actions (tree canopy, cool roof, permeable pavement) |
| `work_orders` | Remediation tracking with department assignment and status |
| `departments` | City departments owning intervention types |

## Tech stack

**Frontend** (`/frontend`)
- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind v4 · shadcn/ui (base-ui) · lucide-react
- Mapbox GL JS 3.x — fullscreen choropleth with 3D buildings (Mapbox Standard style)
- `@react-pdf/renderer` — client-side petition PDF export
- `@anthropic-ai/sdk` — server-side Route Handler for petition drafting

**Backend** (`/backend`)
- FastAPI · asyncpg · PostgreSQL + PostGIS
- Supabase (hosted Postgres) or local Docker via `infra/docker-compose.yml`
- `ibm-watsonx-ai` · `httpx` for external data pipelines

## Setup

### 1. Environment variables

```bash
cp .env.example backend/.env
cp .env.example frontend/.env.local
```

| Variable | Location | Required |
|----------|----------|----------|
| `DATABASE_URL` | `backend/.env` | Yes |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `frontend/.env.local` | Yes |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | Yes (default `http://localhost:8000`) |
| `ANTHROPIC_API_KEY` | `frontend/.env.local` | Petition drafting |
| `FEATHERLESS_API_KEY` | `backend/.env` | AI block scoring |
| `IBM_WATSONX_API_KEY` | `backend/.env` | watsonx ML scoring |

### 2. Database

```bash
# Local (Docker + Supabase CLI)
cd infra && docker compose up -d
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/migrations/20250509000001_citylens_core.sql
python scripts/seed_toronto.py
python scripts/seed_toronto_land_cover.py
```

### 3. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (OpenAPI)
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

The app starts in **demo mode** (no backend required). Disable it via the toggle in the navbar once the backend is running.

## Key features

- **Fullscreen map** — block-level choropleth coloured by heat, equity, canopy, flood, or AQI lens; 3D buildings via Mapbox Standard style; optional overlay layers (canopy, zoning, flood risk, FIRMS hotspots, AQ stations)
- **Left panel** — high-priority block list with search/sort, equity alerts, block detail with IBM Granite AI analysis
- **Right panel** — city equity overview with coverage metrics, block CSV export, saved petition drafts
- **Petition workflow** — click any block → run AI analysis → Draft plan → Claude Haiku drafts a formal petition → edit in-panel → download as PDF; drafts persisted to localStorage
- **Dashboard** — standalone `/dashboard` route with city-wide equity and coverage statistics
- **Demo mode** — fixture data for all views; no backend or API keys needed to explore the UI
- **Data pipelines** — `/ingest` endpoints trigger OpenAQ, NASA FIRMS, and Sentinel Hub ingestion; watsonx and Featherless AI scoring are triggered on block detail load

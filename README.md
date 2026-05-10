# CityLens

Urban climate and income-inequality mapping for Toronto. Visualises how heat, air quality, flood risk, and green space overlap with income at the city-block level — and lets residents draft AI-assisted petitions to submit to city officials.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│                                                     │
│  ┌──────────────┐   ┌──────────┐   ┌─────────────┐ │
│  │  Mapbox GL   │   │  Left    │   │  Right      │ │
│  │  (fullscreen)│   │  panel   │   │  panel      │ │
│  │              │   │  blocks  │   │  overview / │ │
│  │  block fill  │   │  alerts  │   │  petition   │ │
│  │  + overlays  │   │  AI      │   │  draft      │ │
│  └──────────────┘   └──────────┘   └─────────────┘ │
└────────────────────────┬────────────────────────────┘
                         │ REST
          ┌──────────────┴──────────────┐
          │  FastAPI  (localhost:8000)   │
          │  asyncpg · PostGIS          │
          └──────────────┬──────────────┘
                         │
                  ┌──────┴──────┐
                  │  PostgreSQL │
                  │  + PostGIS  │
                  │  (Supabase) │
                  └─────────────┘
```

**AI integrations**

| Feature | Provider | Model |
|---------|----------|-------|
| Block climate-risk analysis | IBM / Featherless AI | IBM Granite / Qwen 2.5 |
| Petition drafting | Anthropic (server-side Route Handler) | Claude Haiku 4.5 |

## Tech stack

**Frontend** (`/frontend`)
- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind v4 · shadcn/ui (base-ui) · lucide-react
- Mapbox GL JS 3.x — fullscreen map with block fill + environmental overlays
- `@react-pdf/renderer` — client-side petition PDF export
- `@anthropic-ai/sdk` — server-side Route Handler for petition drafting

**Backend** (`/backend`)
- FastAPI · asyncpg · PostgreSQL + PostGIS
- Supabase (hosted Postgres) or local Docker via `supabase start`
- Optional data ingest: OpenAQ, NASA FIRMS, Sentinel Hub, IBM watsonx

## Setup

### 1. Environment variables

```bash
cp .env.example backend/.env
cp .env.example frontend/.env.local
```

Fill in at minimum:

| Key | Where | Required |
|-----|-------|----------|
| `DATABASE_URL` | `backend/.env` | Yes |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `frontend/.env.local` | Yes |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | Yes (default `http://localhost:8000`) |
| `ANTHROPIC_API_KEY` | `frontend/.env.local` | For petition drafting |
| `FEATHERLESS_API_KEY` | `backend/.env` | For AI block analysis |

### 2. Database

```bash
# Local (Docker + Supabase CLI)
cd infra && docker compose up -d
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/migrations/20250509000001_citylens_core.sql
python scripts/seed_toronto.py
```

### 3. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

The app defaults to **demo mode** (no backend required) — toggle it off in the navbar once the backend is running.

## Key features

- **Fullscreen map** — block-level fill coloured by heat, equity, canopy, flood, or AQI lens; 3D buildings via Mapbox Standard style
- **Left panel** — high-priority block list with search/sort, equity alerts, block detail with AI analysis
- **Right panel** — city equity overview with coverage metrics, block CSV export, saved petition drafts
- **Petition workflow** — click any block → run AI analysis → Draft plan → Claude Haiku drafts a formal petition → edit in-panel → download PDF
- **Demo mode** — fixture data for all views; no backend or API keys needed to explore the UI

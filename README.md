# CityLens

Urban climate and income-inequality mapping for Toronto. See how heat, air quality, flood risk, and green space overlap with income at the block level.

## Stack

- **Frontend** — Next.js 16, Tailwind v4, Mapbox GL JS, shadcn/ui
- **Backend** — FastAPI, asyncpg, PostgreSQL + PostGIS
- **Data** — OpenAQ, NASA FIRMS, Sentinel Hub, IBM watsonx (optional)

## Setup

Copy and fill in the two env files:

```bash
cp .env.example backend/.env
cp .env.example frontend/.env.local
```

You need a [Mapbox public token](https://mapbox.com) and a Postgres connection string.

## Running

**Database**
```bash
cd infra && docker compose up -d
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/migrations/20250509000001_citylens_core.sql
python scripts/seed_toronto.py
```

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

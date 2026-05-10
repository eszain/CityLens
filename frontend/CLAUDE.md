# CLAUDE.md

@AGENTS.md

# CityLens — Frontend

Toronto urban mapping platform. Visualises environmental layers (heat, equity, canopy, flood, air quality) correlated with income at the city-block level.

**Stack:** Next.js 16 · React 19 · Tailwind v4 · Mapbox GL JS 3.x · shadcn/ui (base-ui) · lucide-react

## Dev commands

```bash
npm run dev          # http://localhost:3000
npx tsc --noEmit     # type-check before committing
```

## Layout — fullscreen map + overlay panels

The map canvas sits at `absolute inset-0` and **never resizes**. Panels slide in/out via CSS `width` transition.

```
HomeShell (relative h-[100dvh])
├── MapView              absolute inset-0           z-0
├── NavBar wrapper       absolute left-0 right-0    z-20  — backdrop-blur-sm
├── Floating Layers btn  absolute, transitions left  z-15
├── Left panel           absolute left-0            z-10  — w-80 / w-10 collapsed
└── Right panel          absolute right-0           z-10  — w-80 / w-10 collapsed
```

**Layout constants (HomeShell.tsx):** `PANEL_W = 320`, `PANEL_COLLAPSED = 40`, `NAV_H = 52`, `DEMO_BANNER_H = 36`

**Stacking context:** NavBar `backdrop-blur-sm` creates a stacking context at z-20. Tooltips/popovers inside panels must use `createPortal(el, document.body)` — `position: fixed` alone is not enough.

## Routes

| Route | Entry point | Notes |
|-------|-------------|-------|
| `/` | `LandingView` | Marketing page |
| `/map` | `HomeShell` | Full map workspace |
| `/dashboard` | `DashboardPanel` + `AppRouteNav` | Standalone equity overview |
| `/block/[id]` | Server component | Block detail with IBM Granite AI scoring |

`DashboardPanel` is rendered server-side in `page.tsx` and passed as `rightPanel: ReactNode` to `HomeShell` to avoid making it async.

## Data flow in `HomeShell`

Single source of truth for the map workspace.

- **Data:** `blocks`, `workOrders`, `equityAlerts`, `cityStats` — fetched in parallel via `loadAll()` on mount and on `demoMode` change
- **UI state:** `leftOpen`, `rightOpen`, `activeView`, `viewMenuOpen`, `selectedBlock`, `mapThreshold`
- `mapBlocks` = `blocks` filtered by `mapThreshold` — passed to `MapView` only; `InfoPanel` always gets full `blocks`
- `activeView` (`'heat'|'equity'|'canopy'|'flood'|'aqi'`) controlled by floating Layers button
- `sortDir` for the high-priority list lives in `InfoPanel`

## Petition feature

After AI Analysis loads in `BlockDetail`, a **Draft plan** button opens a dialog (name/org/target audience). On submit, a Next.js Route Handler (`src/app/api/petition/route.ts`) calls **Claude Haiku 4.5** (`claude-haiku-4-5`) and returns `{ subject, body }`.

The petition doc appears in the right panel (`PetitionPanel`) — fully editable, downloadable as PDF via `@react-pdf/renderer`.

- `PetitionStore` (context + localStorage `citylens.petitions.v1`) persists drafts across reloads
- `PetitionDraftButton` is wrapped in `React.memo` so opening the dialog never re-renders the AI Analysis card
- `PetitionDownloadButton` and `PetitionPDFDocument` are dynamically imported with `ssr: false`
- `ANTHROPIC_API_KEY` is server-only (no `NEXT_PUBLIC_` prefix)

## MapView layers

All layers use **Mapbox Standard** style. Wrong slot renders under 3D buildings.

| Toggle | Source | Layer IDs | Slot |
|--------|--------|-----------|------|
| *(always on)* | `/blocks/geojson` | `blocks-fill`, `blocks-outline` | `middle` |
| `canopy`, `zoning`, `flood_risk` | `/layers/overlays/geojson?layers=...` | `overlay-*` | `middle` |
| `air_quality` | `/layers/air_quality/geojson` | `aq-circles` | `top` |
| `firms` | `/layers/firms/geojson` | `firms-circles` | `top` |
| `ai_risk` | `/risk-scores` + `/blocks/geojson` | `blocks-ai-fill`, `blocks-ai-outline` | `middle` |

Map init: `center: [-79.3832, 43.6532]`, `zoom: 15.5`, `pitch: 55`, `bearing: -17.6`.

## Demo mode

`DemoProvider` in `src/app/layout.tsx` wraps the entire app. Default `demoMode = true`.

- Every `api.ts` function accepts `demo: boolean`; when true, returns fixtures from `src/lib/demoData.ts`
- Demo banner (36px) offsets panel `top` via `panelTop = bannerH + NAV_H`

## API layer

`fetchJson<T>(path)` in `src/lib/api.ts` prepends `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`) and sets `cache: 'no-store'`.

`mapApiBlockRow()` converts snake_case rows to camelCase `Block`. Income decile derived from `income_median_cad` using hardcoded Toronto brackets (~$84k median).

## Navigation

- **`NavBar`** — map workspace only: logo, Map link, refresh, demo toggle
- **`AppRouteNav`** — breadcrumb bar on `/dashboard` and `/block/*`

## Shared UI components (`src/components/ui/`)

| Component | Purpose |
|-----------|---------|
| `AccentCard` | Left-border severity card wrapper |
| `DemoToggle` | Demo mode toggle switch |
| `MetricTile` | Labeled metric cell |
| `SectionLabel` | Section header with optional collapse toggle |
| `StatusBadge` | Work order status pill |
| `dialog.tsx` | `@base-ui/react` Dialog wrapped in shadcn-shaped exports |

**Hover states:** React inline styles don't support `:hover`. Use Tailwind arbitrary classes alongside inline styles for interactive hover tints. Non-interactive cards must not have hover styles.

## Styling conventions

- **Tokens:** `--cl-*` CSS vars in `globals.css` (earthy palette: greens, heats, reds)
- **Fonts:** `--font-display` = Fraunces · `--font-body` = Source Sans 3 · `--font-mono` = DM Sans
- Dynamic values → inline `style` props; static structure → Tailwind classes
- `cn()` from `@/lib/utils` for conditional Tailwind
- Tailwind v4: `@import "tailwindcss"` — no config file needed for arbitrary props
- `cursor: pointer` is global in `globals.css`

## Environment

```
NEXT_PUBLIC_MAPBOX_TOKEN=   # styles:read, tiles:read, fonts:read
NEXT_PUBLIC_API_URL=http://localhost:8000
ANTHROPIC_API_KEY=          # server-only, no NEXT_PUBLIC_ prefix
```

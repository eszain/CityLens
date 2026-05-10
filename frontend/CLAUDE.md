# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# CityLens — Frontend

Toronto urban mapping platform with five analytical lenses (heat, equity, canopy, flood, air quality). Visualises how environmental layers correlate with income at the city-block level.

**Stack:** Next.js 16 · React 19 · Tailwind v4 · Mapbox GL JS 3.x · shadcn/ui (base-ui) · lucide-react

## Dev commands

```bash
npm run dev          # http://localhost:3000
npx tsc --noEmit     # type-check before committing
```

## Design: fullscreen map + overlay panels

The map workspace (`/map`) is a fullscreen Mapbox canvas with overlay panels. The canvas **never resizes** — it sits at `absolute inset-0` always. Panels slide in/out via CSS `width` transition without touching the map.

```
HomeShell (relative h-[100dvh])
├── MapView              absolute inset-0           z-0  — always full viewport
├── NavBar wrapper       absolute left-0 right-0    z-20 — backdrop-blur-sm + bg-surface/95
├── Floating Layers btn  absolute, transitions left  z-15 — right of left panel
├── Left panel           absolute left-0            z-10 — w-80 open / w-10 collapsed
└── Right panel          absolute right-0           z-10 — w-80 open / w-10 collapsed
```

**Layout constants (HomeShell.tsx):**
- `PANEL_W = 320`, `PANEL_COLLAPSED = 40`, `NAV_H = 52`, `DEMO_BANNER_H = 36`
- Floating Layers button: `left = (leftOpen ? 320 : 40) + 12`, transitions with `duration-300 ease-out`

Do not add a ResizeObserver — the map never needs resizing.

**Stacking context gotcha:** The NavBar wrapper uses `backdrop-blur-sm` which creates a stacking context at z-20. Any tooltip or popover inside the right/left panels (z-10) must use `createPortal(el, document.body)` to escape — `position: fixed` alone is not enough. See `InfoTip` in `HomeShell.tsx` for the pattern.

## Routes

| Route | Entry point | Notes |
|-------|-------------|-------|
| `/` | `LandingView` | Marketing / explainer, not part of map workspace |
| `/map` | `HomeShell` + `<DashboardPanel embedded />` | Full map workspace |
| `/dashboard` | `DashboardPanel` + `AppRouteNav` | Standalone equity overview |
| `/block/[id]` | Server component | Block detail: vulnerability, IBM Granite AI scoring, interventions, work orders |

User-visible label is **"Overview"** everywhere (nav links, buttons, headings). The route `/dashboard` and component name `DashboardPanel` are unchanged.

## Data flow in `HomeShell`

`HomeShell` is the single source of truth for the map workspace. It owns all data and UI state and fans it out to children via props.

- **Data state:** `blocks`, `workOrders`, `equityAlerts`, `cityStats` — all fetched in parallel via `loadAll()` on mount and when `demoMode` changes
- **UI state:** `leftOpen`, `rightOpen`, `activeView`, `viewMenuOpen`, `selectedBlock`, `mapThreshold`
- `mapBlocks` = `blocks` filtered by `mapThreshold` severity — passed to `MapView` only. `InfoPanel` always receives full `blocks`.
- `activeView` (`'heat' | 'equity' | 'canopy' | 'flood' | 'aqi'`) is controlled by the floating `Layers` button in `HomeShell`
- `DashboardPanel` is rendered server-side in `page.tsx` and passed as `rightPanel: ReactNode` to avoid making `HomeShell` async
- `NavBar` receives only `onRefresh` — it does not own data or `activeView`
- `sortDir` for the High-priority list lives in `InfoPanel`, not `HomeShell`

## MapView layers

All layers use **Mapbox Standard** style (`mapbox://styles/mapbox/standard`). Wrong slot causes layers to render under 3D buildings.

| Toggle id | Source endpoint | Layer IDs | Slot |
|-----------|----------------|-----------|------|
| *(always on)* | `/blocks/geojson` | `blocks-fill`, `blocks-outline` | `middle` |
| `canopy`, `zoning`, `flood_risk` | `/layers/overlays/geojson?layers=...` | `overlay-*` + `-outline` | `middle` |
| `air_quality` | `/layers/air_quality/geojson` | `aq-circles` | `top` |
| `firms` | `/layers/firms/geojson` | `firms-circles` | `top` |
| `ai_risk` | `/risk-scores` + `/blocks/geojson` | `blocks-ai-fill`, `blocks-ai-outline` | `middle` |

Block markers are colored client-side by `getBlockColor(block, activeView)` in `MapView`. Map init: `center: [-79.3832, 43.6532]`, `zoom: 15.5`, `pitch: 55`, `bearing: -17.6`.

## Demo mode

`DemoProvider` (in `src/app/layout.tsx`) wraps the entire app. Default is `demoMode = true`.

- Every function in `api.ts` accepts a `demo: boolean` parameter; when `true`, returns fixture data from `src/lib/demoData.ts`
- `HomeShell` reads `demoMode` from context, passes it to all fetch calls, and re-fetches when it changes
- The demo banner (fixed, 36px) offsets panel `top` via `panelTop = bannerH + NAV_H`

## API layer (`src/lib/api.ts`)

All backend calls go through `fetchJson<T>(path)` which prepends `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`) and always sets `cache: 'no-store'`.

`mapApiBlockRow()` converts snake_case backend rows to camelCase `Block`. Income decile is derived from `income_median_cad` using hardcoded Toronto brackets (~$84k median).

## Navigation

Two separate navs — do not conflate them:
- **`NavBar`** — map workspace only (inside `HomeShell`): logo, route links, refresh, demo toggle
- **`AppRouteNav`** — thin breadcrumb bar used on `/dashboard` and `/block/*` pages

## Shared UI components (`src/components/ui/`)

| Component | Purpose | Key props |
|-----------|---------|-----------|
| `AccentCard` | Left-border severity card wrapper | `accentColor`, `style`, `className` |
| `DemoToggle` | Toggle switch for demo mode | `checked`, `onChange` |
| `MetricTile` | Labeled metric cell | `label`, `value`, `unit?`, `color?`, `compact?` |
| `SectionLabel` | Section header with optional collapse | `collapsed?`, `onToggle?`, `style?` |
| `StatusBadge` | Work order status pill | `status: WorkOrder['status']` |

**Hover states:** React inline styles don't support `:hover`. Use Tailwind arbitrary classes (`hover:bg-[rgba(...)]`) alongside inline styles for hover tint on interactive elements.

## Styling conventions

- **Design tokens:** `--cl-*` CSS variables in `globals.css` (earthy palette: greens, heats, reds)
- **Fonts:** `--font-display` = Fraunces, `--font-body` = Source Sans 3, `--font-mono` = DM Sans
- Map workspace components use inline `style` props for dynamic values; static structure uses Tailwind classes
- Use `cn()` from `@/lib/utils` for conditional Tailwind classes
- Tailwind v4: `@import "tailwindcss"`. Arbitrary props like `[will-change:width]` work without config
- `cursor: pointer` is set globally in `globals.css` — no need to add per-component

## Environment

```
NEXT_PUBLIC_MAPBOX_TOKEN=   # styles:read, tiles:read, fonts:read
NEXT_PUBLIC_API_URL=http://localhost:8000
```

@AGENTS.md

# CityLens — Frontend

Toronto urban climate and income-inequality mapping platform. Visualises how heat exposure,
air quality, flood risk, and green space correlate with income at the city-block level.

**Stack:** Next.js 16.2.6 · React 19.2.4 · Tailwind v4 · Mapbox GL JS 3.x · shadcn/ui (base-ui) · lucide-react

## Design: fullscreen map + overlay panels

The homepage is a fullscreen Mapbox map with two collapsible side panels floating over it.
The map canvas **never resizes** — it sits at `absolute inset-0` at all times. Panels slide
in/out via CSS `width` transition without affecting the map.

```
HomeShell (relative h-[100dvh])
├── MapView         absolute inset-0         — always full viewport, z-index 0
├── Left panel      absolute left-0 top-0 bottom-0   z-10  — overlay, w-80 / w-10
└── Right panel     absolute right-0 top-0 bottom-0  z-10  — overlay, w-80 / w-10
```

The layers widget inside `MapView` receives a `leftPanelOpen` prop and transitions its
`left` CSS value (`336px` open / `56px` collapsed) in sync with the panel animation
(`duration-300 ease-out`). Do not add a ResizeObserver — the map never needs resizing.

## Source structure

| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | Home — composes `<HomeShell rightPanel={<DashboardPanel />} />` |
| `src/app/dashboard/page.tsx` | Standalone `/dashboard` — same `DashboardPanel` in a max-w-md container |
| `src/app/block/[id]/page.tsx` | Block detail — vulnerability score, interventions, work orders |
| `src/app/layout.tsx` | Root layout — Geist fonts, globals.css |
| `src/app/globals.css` | Tailwind v4 import + shadcn CSS variable tokens (oklch palette) |
| `src/components/HomeShell.tsx` | `"use client"` — owns left/right panel open state, renders MapView + panels |
| `src/components/MapView.tsx` | `"use client"` — Mapbox GL map, vulnerability choropleth, layer toggles, popup |
| `src/components/DashboardPanel.tsx` | Server component — fetches `/equity/report`, renders equity stat cards |
| `src/components/ui/button.tsx` | shadcn Button (base-ui, variants: ghost / outline / default) |
| `src/components/ui/card.tsx` | shadcn Card + CardContent / CardHeader / CardTitle etc. |
| `src/components/ui/stat-card.tsx` | Label + big value + description — wraps Card, used for equity/vuln scores |
| `src/lib/api.ts` | `apiBase()` + `fetchJson<T>()` — all backend calls go through here |
| `src/lib/utils.ts` | `cn()` — Tailwind class merger (clsx + tailwind-merge) |

## Mapbox layers

All layers use the **Mapbox Standard** style (`mapbox://styles/mapbox/standard`). Add new
layers to the correct slot — wrong slot causes layers to render under 3D buildings.

| Source endpoint | Layer IDs | Slot | Notes |
|-----------------|-----------|------|-------|
| `/blocks/geojson` | `blocks-fill`, `blocks-outline` | `middle` | vulnerability choropleth, always on |
| `/layers/overlays/geojson` | `overlay-canopy/zoning/flood` + `-outline` | `middle` | toggled by layer checkboxes |
| `/layers/air_quality/geojson` | `aq-circles` | `top` | toggled, point layer above buildings |
| `/layers/firms/geojson` | `firms-circles` | `top` | toggled, point layer above buildings |

Map init: `center: [-79.3832, 43.6532]`, `zoom: 15.5`, `pitch: 55`, `bearing: -17.6`.
3D buildings require zoom ≥ 14 with the Standard style.

## Backend API

Base URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). All routes are city-scoped
(`?city=toronto`).

| Endpoint | Used by |
|----------|---------|
| `GET /blocks/geojson` | MapView — block geometry + vulnerability scores |
| `GET /layers/overlays/geojson?layers=canopy,zoning,flood_risk` | MapView — overlay polygons |
| `GET /layers/air_quality/geojson` | MapView — air quality circles |
| `GET /layers/firms/geojson` | MapView — NASA FIRMS hotspots |
| `GET /equity/report` | DashboardPanel — equity score, low-income block counts |
| `GET /equity/report?export_format=csv` | DashboardPanel — CSV download link |
| `GET /blocks/:id` | BlockPage — block detail, interventions, work orders |

## Environment (`frontend/.env.local`)

```
NEXT_PUBLIC_MAPBOX_TOKEN=   # must have styles:read, tiles:read, fonts:read
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Conventions

- Server components fetch data directly; client components receive data as props or via `ReactNode`.
- Pass server-rendered `<DashboardPanel />` to `HomeShell` as `rightPanel: ReactNode` — this
  is intentional to avoid making HomeShell async or duplicating fetch logic.
- Use `cn()` from `@/lib/utils` for conditional Tailwind classes.
- All new UI primitives go in `src/components/ui/`. Page-level components go in `src/components/`.
- Tailwind v4: use `@import "tailwindcss"` (not `@tailwind base/components/utilities`).
  Arbitrary properties like `[will-change:width]` and `transition-[left]` work without config.

## Dev

```bash
npm run dev          # http://localhost:3000
npx tsc --noEmit     # type-check before committing
```

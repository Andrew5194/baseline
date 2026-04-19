# Spec 09: Dashboard

## Context

With auth (spec 05), GitHub integration (spec 06), ingestion (spec 07), and metrics (spec 08) in place, the web app can now consume the API and render a real dashboard. This spec replaces the placeholder in `apps/web` with the product experience — the core surface that users see every day.

## Goal

Build the authenticated dashboard in `apps/web` that consumes the Baseline API and displays metrics, trends, activity, and integration status.

## Prerequisites

- Spec 05 is complete (auth works, sessions propagate)
- Spec 08 is complete (metrics API returns data)
- Spec 06 is complete (GitHub can be connected from the Sources page)
- `@baseline/api-client` is available with generated types

## In scope

- Dashboard layout: sidebar navigation + main content area
- Four pages: Overview, Trends, Sources, Settings
- Metric cards with current value, delta, and sparkline
- Trend chart (time series visualization)
- Activity feed (recent events)
- Integration status display
- Time window selector (7d / 30d / 90d)
- Dark mode support (matching marketing site aesthetic)
- Responsive layout (desktop-first, functional on tablet)
- All data fetched from `apps/api` via `@baseline/api-client` — no direct DB access

## Out of scope

- Mobile-optimized layout (functional but not optimized)
- Real-time updates / WebSocket (polling on page load is fine for v1)
- Data export (spec not yet written)
- Account deletion (spec not yet written)
- Onboarding flow / empty states beyond a "Connect GitHub" prompt

## Requirements

### Layout

1. The dashboard uses a persistent sidebar with navigation links: Overview, Trends, Sources, Settings. The sidebar shows the Baseline logo at the top and the user's email/avatar at the bottom with a sign-out button.

2. The main content area fills the remaining width. Each page has a header with the page title and a time window selector (7d / 30d / 90d) where applicable.

3. The layout follows the marketing site's design language: Geist font, neutral/slate tones, emerald accents for positive values, red for negative. No decorative elements.

### Overview page (`/`)

4. Three metric cards at the top, each showing:
   - Metric name (Focus hours, Cycle time, Throughput)
   - Current value with unit
   - Delta badge (▲ +12% in emerald, ▼ -8% in red)
   - A small sparkline (last 30 data points) for visual context

5. Below the metric cards, a primary trend chart showing the selected metric's time series for the current window. Clicking a metric card switches the chart to that metric.

6. Below the chart, a recent activity feed showing the last 20 events (commits, PRs merged, reviews) with relative timestamps ("2 hours ago"), event type icon, and summary text.

7. A small integration status banner at the bottom showing connected sources and last sync time.

### Trends page (`/trends`)

8. A full-width time series chart with controls:
   - Metric selector (dropdown or tabs)
   - Window selector (7d / 30d / 90d)
   - Bucket selector (day / week)
   - The chart renders the data from `GET /v1/metrics/timeseries`

9. Below the chart, summary statistics for the selected window: average, min, max, standard deviation.

### Sources page (`/sources`)

10. Already partially built in spec 06. This spec adds:
    - Visual polish matching the dashboard design language
    - Sync history: a small log of the last 5 syncs with timestamp, event count, and status
    - "Sync now" button that triggers `POST /v1/integrations/{id}/sync` and shows a loading state

### Settings page (`/settings`)

11. Minimal for v1:
    - User info (email, member since)
    - Placeholder sections for "Export data" and "Delete account" (not functional, marked as "Coming soon")

### Data fetching

12. All data is fetched from `apps/api` using `@baseline/api-client`. Use React Server Components for initial data loading where possible. Client-side fetching for interactive updates (window changes, metric switches).

13. Loading states: skeleton placeholders that match the layout of the content they replace. No spinners.

14. Error states: if the API returns an error, show an inline message. Do not crash the page.

### Empty states

15. If no integrations are connected, the Overview page shows a centered prompt: "Connect your first integration to start tracking" with a link to Sources.

16. If integrations are connected but no events exist yet (first sync hasn't run), show: "Syncing your data — this usually takes a minute" with a subtle loading indicator.

### Charting

17. Use a lightweight charting library. Preferred: `recharts` (React-native, composable, good defaults). Alternatives: `@visx/xychart` or `chart.js` with `react-chartjs-2`. Do not use heavyweight libraries like Highcharts or ApexCharts.

18. Charts should support dark mode (colors adjust with the theme).

## File changes

### Created
- `apps/web/app/layout.tsx` — rewrite with sidebar layout and session provider
- `apps/web/app/page.tsx` — Overview dashboard
- `apps/web/app/trends/page.tsx` — Trends page
- `apps/web/app/sources/page.tsx` — Sources page (enhanced from spec 06)
- `apps/web/app/settings/page.tsx` — Settings page
- `apps/web/app/sign-in/page.tsx` — already created in spec 05
- `apps/web/components/sidebar.tsx` — sidebar navigation
- `apps/web/components/metric-card.tsx` — metric display card
- `apps/web/components/trend-chart.tsx` — time series chart component
- `apps/web/components/activity-feed.tsx` — recent events list
- `apps/web/components/sparkline.tsx` — inline sparkline for metric cards
- `apps/web/components/window-selector.tsx` — 7d/30d/90d toggle
- `apps/web/components/skeleton.tsx` — loading skeleton primitives
- `apps/web/lib/api.ts` — configured API client instance

### Modified
- `apps/web/package.json` — add `@baseline/api-client`, `recharts`, `next-auth`
- `apps/web/globals.css` — dashboard-specific styles, dark mode tokens
- `apps/web/next.config.ts` — add API proxy rewrites if needed for CORS

### Deleted
- `apps/web/src/app/page.tsx` — replaced by the new dashboard (note: the current structure uses `src/app/`, this spec moves to `app/` directly for simplicity, or keeps `src/app/` — follow whatever convention is already in place)

## Acceptance criteria

- Visiting `http://localhost:3002` while authenticated shows the dashboard with metric cards
- The metric cards display real data from the API (or zeros if no events)
- Clicking a metric card updates the trend chart
- The time window selector (7d/30d/90d) re-fetches data for the selected window
- The Trends page renders an interactive time series chart
- The Sources page shows GitHub as connected with a working "Sync now" button
- The activity feed shows recent events with correct relative timestamps
- Dark mode works across all pages
- Loading states show skeletons, not spinners
- Empty states guide the user to connect GitHub
- `pnpm build` exits zero
- `pnpm type-check` exits zero
- No direct database imports exist anywhere in `apps/web`

## Notes for Claude Code

- Use the `src/app/` directory structure that already exists in `apps/web`. Do not restructure to `app/` at the root.
- Components go in `apps/web/src/app/components/` or `apps/web/src/components/` — follow whatever pattern is established.
- Use `@baseline/api-client` for all API calls. The client should be configured with the API server URL from an environment variable (`NEXT_PUBLIC_API_URL` or similar).
- For the sidebar, use a fixed-width sidebar (240px) with the main content taking the rest. Do not use a collapsible/hamburger sidebar for desktop.
- The chart library decision: prefer `recharts` for its React integration and composability. If it causes bundle size concerns, `@visx/xychart` is lighter but more complex to set up.
- Color palette for charts: use emerald-500 as the primary data color, with slate-200/slate-700 for axes and gridlines. Multiple metrics on one chart use emerald-500, cyan-500, amber-500.
- Sparklines in metric cards should be simple SVG paths, not full chart library instances. Keep them lightweight.
- The API client needs to forward the auth session cookie. If `apps/web` and `apps/api` are on different ports in development, configure a proxy rewrite in `next.config.ts` to avoid CORS issues: rewrite `/api/v1/*` to `http://localhost:3001/v1/*`.
- Do not fetch data in `useEffect` when Server Components can handle it. Use Server Components for the initial page render, Client Components for interactive elements (window selector, chart interactions).

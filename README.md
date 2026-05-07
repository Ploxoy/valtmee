# Valt mee

Release: `v0.1.1`

Valt mee is a calm daily dashboard for the Netherlands.

It shows four practical indicators at a glance:

- Euro95 fuel price,
- traffic jams,
- active NS rail disruptions,
- current weather.

The main screen is intentionally quiet: four cards, one daily summary, and no heavy navigation. Each card opens a focused detail page for users who want more context.

## Product Direction

The core idea:

> Valt mee is the daily pulse of the Netherlands in four numbers.

The homepage should stay useful in five seconds. Shareable or more decorative modes belong outside the main dashboard.

Current structure:

- `/` - daily dashboard
- `/benzine` - fuel price details and historical chart
- `/file` - traffic jam details from NDW
- `/spoor` - NS disruptions, calamities, and maintenance
- `/weer` - local weather and forecast

The footer exposes `dagbon`, a compact share-mode built around the same daily metrics. It is deliberately secondary so it does not compete with the dashboard.

## Data Sources

| Indicator | Source | Notes |
| --- | --- | --- |
| Fuel | CBS | Euro95 pump price, latest known value, not live station pricing |
| Traffic | NDW | Current traffic jam summary from NDW |
| Rail | NS Reisinformatie API | Active disruptions, calamities, and maintenance |
| Weather | Open-Meteo | Current weather; local forecast uses browser geolocation when allowed |
| Air quality | Open-Meteo/CAMS | Used on the weather detail view |
| Place name | OpenStreetMap Nominatim | Used only after geolocation permission |

Data is aggregated through `GET /api/metrics` into a UI-friendly payload.

All external metric sources should follow the same reliability rule:

- use a short upstream timeout;
- keep the last successful in-memory metric for the current server instance;
- use a short negative-cache cooldown after upstream failures;
- provide a safe static or unavailable fallback so one broken source does not
  block the full dashboard.

## UX Rules

- Keep the homepage calm and readable.
- Use detail pages instead of expanding everything on the homepage.
- Do not make the homepage look like a weather app or a news feed.
- Keep share functionality secondary as `dagbon`.
- Be explicit when data is not live, stale, or unavailable.

## Detail Pages

### `/benzine`

Shows the latest CBS Euro95 value, the latest known date, the previous-period trend, and a historical chart.

CBS data is labeled as `laatst bekend` because it is not a live pump price.

CBS requests have a short timeout and a fallback path. If the live CBS endpoint
is slow or unavailable, the app returns the last successful in-memory fuel
metric for the current server instance. After a CBS failure, the app uses a
short negative-cache cooldown so every request does not wait on the broken
upstream. On a cold start without a successful CBS response, it falls back to a
static last-known CBS snapshot so the dashboard does not block or render an
empty fuel card.

### `/file`

Shows total traffic jam length, number of jams, average jam length, latest NDW update, and the largest current jams.

NDW rows with timestamps older than 24 hours are still counted if NDW includes them in the current endpoint, but the detail page shows a warning.

### `/spoor`

Shows NS rail information in this order:

1. `storingen`
2. `calamiteiten`
3. `werkzaamheden`

For active disruptions, the page highlights the main reason or severity, such as `geen treinen`, before showing the route and NS details.

### `/weer`

Shows current weather and, when the browser grants location permission, local forecast details for the user's location.

If geolocation is unavailable or denied, the app falls back to the default national dashboard weather data.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Vercel-friendly dynamic server rendering

## Quick Start

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
NS_API_KEY=your_ns_api_key
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

- `NS_API_KEY` - NS Reisinformatie API key. Without it, rail data is returned as unavailable.
- `NEXT_PUBLIC_SITE_URL` - optional public base URL used by server-side same-origin fetch logic.
- `VERCEL_URL` - automatically provided by Vercel.

## Scripts

- `npm run dev` - run the app in development mode
- `npm run build` - create a production build
- `npm run start` - run the production server
- `npm run lint` - run ESLint
- `node scripts/make-icons.js` - generate PWA icons into `public/icons`
- `node scripts/ophef-poc.js` - experimental news-topic prototype, not part of the homepage v1

## Project Structure

- `app/page.tsx` - calm daily dashboard
- `app/api/metrics/route.ts` - external metrics aggregation endpoint
- `app/api/ophef/route.ts` - experimental ophef endpoint
- `app/lib/metrics.ts` - shared metric types, formatting, and summary helpers
- `app/components/share-button.tsx` - `dagbon` share interaction
- `app/components/local-forecast.tsx` - geolocation weather, forecast, and air quality
- `app/components/detail-shell.tsx` - shared detail page layout
- `app/benzine/page.tsx` - fuel detail page
- `app/file/page.tsx` - traffic detail page
- `app/spoor/page.tsx` - rail detail page
- `app/weer/page.tsx` - weather detail page
- `app/layout.tsx` - global layout and metadata
- `app/manifest.ts` - PWA manifest
- `app/site-config.ts` - shared site and PWA constants
- `scripts/make-icons.js` - PWA icon generation
- `scripts/ophef-poc.js` - local ophef prototype

## Deployment

Vercel is the recommended deployment target.

Before deploying:

1. Add `NS_API_KEY` to the Vercel environment variables.
2. Run `npm run lint`.
3. Run `npm run build`.

## Vercel Web Analytics

The app includes Vercel Web Analytics through `@vercel/analytics`.

To collect data in production:

1. Enable Web Analytics for the project in the Vercel dashboard.
2. Deploy the app to Vercel.
3. Open the deployed site and verify that analytics requests appear under `/_vercel/insights/*`.

The homepage and detail pages use dynamic rendering where needed so server-side metrics are fetched at request time instead of being incorrectly prerendered as static content.

## Current Status

This is the `v0.1.1` reliability release:

- homepage stays minimal,
- detail pages carry deeper information,
- `dagbon` remains a secondary share feature,
- data source transparency is part of the UI;
- external metric failures degrade gracefully instead of blocking the dashboard.

See `CHANGELOG.md` for release notes.

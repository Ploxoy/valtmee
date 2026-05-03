# Valt mee

A small Next.js dashboard that shows key Netherlands indicators as four cards:

- fuel price (CBS),
- weather (Open-Meteo),
- traffic jams (NDW),
- rail disruptions (NS).

The UI reads data from `GET /api/metrics`, which aggregates external APIs into a card-friendly payload.

## Tech Stack

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` (minimum):

```bash
NS_API_KEY=your_ns_api_key
```

`NS_API_KEY` is optional. If missing, the NS card is returned as unavailable.

3. Start development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` - run in development mode
- `npm run build` - create production build
- `npm run start` - run production server
- `npm run lint` - run ESLint

Additional script:

- `node scripts/make-icons.js` - generate PWA icons into `public/icons`

## Environment Variables

- `NS_API_KEY` - NS Reisinformatie API key (for rail disruption data)
- `NEXT_PUBLIC_SITE_URL` - public base URL (optional, used by server-side fetch logic)
- `VERCEL_URL` - automatically set on Vercel

## Data Sources

- CBS: Euro95 fuel prices
- Open-Meteo: current weather in Rotterdam
- NDW: live traffic jam summary
- NS Reisinformatie API: active disruptions and maintenance

The app uses `fetch` revalidation (`revalidate`) for external API caching.

## Project Structure

- `app/page.tsx` - homepage and card rendering
- `app/api/metrics/route.ts` - external data aggregation endpoint
- `app/layout.tsx` - global layout and metadata
- `app/manifest.ts` - PWA manifest
- `app/site-config.ts` - shared site and PWA constants
- `scripts/make-icons.js` - icon generation script

## Deployment

Vercel is the recommended deployment target.

Before deploying:

1. Add `NS_API_KEY` to your project environment variables.
2. Ensure `npm run build` passes successfully.

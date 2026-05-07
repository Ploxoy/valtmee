# Changelog

## v0.1.1 - 2026-05-07

Reliability and observability patch release.

### Reliability

- Added a shared reliability pattern for external metric sources: short upstream timeouts, last-good in-memory fallback, and negative-cache cooldowns after failures.
- Hardened CBS fuel loading so a slow or unavailable CBS endpoint no longer blocks the dashboard or renders an empty fuel card.
- Added a static last-known CBS fuel snapshot for cold starts when CBS is unavailable.
- Applied timeout and fallback handling to Open-Meteo, NDW, and NS metric fetches.
- Updated summary logic so unavailable weather or NS data is shown as `weer onbekend` or `spoor onbekend` instead of being interpreted as a normal calm state.

### Observability

- Added Vercel Web Analytics through `@vercel/analytics`.
- Documented the required Vercel dashboard setup for production analytics collection.

### Documentation

- Documented the external-source reliability rule for current and future metric integrations.
- Clarified CBS fallback behavior and the current `v0.1.1` release status.

## v0.1.0 - 2026-05-04

First baseline release of Valt mee.

### Product

- Calm daily dashboard with four core indicators: fuel, traffic, NS rail, and weather.
- Focused detail pages for `/benzine`, `/file`, `/spoor`, and `/weer`.
- Secondary `dagbon` share mode kept out of the primary dashboard flow.
- Dutch UI copy for the public-facing dashboard and metric details.

### Data

- CBS Euro95 pump price with `laatst bekend` labeling.
- NDW traffic jam summary with stale timestamp warning on the detail page.
- NS active disruptions, calamities, and maintenance, ordered by urgency.
- Open-Meteo weather, local forecast with geolocation permission, and air quality.

### Platform

- Next.js App Router implementation.
- Dynamic server rendering for metric-backed pages.
- PWA manifest and generated icons.

# Changelog

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

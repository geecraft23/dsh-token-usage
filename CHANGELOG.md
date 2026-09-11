# Changelog

## 0.2.0 — 2026-09-11

- Default to a complete 30-day activity grid, add 90 days, retain empty days in white, and format token counts with K/M/B and exact-value tooltips.
- Separate deployment (Local / Cloud) from token direction (Input / Output).
- Replace asymmetric cards with consistent totals and deployment comparisons.
- Add an activity calendar, weekly and cumulative views, peak daily usage and active-day insights.
- Filter exact provider-model routes and export local/cloud vocabulary in JSON format version 2.
- Preserve existing SQLite records and classifications; accept both new and legacy config labels.

## 0.1.0 — 2026-09-10

- Persistent per-provider and per-model token accounting through DSH's LLM extension point.
- Online/offline classification with historical updates and offline generation totals.
- Native English/Chinese settings page, daily trends, date/source filters, and JSON export.
- Missing-usage coverage and partial usage preservation for failed or cancelled calls.
- Verified against DSH 0.1.5-rc.1 and Cordis 4.0.2.

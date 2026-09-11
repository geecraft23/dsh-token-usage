# Validation

Target: DSH 0.1.5-rc.1, Cordis 4.0.2, Node.js 24.20.0, pnpm 11.7.0, macOS. Date: 2026-09-10.

## Automated checks

The 25 tests cover token arithmetic, cumulative streaming updates, independent retries, partial failures and cancellation, missing usage, shared SQLite writers and reopening, date boundaries, classification precedence, unsupported database versions, the real DSH LlmRuntime extension point, unchanged responses, endpoint disposal, and settings interactions. Type checking, declaration emission, and browser compilation are separate checks.

## Profile integration

The local directory and packaged tarball are tested in separate isolated profiles on the installed target DSH version. The deterministic provider in `tests/fixtures/smoke-provider.mjs` completes a Harness Agent task, including conversation and title generation. Expected totals for the two calls: 256 uncached input + 32 cache reads = 288 input; 64 output; 352 total. The 16 reasoning tokens are already included in output.

These are deterministic fixture counts, not measured cloud or local-model inference. Web and headless processes share an isolated test ledger. The settings page reads the counts and persists source changes. An unauthenticated report request returns HTTP 401.

Screenshots use synthetic records in a separate test ledger to show trends and filters. No demonstration calls are added to a user's real ledger. No older-session import, Windows/Linux end-to-end run, or historical-DST conversion is claimed.

## 0.2 dashboard validation

New checks cover independent deployment and token-direction selection, exact provider-model filtering, empty intersections, local/cloud export vocabulary, legacy configuration support, year-boundary streaks, leap days, fixed-offset date boundaries, missing weeks and the 366-day calendar limit. Activity days count observed requests, including requests without usage. Peaks and streaks follow the selected period and route. The calendar includes zero-activity days; weekly views retain empty weeks. Cumulative values use all measured days in the selection. Longest chat duration and plugin/skill usage are not derived from token records.

The default 90-day and optional 30-day views retain every date even with no requests. UI tests cover relative color levels and K/M/B formatting. On 2026-09-11 the installed Web profile rendered 30 cells (29 empty), then 90 cells (89 empty), with white inactive dates and 2.49M total tokens. Exact-value tooltips and numeric JSON exports retain full precision.

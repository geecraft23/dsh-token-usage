# Validation

Target: DSH 0.1.5-rc.1, Cordis 4.0.2, Node.js 24.20.0, pnpm 11.7.0, macOS. Date: 2026-09-11.

## Automated checks

The original collection tests cover token arithmetic, cumulative streaming updates, independent retries, partial failures and cancellation, missing usage, shared SQLite writers and reopening, date boundaries, classification precedence, unsupported database versions, the real DSH LlmRuntime extension point, unchanged responses, endpoint disposal, and settings interactions. Type checking, declaration emission, and browser compilation are separate checks.

## Profile integration

The local directory and packaged tarball are tested in separate isolated profiles on the installed target DSH version. The deterministic provider in `tests/fixtures/smoke-provider.mjs` completes a Harness Agent task, including conversation and title generation. Expected totals for the two calls: 256 uncached input + 32 cache reads = 288 input; 64 output; 352 total. The 16 reasoning tokens are already included in output.

These are deterministic fixture counts, not measured cloud or local-model inference. Web and headless processes share an isolated test ledger. The settings page reads the counts and persists source changes. An unauthenticated report request returns HTTP 401.

Screenshots use synthetic records in a separate test ledger to show trends and filters. No demonstration calls are added to a user's real ledger. Windows/Linux end-to-end runs and historical-DST conversion are not claimed. Historical import is validated separately below.

## 0.2 dashboard validation

New checks cover independent deployment and token-direction selection, exact provider-model filtering, empty intersections, local/cloud export vocabulary, legacy configuration support, year-boundary streaks, leap days, fixed-offset date boundaries, missing weeks and the 366-day calendar limit. Activity days count observed requests, including requests without usage. Peaks and streaks follow the selected period and route. The calendar includes zero-activity days; weekly views retain empty weeks. Cumulative values use all measured days in the selection. Longest chat duration and plugin/skill usage are not derived from token records.

The default 90-day and optional 30-day views retain every date even with no requests. UI tests cover relative color levels and K/M/B formatting. On 2026-09-11 the installed Web profile rendered 30 cells (29 empty), then 90 cells (89 empty), with white inactive dates and 2.49M total tokens. Exact-value tooltips and numeric JSON exports retain full precision.

The 0.2.0 release screenshots were captured from the current plugin in an isolated DSH Web profile using synthetic records. They show the 90-day activity grid with filled rounded tiles, compact counters, local/cloud totals, and local model input/output rows. Both READMEs and the npm description use local/cloud terminology; legacy field names are documented only under configuration compatibility.

## 0.3 historical import

The development suite passes 44 tests, plus type checking and compilation. History checks cover final usage snapshots, cached input, independent retries, compaction, partial failures, missing and invalid usage, ambiguous overlaps, adjacent requests, orphaned forks, repeated imports, two SQLite writers, cancellation/resume, newly appended history, v1 backup/migration, restart deduplication, failed reads/listing, limits, and the settings/API paths. Fixtures contain no real conversations.

A read-only snapshot of the local history and a consistent copy of its v1 ledger were imported in an isolated DSH 0.1.5-rc.1 Web profile. A separate projection over the host's validated events matched the resulting input and output totals exactly. Every pre-existing live request was linked without duplication; saved classifications were retained. Repeating the import added zero records. The host decoded both its older stored sessions and current logs, and excluded inherited fork prefixes. Missing usage and title requests without durable response usage remained explicit coverage gaps.

A separate Profile installed the packed 0.3.0 artifact, loaded its settings page and reopened the imported ledger; rescanning recognized all prior imports. The synthetic `tests/fixtures/history-demo.mjs` fixture creates 80 requests across two models through the public session persistence service. Its expected input is 3,512,000 (including 320,000 cached input), output 284,800, total 3,796,800. The screenshot `history-import.png` shows these synthetic records after import. The fixture requires `TOKEN_USAGE_DEMO=1` and must only run in an isolated profile with a separate session root and ledger.

Registry installation of 0.3.0 has not been tested because this development version has not been published to npm. The 0.2 registry proof does not establish 0.3 registry availability.

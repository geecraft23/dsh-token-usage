/** Durable request ledger; WAL coordinates multiple DSH processes sharing one file. */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'
import { sourceSchema, totalsSchema, type Attempt, type Query, type Report, type Rule, type Source, type Totals } from './types.js'

const emptyTotals = (): Totals => ({
  requests: 0, reportedRequests: 0, missingRequests: 0, openRequests: 0,
  failedRequests: 0, invalidRequests: 0, uncachedInputTokens: 0, cacheReadTokens: 0,
  cacheWriteTokens: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0,
  reasoningTokens: 0, cacheReadReports: 0, cacheWriteReports: 0, reasoningReports: 0,
})

function sum(target: Totals, value: Totals): void {
  for (const key of Object.keys(target) as (keyof Totals)[]) target[key] += value[key]
}

const aggregates = `COUNT(*) AS requests,
  SUM(input IS NOT NULL) AS reportedRequests,
  SUM(input IS NULL AND status <> 'open') AS missingRequests,
  SUM(status = 'open') AS openRequests,
  SUM(status IN ('error', 'aborted', 'interrupted')) AS failedRequests,
  SUM(invalid_usage) AS invalidRequests,
  COALESCE(SUM(input), 0) AS uncachedInputTokens,
  COALESCE(SUM(cache_read), 0) AS cacheReadTokens,
  COALESCE(SUM(cache_write), 0) AS cacheWriteTokens,
  COALESCE(SUM(input + COALESCE(cache_read, 0) + COALESCE(cache_write, 0)), 0) AS inputTokens,
  COALESCE(SUM(output), 0) AS outputTokens,
  COALESCE(SUM(input + COALESCE(cache_read, 0) + COALESCE(cache_write, 0) + output), 0) AS totalTokens,
  COALESCE(SUM(reasoning), 0) AS reasoningTokens,
  SUM(cache_read IS NOT NULL) AS cacheReadReports,
  SUM(cache_write IS NOT NULL) AS cacheWriteReports,
  SUM(reasoning IS NOT NULL) AS reasoningReports`

/** SQLite-backed accounting shared by every profile using the configured file. */
export class Ledger {
  private readonly db: DatabaseSync
  readonly trackingSince: number

  constructor(path: string, private readonly rules: readonly Rule[], busyTimeoutMs: number) {
    if (path !== ':memory:' && !isAbsolute(path)) throw new Error('token-usage: databasePath must be absolute')
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(path)
    try {
      this.db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}; PRAGMA journal_mode = WAL;`)
      this.db.exec('BEGIN IMMEDIATE')
      const version = this.db.prepare('PRAGMA user_version').get()?.user_version
      if (version !== 0 && version !== 1) throw new Error(`token-usage: unsupported ledger version ${version}`)
      this.db.exec(`CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS requests (
          id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
          provider TEXT NOT NULL, model TEXT NOT NULL, session_id TEXT, purpose TEXT NOT NULL,
          status TEXT NOT NULL, input INTEGER, output INTEGER, cache_read INTEGER, cache_write INTEGER,
          reasoning INTEGER, provider_total INTEGER, invalid_usage INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS requests_started ON requests(started_at);
        CREATE TABLE IF NOT EXISTS classifications (
          provider TEXT NOT NULL, model TEXT NOT NULL, source TEXT NOT NULL,
          PRIMARY KEY(provider, model)); PRAGMA user_version = 1;`)
      this.db.prepare("INSERT OR IGNORE INTO metadata VALUES ('tracking_since', ?)").run(Date.now())
      this.db.exec('COMMIT')
      this.trackingSince = Number(this.db.prepare("SELECT value FROM metadata WHERE key = 'tracking_since'").get()?.value)
    } catch (error) {
      this.db.close()
      throw error
    }
  }

  /** Replace cumulative counters for the same stream identity; never add repeated updates. */
  put(a: Attempt): void {
    const u = a.usage
    this.db.prepare(`INSERT INTO requests VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at, status=excluded.status,
      input=excluded.input, output=excluded.output, cache_read=excluded.cache_read,
      cache_write=excluded.cache_write, reasoning=excluded.reasoning, provider_total=excluded.provider_total,
      invalid_usage=excluded.invalid_usage`).run(
      a.id, a.startedAt, a.updatedAt, a.provider, a.model, a.sessionId, a.purpose, a.status,
      u?.inputTokens ?? null, u?.outputTokens ?? null, u?.cacheReadTokens ?? null,
      u?.cacheWriteTokens ?? null, u?.reasoningTokens ?? null, u?.totalTokens ?? null, Number(a.invalidUsage),
    )
  }

  /** Persist an exact route classification; changes apply to historical and future totals. */
  classify(provider: string, model: string, source: Source): void {
    this.db.prepare('INSERT OR REPLACE INTO classifications VALUES (?, ?, ?)').run(provider, model, source)
  }

  /** Aggregate in SQLite before returning a bounded per-day/per-route report. */
  report(query: Query, storageError = false): Report {
    const stored = new Map(this.db.prepare('SELECT * FROM classifications').all().map(row => [
      JSON.stringify([row.provider, row.model]), sourceSchema.parse(row.source),
    ]))
    const classify = (provider: string, model: string): Source => {
      const saved = stored.get(JSON.stringify([provider, model]))
      if (saved !== undefined) return saved
      const exact = this.rules.find(r => r.provider === provider && r.model === model)
      const providerRule = this.rules.find(r => r.provider === provider && r.model === undefined)
      return exact?.source ?? providerRule?.source ?? 'unclassified'
    }
    const rows = this.db.prepare(`SELECT provider, model, purpose,
      date(started_at / 1000, 'unixepoch', ?) AS day, ${aggregates}
      FROM requests WHERE started_at >= ? AND started_at < ? GROUP BY provider, model, purpose, day`).all(
      `${query.utcOffsetMinutes} minutes`, query.from ?? 0, query.to ?? Number.MAX_SAFE_INTEGER,
    )
    const totals = emptyTotals()
    const sources = new Map<Source, Totals>(['online', 'offline', 'unclassified'].map(s => [s as Source, emptyTotals()]))
    const models = new Map<string, Report['models'][number]>()
    const days = new Map<string, Report['days'][number]>()
    const purposes = new Map<string, Report['purposes'][number]>()
    for (const row of rows) {
      const provider = String(row.provider), model = String(row.model), purpose = String(row.purpose), day = String(row.day)
      const source = classify(provider, model)
      if (query.source !== undefined && query.source !== source) continue
      const value = totalsSchema.parse(row)
      sum(totals, value)
      sum(sources.get(source)!, value)
      const modelKey = JSON.stringify([provider, model])
      const entry = models.get(modelKey) ?? { provider, model, source, totals: emptyTotals() }
      sum(entry.totals, value); models.set(modelKey, entry)
      const dayKey = JSON.stringify([day, source])
      const dayEntry = days.get(dayKey) ?? { day, source, totals: emptyTotals() }
      sum(dayEntry.totals, value); days.set(dayKey, dayEntry)
      const purposeEntry = purposes.get(purpose) ?? { purpose, totals: emptyTotals() }
      sum(purposeEntry.totals, value); purposes.set(purpose, purposeEntry)
    }
    const bounds = this.db.prepare('SELECT MIN(started_at) AS first, MAX(started_at) AS last FROM requests').get()!
    return {
      createdAt: Date.now(), trackingSince: this.trackingSince,
      firstRequestAt: bounds.first === null ? null : Number(bounds.first),
      lastRequestAt: bounds.last === null ? null : Number(bounds.last), totals,
      sources: [...sources].map(([source, totals]) => ({ source, totals })),
      models: [...models.values()].sort((a, b) => b.totals.totalTokens - a.totals.totalTokens),
      days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
      purposes: [...purposes.values()], storageError,
    }
  }

  close(): void { this.db.close() }
}

import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { SessionHeader } from '@deepseek-ai/dsh-session'
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import { Ledger } from '../src/ledger.js'
import { extractHistory, type HistoryEvent } from '../src/history-extract.js'
import { HistoryImport } from '../src/history.js'
const directories: string[] = []
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }) })
const header: SessionHeader = { id: 's' as SessionHeader['id'], version: 3, createdAt: 0, isSeeded: false }
const event = (type: string, seq: number, time: number, data: unknown): HistoryEvent => ({ type, seq, time, data })
const route = event('request/header', 0, 900, { header: { config: { provider: 'local', model: 'qwen' } } })
const message = (seq = 1, start = 1000, end = 2000, input = 100): HistoryEvent => event('assistant/message', seq, end, {
  turn: 1, step: seq, message: { source: { kind: 'model', provider: 'local', model: 'qwen' }, content: [{ type: 'text', text: 'PRIVATE_RESPONSE' }] },
  usage: { inputTokens: input, outputTokens: 20, cacheReadTokens: 30, reasoningTokens: 5 },
  stream: [{ type: 'chunk', time: start, chunk: { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } } }, { type: 'chunk', time: end, chunk: { type: 'usage', usage: { inputTokens: input, outputTokens: 20, cacheReadTokens: 30, reasoningTokens: 5 } } }, { type: 'chunk', time: end, chunk: { type: 'finish', reason: { kind: 'stop' } } }],
})
const attempt = (seq = 1, start = 1000, end = 2000) => extractHistory(header, [route, message(seq, start, end)], 0).attempts[0]!
const limits = { historyMaxSessions: 20, historyMaxRequests: 100, historyMatchToleranceMs: 100 }
const makeSource = (events: HistoryEvent[], failRead = false) => {
  const close = vi.fn(async () => {})
  // This fixture implements only the list/read/close methods consumed by the coordinator.
  const source = { list: async () => [{ header }], open: async () => ({ header, inheritedEventCount: 0, close, read: async () => { if (failRead) throw Error('damaged'); return { events } } }) } as unknown as SessionPersistence
  return { source, close }
}
const finish = async (job: HistoryImport) => { await vi.waitFor(() => expect(['scanning', 'importing']).not.toContain(job.status().phase)); return job.status() }

it('projects final cumulative usage once without copying response content', () => {
  const result = extractHistory(header, [route, message()], 0)
  expect(result.attempts).toHaveLength(1)
  expect(result.attempts[0]).toMatchObject({ provider: 'local', model: 'qwen', startedAt: 1000, updatedAt: 2000, usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 30, reasoningTokens: 5 } })
  expect(JSON.stringify(result)).not.toContain('PRIVATE_RESPONSE')
})
it('recovers retry attempts and compaction, reports missing usage, and skips fork prefixes', () => {
  const rows = [route, message(), event('assistant/attempt', 2, 3000, { stream: [{ type: 'chunk', time: 3000, chunk: { type: 'finish', reason: { kind: 'error' } } }] }), event('compaction/start', 3, 4000, { compactionId: 'c' }), event('compaction/summary', 4, 5000, { compactionId: 'c', llmStreamCall: true, provider: 'cloud', model: 'deepseek', usage: { inputTokens: 400, outputTokens: 50 } }), event('session/title-llm-request', 5, 5001, {})]
  const result = extractHistory({ ...header, isSeeded: true }, rows, 2)
  expect(result.inherited).toBe(1); expect(result.auxiliary).toBe(1)
  expect(result.attempts).toHaveLength(2)
  expect(result.attempts[0]).toMatchObject({ status: 'error', usage: null })
  expect(result.attempts[1]).toMatchObject({ provider: 'cloud', purpose: 'compaction', startedAt: 4000, updatedAt: 5000 })
})
it('does not fabricate a model route or accept invalid usage', () => {
  const result = extractHistory(header, [event('assistant/attempt', 0, 1, { stream: [] }), route, event('assistant/message', 2, 2, { usage: { inputTokens: -1, outputTokens: 3 } })], 0)
  expect(result.attempts).toHaveLength(0)
  expect(result.issues.map(i => i.reason)).toEqual(['route', 'usage'])
})
it('imports identical counters from different requests and keeps replay and copies idempotent', () => {
  const ledger = new Ledger(':memory:', [], 1000)
  const first = attempt(), second = attempt(2, 1000, 2000)
  expect(ledger.importHistory(first, 100)).toBe('insert')
  expect(ledger.importHistory(first, 100)).toBe('existing')
  expect(ledger.importHistory(second, 100)).toBe('insert')
  expect(ledger.report({ utcOffsetMinutes: 0 }).totals).toMatchObject({ requests: 2, inputTokens: 260, outputTokens: 40, totalTokens: 300 })
  expect(ledger.importHistory({ ...first, fingerprint: 'changed' }, 100)).toBe('conflict')
  ledger.close()
})
it('links one matching live request and refuses ambiguous or conflicting overlaps', () => {
  const ledger = new Ledger(':memory:', [], 1000), a = attempt()
  ledger.put({ ...a, id: 'live', startedAt: 950, updatedAt: 2001 })
  expect(ledger.importHistory(a, 100)).toBe('link')
  expect(ledger.report({ utcOffsetMinutes: 0 }).totals.requests).toBe(1)
  expect(ledger.importHistory(attempt(2), 100)).toBe('conflict')
  const other = attempt(3, 10000, 11000)
  ledger.put({ ...other, id: 'live-2', usage: { inputTokens: 90, outputTokens: 10 } })
  expect(ledger.importHistory(other, 100)).toBe('conflict')
  const busy = attempt(4, 20000, 21000)
  ledger.put({ ...busy, id: 'open', status: 'open' })
  expect(ledger.importHistory(busy, 100)).toBe('conflict')
  ledger.close()
})
it('does not merge two near-simultaneous live requests with the same usage', () => {
  const ledger = new Ledger(':memory:', [], 1000), a = attempt()
  ledger.put({ ...a, id: 'one' }); ledger.put({ ...a, id: 'two' })
  expect(ledger.importHistory(a, 100)).toBe('conflict')
  expect(ledger.report({ utcOffsetMinutes: 0 }).totals.requests).toBe(2)
  ledger.close()
})
it('backs up v1 before migration and preserves classifications and restart deduplication', () => {
  const dir = mkdtempSync(join(tmpdir(), 'token-history-')); directories.push(dir)
  const file = join(dir, 'usage.sqlite')
  let ledger = new Ledger(file, [], 1000)
  ledger.put({ ...attempt(), id: 'old-live' }); ledger.classify('local', 'qwen', 'offline'); ledger.close()
  const old = new DatabaseSync(file); old.exec('DROP TABLE history_links; PRAGMA user_version=1'); old.close()
  ledger = new Ledger(file, [], 1000)
  expect(readdirSync(dir).some(n => n.includes('.v1-backup-'))).toBe(true)
  expect(ledger.importHistory(attempt(), 100)).toBe('link'); ledger.close()
  ledger = new Ledger(file, [], 1000)
  expect(ledger.importHistory(attempt(), 100)).toBe('existing')
  expect(ledger.report({ utcOffsetMinutes: 0 }).models[0]?.source).toBe('offline')
  ledger.close()
})
it('serializes duplicate imports from separate ledger connections', () => {
  const dir = mkdtempSync(join(tmpdir(), 'token-history-')); directories.push(dir)
  const first = new Ledger(join(dir, 'usage.sqlite'), [], 1000), second = new Ledger(join(dir, 'usage.sqlite'), [], 1000)
  expect(first.importHistory(attempt(), 100)).toBe('insert')
  expect(second.importHistory(attempt(), 100)).toBe('existing')
  first.close(); second.close()
})
it('previews without changing the ledger, then imports and refreshes exact totals', async () => {
  const ledger = new Ledger(':memory:', [], 1000), job = new HistoryImport(ledger, limits)
  const { source, close } = makeSource([route, message()]); job.attach(source)
  job.action('scan'); expect((await finish(job)).phase).toBe('ready')
  expect(job.status()).toMatchObject({ candidates: 1, inputTokens: 130, outputTokens: 20 })
  expect(ledger.report({ utcOffsetMinutes: 0 }).totals.requests).toBe(0)
  job.action('import'); expect((await finish(job)).imported).toBe(1)
  job.action('scan'); expect((await finish(job)).existing).toBe(1)
  job.action('import'); expect((await finish(job)).imported).toBe(0)
  expect(close).toHaveBeenCalledTimes(2)
  await job.detach(); ledger.close()
})
it('rechecks preview against live collection before committing', async () => {
  const ledger = new Ledger(':memory:', [], 1000), job = new HistoryImport(ledger, limits)
  job.attach(makeSource([route, message()]).source); job.action('scan'); await finish(job)
  ledger.put({ ...attempt(), id: 'arrived-after-preview' })
  job.action('import'); expect(await finish(job)).toMatchObject({ imported: 0, existing: 1 })
  expect(ledger.report({ utcOffsetMinutes: 0 }).totals.requests).toBe(1)
  await job.detach(); ledger.close()
})
it('reports failed reads, closes handles, and rejects oversized scans', async () => {
  const ledger = new Ledger(':memory:', [], 1000), job = new HistoryImport(ledger, limits)
  const { source, close } = makeSource([], true); job.attach(source); job.action('scan')
  expect(await finish(job)).toMatchObject({ unreadable: 1, candidates: 0, phase: 'ready' }); expect(close).toHaveBeenCalledTimes(1)
  await job.detach()
  const limited = new HistoryImport(ledger, { ...limits, historyMaxRequests: 1 })
  limited.attach(makeSource([route, message(), message(2)]).source); limited.action('scan')
  expect((await finish(limited)).phase).toBe('failed')
  expect(() => limited.action('import')).toThrow()
  await limited.detach(); ledger.close()
})
it('cancels an import and resumes by rescanning without counting completed rows twice', async () => {
  const ledger = new Ledger(':memory:', [], 1000), job = new HistoryImport(ledger, limits)
  job.attach(makeSource([route, message(), message(2, 4000, 5000)]).source)
  job.action('scan'); await finish(job); job.action('import'); job.action('cancel')
  expect((await finish(job)).phase).toBe('cancelled')
  job.action('scan'); await finish(job); job.action('import'); await finish(job)
  expect(ledger.report({ utcOffsetMinutes: 0 }).totals.requests).toBe(2)
  await job.detach(); ledger.close()
})

it('matches a settled request despite the next request starting within the clock tolerance', () => {
  const ledger = new Ledger(':memory:', [], 1000), a = attempt()
  ledger.put({ ...a, id: 'settled' })
  ledger.put({ ...attempt(2, 2001, 3000), id: 'next', usage: { inputTokens: 300, outputTokens: 40 } })
  expect(ledger.importHistory(a, 100)).toBe('link')
  expect(ledger.report({ utcOffsetMinutes: 0 }).totals.requests).toBe(2)
  ledger.close()
})
it('rescans growing history and imports only newly settled requests', async () => {
  const ledger = new Ledger(':memory:', [], 1000), job = new HistoryImport(ledger, limits)
  const events = [route, message()]
  job.attach(makeSource(events).source); job.action('scan'); await finish(job); job.action('import'); await finish(job)
  events.push(message(2, 4000, 5000))
  job.action('scan'); expect(await finish(job)).toMatchObject({ existing: 1, candidates: 2 })
  job.action('import'); expect(await finish(job)).toMatchObject({ existing: 1, imported: 1 })
  await job.detach(); ledger.close()
})
it('keeps packed chunk gaps and partial failure usage without summing cumulative snapshots', () => {
  const result = extractHistory(header, [route, event('assistant/attempt', 1, 3000, { stream: [
    { type: 'text-chunks', time0: 1000, dt: [10, 20], texts: ['a', 'b', 'c'] },
    { type: 'chunk', time: 1040, chunk: { type: 'usage', usage: { inputTokens: 70, outputTokens: 4 } } }
  ] })], 0)
  expect(result.attempts[0]).toMatchObject({ startedAt: 1000, updatedAt: 1040, status: 'interrupted', usage: { inputTokens: 70, outputTokens: 4 } })
})

it('reports an unavailable format during listing and exposes no import action', async () => {
  const ledger = new Ledger(':memory:', [], 1000), job = new HistoryImport(ledger, limits)
  const { source } = makeSource([])
  source.list = async () => { throw Error('unsupported session format') }
  job.attach(source); job.action('scan')
  expect(await finish(job)).toMatchObject({ phase: 'failed', issues: [{ sessionId: '', reason: 'list' }] })
  expect(() => job.action('import')).toThrow()
  await job.detach(); ledger.close()
})
it('reports orphaned fork history without recounting inherited requests', async () => {
  const ledger = new Ledger(':memory:', [], 1000), job = new HistoryImport(ledger, limits)
  const fork = { ...header, isSeeded: true, parentSession: 'missing' }
  const source = { list: async () => [{ header: fork }], open: async () => ({ id: header.id, header: fork, inheritedEventCount: 2, read: async () => ({ events: [route, message(), message(2, 4000, 5000)] }), close: async () => {} }) } as unknown as SessionPersistence
  job.attach(source); job.action('scan')
  expect(await finish(job)).toMatchObject({ candidates: 1, inherited: 1, issues: [{ sessionId: header.id, reason: 'lineage' }] })
  await job.detach(); ledger.close()
})

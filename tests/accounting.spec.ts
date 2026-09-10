import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { Ledger } from '../src/ledger.js'
import { capture } from '../src/capture.js'
import { configSchema } from '../src/config.js'
import { querySchema, type Attempt } from '../src/types.js'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
const path = () => { const root = mkdtempSync(join(tmpdir(), 'usage-test-')); roots.push(root); return join(root, 'ledger.sqlite') }
const query = { utcOffsetMinutes: 480 }
const options: GenerateOptions = { provider: 'spark', model: 'qwen', messages: [] }
const finish: StreamChunk = { type: 'finish', reason: { kind: 'stop' } }
const stream = async function* (chunks: StreamChunk[]) { yield* chunks }
const collect = async (value: AsyncIterable<StreamChunk>) => { const output = []; for await (const chunk of value) output.push(chunk); return output }
const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({
  id: 'a', startedAt: Date.parse('2026-09-09T17:00:00Z'), updatedAt: Date.now(),
  provider: 'spark', model: 'qwen', sessionId: 's', purpose: 'conversation', status: 'stop',
  usage: { inputTokens: 100, outputTokens: 25, cacheReadTokens: 30, cacheWriteTokens: 10, reasoningTokens: 8 },
  invalidUsage: false, ...overrides,
})

describe('persistent usage ledger', () => {
  it('adds disjoint input counters once and never adds reasoning twice', () => {
    const ledger = new Ledger(':memory:', [], 1000)
    ledger.put(attempt())
    expect(ledger.report(query).totals).toMatchObject({ inputTokens: 140, outputTokens: 25, totalTokens: 165, reasoningTokens: 8 })
    ledger.close()
  })
  it('replaces cumulative usage for a request and keeps distinct retries', () => {
    const ledger = new Ledger(':memory:', [], 1000)
    ledger.put(attempt({ usage: { inputTokens: 100, outputTokens: 2 } }))
    ledger.put(attempt())
    ledger.put(attempt({ id: 'retry', status: 'error' }))
    expect(ledger.report(query).totals).toMatchObject({ requests: 2, totalTokens: 330, failedRequests: 1 })
    ledger.close()
  })
  it('shares durable rows across writers, survives reopening, and reclassifies history', () => {
    const file = path()
    const first = new Ledger(file, [{ provider: 'spark', source: 'offline' }], 1000)
    const second = new Ledger(file, [], 1000)
    first.put(attempt()); second.put(attempt({ id: 'second', model: 'other' }))
    second.classify('spark', 'qwen', 'online')
    expect(first.report(query).models.find(r => r.model === 'qwen')?.source).toBe('online')
    first.close(); second.close()
    const reopened = new Ledger(file, [], 1000)
    expect(reopened.report(query).totals.totalTokens).toBe(330)
    expect(reopened.report(query).models.find(r => r.model === 'qwen')?.source).toBe('online')
    reopened.close()
  })
  it('keeps same-name models on different providers separate and uses exact rules first', () => {
    const ledger = new Ledger(':memory:', [
      { provider: 'spark', source: 'online' }, { provider: 'spark', model: 'qwen', source: 'offline' },
    ], 1000)
    ledger.put(attempt()); ledger.put(attempt({ id: 'b', provider: 'cloud' }))
    expect(ledger.report(query).models.map(r => [r.provider, r.source])).toEqual([['cloud', 'unclassified'], ['spark', 'offline']])
    expect(ledger.report({ ...query, source: 'offline' }).totals.requests).toBe(1)
    ledger.close()
  })
  it('groups UTC timestamps by the selected fixed offset and excludes the end boundary', () => {
    const ledger = new Ledger(':memory:', [], 1000)
    ledger.put(attempt())
    expect(ledger.report(query).days[0]?.day).toBe('2026-09-10')
    expect(ledger.report({ utcOffsetMinutes: 0 }).days[0]?.day).toBe('2026-09-09')
    expect(ledger.report({ ...query, to: attempt().startedAt }).totals.requests).toBe(0)
    expect(ledger.report({ ...query, from: attempt().startedAt }).totals.requests).toBe(1)
    ledger.close()
  })
  it('distinguishes reported zero, missing data, and unfinished attempts', () => {
    const ledger = new Ledger(':memory:', [], 1000)
    ledger.put(attempt({ usage: null }))
    ledger.put(attempt({ id: 'b', status: 'open', usage: null }))
    ledger.put(attempt({ id: 'c', usage: { inputTokens: 0, outputTokens: 0 } }))
    expect(ledger.report(query).totals).toMatchObject({ requests: 3, reportedRequests: 1, missingRequests: 1, openRequests: 1, totalTokens: 0 })
    ledger.close()
  })
  it('rejects unsupported ledger versions without rewriting the database', () => {
    const file = path(), db = new DatabaseSync(file)
    db.exec('PRAGMA user_version = 99'); db.close()
    expect(() => new Ledger(file, [], 1000)).toThrow('unsupported ledger version 99')
    const check = new DatabaseSync(file)
    expect(check.prepare('PRAGMA user_version').get()?.user_version).toBe(99); check.close()
  })
  it('rejects invalid dates and malformed configuration', () => {
    expect(() => querySchema.parse({ from: 3, to: 2 })).toThrow()
    expect(() => querySchema.parse({ utcOffsetMinutes: 9999 })).toThrow()
    expect(() => configSchema.parse({ rules: [{ provider: 'spark', source: 'local-ish' }] })).toThrow()
    expect(() => new Ledger('relative.sqlite', [], 1000)).toThrow('must be absolute')
  })
})

describe('LLM stream capture', () => {
  it('preserves the stream exactly, counts the latest usage, and keeps auxiliary purpose', async () => {
    const ledger = new Ledger(':memory:', [], 1000)
    const chunks: StreamChunk[] = [
      { type: 'text-delta', index: 0, text: 'private response' },
      { type: 'usage', usage: { inputTokens: 50, outputTokens: 2 } },
      { type: 'usage', usage: { inputTokens: 50, outputTokens: 10 } }, finish,
    ]
    expect(await collect(capture({ ...options, purpose: 'compaction' }, () => stream(chunks), ledger))).toEqual(chunks)
    const report = ledger.report(query)
    expect(report.totals).toMatchObject({ requests: 1, totalTokens: 60 })
    expect(report.purposes[0]?.purpose).toBe('compaction')
    expect(JSON.stringify(report)).not.toContain('private response')
    ledger.close()
  })
  it('keeps partial usage when the consumer cancels and closes the underlying iterator', async () => {
    const ledger = new Ledger(':memory:', [], 1000)
    let closed = false
    const source = async function* (): AsyncGenerator<StreamChunk> {
      try { yield { type: 'usage', usage: { inputTokens: 3, outputTokens: 5 } }; yield finish }
      finally { closed = true }
    }
    for await (const _ of capture(options, source, ledger)) break
    expect(closed).toBe(true)
    expect(ledger.report(query).totals).toMatchObject({ totalTokens: 8, failedRequests: 1, openRequests: 0 })
    ledger.close()
  })
  it('retains terminal failures and does not invent usage for an unreported request', async () => {
    const ledger = new Ledger(':memory:', [], 1000)
    const failure: StreamChunk = { type: 'finish', reason: { kind: 'error', failure: { code: 'TEST', message: 'test' } } }
    await collect(capture(options, () => stream([failure]), ledger))
    expect(ledger.report(query).totals).toMatchObject({ totalTokens: 0, missingRequests: 1, failedRequests: 1 })
    ledger.close()
  })
  it('settles a thrown adapter error and preserves the caller error', async () => {
    const ledger = new Ledger(':memory:', [], 1000)
    await expect(collect(capture(options, () => { throw new Error('adapter failed') }, ledger))).rejects.toThrow('adapter failed')
    expect(ledger.report(query).totals).toMatchObject({ requests: 1, missingRequests: 1, failedRequests: 1 })
    ledger.close()
  })
})

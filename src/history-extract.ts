/** Project validated DSH events into request counters; never retain conversation content. */
import { createHash } from 'node:crypto'
import type { SessionHeader } from '@deepseek-ai/dsh-session'
import { usageSchema, type Usage } from './types.js'
import type { HistoricalAttempt, HistoryState } from './history-types.js'
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const object = (v: unknown): Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {}
const time = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const route = (v: unknown): { provider: string; model: string } | null => {
  const x = object(v)
  return typeof x.provider === 'string' && x.provider.length > 0 && typeof x.model === 'string' && x.model.length > 0 ? { provider: x.provider, model: x.model } : null
}
/** Host persistence validates the merge-extensible event vocabulary before projection. */
export interface HistoryEvent { type: string; seq: number; time: number; data: unknown }
export interface ExtractedHistory { attempts: HistoricalAttempt[]; inherited: number; auxiliary: number; issues: HistoryState['issues'] }

/** Use only owned settlements. Fork prefixes are accounted through their original sessions. */
export function extractHistory(header: SessionHeader, events: readonly HistoryEvent[], inheritedCount: number): ExtractedHistory {
  const result: ExtractedHistory = { attempts: [], inherited: 0, auxiliary: 0, issues: [] }
  let currentRoute: ReturnType<typeof route> = null
  const compactions = new Map<string, number>()
  for (const event of events) {
    const data = object(event.data)
    if (event.type === 'request/header') currentRoute = route(object(data.header).config)
    if (event.type === 'compaction/start' && typeof data.compactionId === 'string') compactions.set(data.compactionId, event.time)
    if (event.type === 'session/title-llm-request' && event.seq >= inheritedCount) result.auxiliary++
    if (!['assistant/message', 'assistant/attempt', 'compaction/summary'].includes(event.type)) continue
    if (event.seq < inheritedCount) { result.inherited++; continue }
    if (event.type === 'compaction/summary' && data.llmStreamCall !== true) continue
    const model = event.type === 'compaction/summary' ? route(data) : route(object(data.message).source) ?? currentRoute
    if (!model) { result.issues.push({ sessionId: header.id, reason: 'route' }); continue }
    let first = event.time, last = event.time, status = data.interrupted === true ? 'interrupted' : event.type === 'assistant/attempt' ? 'interrupted' : 'stop'
    let rawUsage = data.usage
    if (event.type === 'compaction/summary') {
      first = compactions.get(String(data.compactionId)) ?? event.time
    } else if (Array.isArray(data.stream) && data.stream.length) {
      let min = Infinity, max = 0
      for (const raw of data.stream) {
        const record = object(raw)
        if (record.type === 'chunk') {
          if (time(record.time)) { min = Math.min(min, record.time); max = Math.max(max, record.time) }
          const chunk = object(record.chunk)
          if (chunk.type === 'usage') rawUsage = chunk.usage
          if (chunk.type === 'finish' && typeof object(chunk.reason).kind === 'string') status = String(object(chunk.reason).kind)
          if (chunk.type === 'error') status = 'error'
        } else if (time(record.time0)) {
          min = Math.min(min, record.time0)
          const dt = Array.isArray(record.dt) ? record.dt : []
          max = Math.max(max, record.time0 + dt.reduce<number>((sum, n) => sum + (time(n) ? n : 0), 0))
        }
      }
      if (min !== Infinity) { first = min; last = max }
      if (data.interrupted === true) status = 'interrupted'
    }
    let usage: Usage | null = null
    if (rawUsage !== undefined) {
      const parsed = usageSchema.safeParse(rawUsage)
      if (!parsed.success) { result.issues.push({ sessionId: header.id, reason: 'usage' }); continue }
      usage = parsed.data
    }
    const historyId = hash([header.id, event.seq, event.type])
    const attempt: HistoricalAttempt = { historyId, fingerprint: '', id: `history:${historyId}`, sessionId: header.id, startedAt: first, updatedAt: last, ...model, purpose: event.type === 'compaction/summary' ? 'compaction' : 'conversation', status, usage, invalidUsage: false }
    attempt.fingerprint = hash([model.provider, model.model, first, last, status, usage?.inputTokens ?? null, usage?.outputTokens ?? null, usage?.cacheReadTokens ?? null, usage?.cacheWriteTokens ?? null, usage?.reasoningTokens ?? null])
    result.attempts.push(attempt)
  }
  return result
}

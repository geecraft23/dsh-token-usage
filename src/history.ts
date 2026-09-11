/** Cancellable, content-free history preview and idempotent import coordinator. */
import { setImmediate } from 'node:timers/promises'
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import type { Ledger } from './ledger.js'
import { extractHistory } from './history-extract.js'
import { emptyHistory, type HistoricalAttempt, type HistoryState } from './history-types.js'

export class HistoryImport {
  private source: SessionPersistence | null = null
  private state = emptyHistory('unavailable')
  private attempts: HistoricalAttempt[] = []
  private abort: AbortController | null = null
  private job: Promise<void> | null = null
  constructor(private ledger: Ledger, private limits: { historyMaxSessions: number; historyMaxRequests: number; historyMatchToleranceMs: number }) {}
  attach(source: SessionPersistence): void { this.source = source; this.state = emptyHistory('idle') }
  status(): HistoryState { return structuredClone(this.state) }
  private issue(sessionId: string, reason: HistoryState['issues'][number]['reason']): void {
    if (this.state.issues.length < 100) this.state.issues.push({ sessionId, reason })
  }
  action(action: 'status' | 'scan' | 'import' | 'cancel'): HistoryState {
    if (action === 'status') return this.status()
    if (action === 'cancel') { this.abort?.abort(); return this.status() }
    if (!this.source) throw new Error('Session history is unavailable')
    if (this.job) throw new Error('History operation is already running')
    if (action === 'import' && this.state.phase !== 'ready') throw new Error('Scan history before importing')
    const abort = new AbortController(); this.abort = abort
    this.job = (action === 'scan' ? this.scan(this.source, abort.signal) : this.import(abort.signal)).catch(() => {
      this.state.phase = abort.signal.aborted ? 'cancelled' : 'failed'
      if (!abort.signal.aborted) this.issue('', action === 'scan' ? 'list' : 'write')
    }).finally(() => { this.job = null; this.abort = null })
    return this.status()
  }
  private async scan(source: SessionPersistence, signal: AbortSignal): Promise<void> {
    this.state = emptyHistory('scanning'); this.attempts = []
    const sessions = await source.list({ signal }); signal.throwIfAborted()
    this.state.sessions = sessions.length
    if (sessions.length > this.limits.historyMaxSessions) { this.issue('', 'limit'); this.state.phase = 'failed'; return }
    const ids = new Set(sessions.map(s => s.header.id))
    const seen = new Set<string>()
    for (const session of sessions) {
      signal.throwIfAborted()
      try {
        const handle = await source.open(session.header.id, 'read', { signal })
        let projected
        try {
          const { events } = await handle.read(undefined, undefined, { signal }); signal.throwIfAborted()
          projected = extractHistory(handle.header, events, handle.inheritedEventCount)
          if (handle.inheritedEventCount > 0 && (!handle.header.parentSession || !ids.has(handle.header.parentSession))) this.issue(handle.id, 'lineage')
        } finally { await handle.close() }
        this.state.inherited += projected.inherited; this.state.auxiliary += projected.auxiliary
        for (const issue of projected.issues) { this.state.unreadable++; this.issue(issue.sessionId, issue.reason) }
        for (const attempt of projected.attempts) {
          if (seen.has(attempt.historyId)) continue
          seen.add(attempt.historyId)
          if (this.attempts.length >= this.limits.historyMaxRequests) { this.issue('', 'limit'); this.state.phase = 'failed'; return }
          this.attempts.push(attempt)
          this.state.candidates++
          if (!attempt.usage) this.state.missing++
          this.state.firstAt = Math.min(this.state.firstAt ?? attempt.startedAt, attempt.startedAt)
          this.state.lastAt = Math.max(this.state.lastAt ?? attempt.updatedAt, attempt.updatedAt)
          const decision = this.ledger.historyDecision(attempt, this.limits.historyMatchToleranceMs)
          if (decision.kind === 'existing' || decision.kind === 'link') this.state.existing++
          else if (decision.kind === 'conflict') { this.state.conflicts++; this.issue(attempt.sessionId!, 'overlap') }
          else { const u = attempt.usage; this.state.inputTokens += u ? u.inputTokens + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0) : 0; this.state.outputTokens += u?.outputTokens ?? 0 }
        }
      } catch {
        signal.throwIfAborted(); this.state.unreadable++; this.issue(session.header.id, 'read')
      }
      this.state.scanned++; await setImmediate(undefined, { signal })
    }
    this.state.phase = 'ready'
  }
  private async import(signal: AbortSignal): Promise<void> {
    this.state.phase = 'importing'; this.state.processed = 0; this.state.imported = 0; this.state.existing = 0; this.state.conflicts = 0; this.state.inputTokens = 0; this.state.outputTokens = 0
    this.state.issues = this.state.issues.filter(i => i.reason !== 'overlap')
    for (const attempt of this.attempts) {
      signal.throwIfAborted()
      const result = this.ledger.importHistory(attempt, this.limits.historyMatchToleranceMs)
      if (result === 'insert') { this.state.imported++; const u = attempt.usage; this.state.inputTokens += u ? u.inputTokens + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0) : 0; this.state.outputTokens += u?.outputTokens ?? 0 }
      else if (result === 'conflict') { this.state.conflicts++; this.issue(attempt.sessionId!, 'overlap') }
      else this.state.existing++
      this.state.processed++; await setImmediate(undefined, { signal })
    }
    this.attempts = []; this.state.phase = 'complete'
  }
  async detach(): Promise<void> { this.abort?.abort(); await this.job; this.source = null; this.attempts = []; this.state.phase = 'unavailable' }
}

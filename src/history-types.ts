/** Content-free history preview and progress exposed to the settings page. */
import { z } from 'zod'
import type { Attempt } from './types.js'
export interface HistoricalAttempt extends Attempt { historyId: string; fingerprint: string }
const count = z.number().int().nonnegative()
export const historyStateSchema = z.object({
  phase: z.enum(['unavailable', 'idle', 'scanning', 'ready', 'importing', 'complete', 'cancelled', 'failed']),
  sessions: count, scanned: count, candidates: count, processed: count,
  imported: count, existing: count, conflicts: count, missing: count, unreadable: count,
  inherited: count, auxiliary: count, inputTokens: count, outputTokens: count,
  firstAt: count.nullable(), lastAt: count.nullable(),
  issues: z.array(z.object({ sessionId: z.string(), reason: z.enum(['read', 'route', 'usage', 'overlap', 'limit', 'list', 'write', 'lineage', 'identity']) })),
})
export type HistoryState = z.infer<typeof historyStateSchema>
export const historyActionSchema = z.object({ action: z.enum(['status', 'scan', 'import', 'cancel']) }).strict()
export const emptyHistory = (phase: HistoryState['phase']): HistoryState => ({ phase, sessions: 0, scanned: 0, candidates: 0, processed: 0, imported: 0, existing: 0, conflicts: 0, missing: 0, unreadable: 0, inherited: 0, auxiliary: 0, inputTokens: 0, outputTokens: 0, firstAt: null, lastAt: null, issues: [] })

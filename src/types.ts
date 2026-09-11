/** Wire validation and accounting vocabulary shared by the host and settings page. */
import { z } from 'zod'

export const sourceSchema = z.enum(['online', 'offline', 'unclassified'])
export type Source = z.infer<typeof sourceSchema>
export const ruleSchema = z.object({ provider: z.string().min(1), model: z.string().min(1).optional(), source: sourceSchema }).strict()
export type Rule = z.infer<typeof ruleSchema>
export const querySchema = z.object({
  from: z.number().int().nonnegative().optional(),
  to: z.number().int().nonnegative().optional(),
  utcOffsetMinutes: z.number().int().min(-840).max(840).default(0),
  source: sourceSchema.optional(),
  provider: z.string().min(1).optional(), model: z.string().min(1).optional(),
}).strict().refine(q => q.from === undefined || q.to === undefined || q.from < q.to, 'from must precede to')
export type Query = z.infer<typeof querySchema>
export const classificationSchema = ruleSchema.required()
const count = z.number().int().nonnegative().safe()
export const usageSchema = z.object({
  inputTokens: count, outputTokens: count, cacheReadTokens: count.optional(),
  cacheWriteTokens: count.optional(), reasoningTokens: count.optional(), totalTokens: count.optional(),
})
export type Usage = z.infer<typeof usageSchema>
export const totalsSchema = z.object({
  requests: count, reportedRequests: count, missingRequests: count, openRequests: count,
  failedRequests: count, invalidRequests: count,
  uncachedInputTokens: count, cacheReadTokens: count, cacheWriteTokens: count,
  inputTokens: count, outputTokens: count, totalTokens: count, reasoningTokens: count,
  cacheReadReports: count, cacheWriteReports: count, reasoningReports: count,
})
export type Totals = z.infer<typeof totalsSchema>
export const reportSchema = z.object({
  createdAt: count, trackingSince: count, firstRequestAt: count.nullable(), lastRequestAt: count.nullable(),
  totals: totalsSchema,
  sources: z.array(z.object({ source: sourceSchema, totals: totalsSchema })),
  models: z.array(z.object({ provider: z.string(), model: z.string(), source: sourceSchema, totals: totalsSchema })),
  days: z.array(z.object({ day: z.string(), source: sourceSchema, totals: totalsSchema })),
  purposes: z.array(z.object({ purpose: z.string(), totals: totalsSchema })),
  storageError: z.boolean(),
})
export type Report = z.infer<typeof reportSchema>

/** A single observed LLM stream; content and credentials are deliberately absent. */
export interface Attempt {
  id: string
  startedAt: number
  updatedAt: number
  provider: string
  model: string
  sessionId: string | null
  purpose: string
  status: string
  usage: Usage | null
  invalidUsage: boolean
}

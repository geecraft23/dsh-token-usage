/** Deployment choices for local accounting. */
import Schema from '@deepseek-ai/schemastery'
import { z } from 'zod'
import { ruleSchema } from './types.js'

export const configSchema = z.object({
  databasePath: z.string().min(1).optional(),
  rules: z.array(ruleSchema.extend({ source: z.enum(['online', 'offline', 'unclassified', 'local', 'cloud']).transform(value => value === 'local' ? 'offline' as const : value === 'cloud' ? 'online' as const : value) })).default([]),
  historyMaxSessions: z.number().int().min(1).max(100000).default(10000),
  historyMaxRequests: z.number().int().min(1).max(1000000).default(100000),
  historyMatchToleranceMs: z.number().int().min(0).max(5000).default(100),
  busyTimeoutMs: z.number().int().min(0).max(60000).default(1000),
}).strict()
export type Config = z.input<typeof configSchema>
export const Config: Schema<Config> = Schema.object({
  databasePath: Schema.string().description('Absolute SQLite path; default: $DSH_HOME/token-usage/usage.sqlite'),
  rules: Schema.array(Schema.object({
    provider: Schema.string().required(), model: Schema.string(),
    source: Schema.union(['local', 'cloud', 'unclassified', 'online', 'offline']).required(),
  })).default([]),
  historyMaxSessions: Schema.number().min(1).max(100000).default(10000),
  historyMaxRequests: Schema.number().min(1).max(1000000).default(100000),
  historyMatchToleranceMs: Schema.number().min(0).max(5000).default(100),
  busyTimeoutMs: Schema.number().min(0).max(60000).default(1000),
}) as unknown as Schema<Config>

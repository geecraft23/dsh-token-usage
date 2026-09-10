/** Deployment choices for local accounting. */
import Schema from '@deepseek-ai/schemastery'
import { z } from 'zod'
import { ruleSchema } from './types.js'

export const configSchema = z.object({
  databasePath: z.string().min(1).optional(),
  rules: z.array(ruleSchema).default([]),
  busyTimeoutMs: z.number().int().min(0).max(60000).default(1000),
}).strict()
export type Config = z.input<typeof configSchema>
export const Config: Schema<Config> = Schema.object({
  databasePath: Schema.string().description('Absolute SQLite path; default: $DSH_HOME/token-usage/usage.sqlite'),
  rules: Schema.array(Schema.object({
    provider: Schema.string().required(), model: Schema.string(),
    source: Schema.union(['online', 'offline', 'unclassified']).required(),
  })).default([]),
  busyTimeoutMs: Schema.number().min(0).max(60000).default(1000),
}) as unknown as Schema<Config>

/** Token accounting plugin for DSH 0.1.5-rc.1 and its public LLM/Connection extension points. */
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { configSchema, type Config } from './config.js'
import { capture } from './capture.js'
import { Ledger } from './ledger.js'
import { classificationSchema, querySchema } from './types.js'

export { Config } from './config.js'
export const name = 'token-usage'
export const inject = ['llm']

/** Mount a durable collector and, when available, authenticated settings-page RPC. */
export function apply(ctx: Context, input: Config = {}): void {
  const config = configSchema.parse(input)
  const path = config.databasePath ?? join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'token-usage', 'usage.sqlite')
  const ledger = new Ledger(path, config.rules, config.busyTimeoutMs)
  let disposed = false
  let storageError = false
  const pending = new Map<string, Parameters<Ledger['put']>[0]>()
  const sink = { put(attempt: Parameters<Ledger['put']>[0]): void {
    if (disposed) return
    pending.set(attempt.id, { ...attempt })
    try {
      for (const [id, row] of pending) { ledger.put(row); pending.delete(id) }
    } catch {
      // Accounting I/O must not reject an otherwise usable model stream.
      if (!storageError) ctx.logger.error('token-usage: ledger write failed; totals may be incomplete until a later write succeeds')
      storageError = true
    }
    if (pending.size === 0) storageError = false
  } }
  ctx.on('llm/stream', (options, next) => capture(options, next, sink))
  ctx.inject(['connection'], child => {
    for (const endpoint of ['report', 'classify']) {
      child.effect(() => child.connection.fetch.register({
        path: `/api/token-usage/${endpoint}`, methods: ['POST'], requestBody: 'buffered',
        fetch: async request => {
          try {
            const payload: unknown = await request.json()
            if (endpoint === 'report') return Response.json(ledger.report(querySchema.parse(payload), storageError), { headers: { 'Cache-Control': 'no-store' } })
            const rule = classificationSchema.parse(payload)
            ledger.classify(rule.provider, rule.model, rule.source)
            return Response.json(null, { headers: { 'Cache-Control': 'no-store' } })
          } catch {
            return Response.json({ error: 'Token usage operation failed; check the request and local ledger' }, { status: 400 })
          }
        },
      }), `token-usage ${endpoint} endpoint`)
    }
  })
  ctx.effect(() => () => { disposed = true; ledger.close() }, 'token-usage ledger lifetime')
}

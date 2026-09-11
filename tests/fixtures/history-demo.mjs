/** Synthetic history for isolated DSH Profile screenshots and import verification. */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
export const name = 'token-usage-history-demo'
export const inject = ['sessionPersistence']
export function apply(ctx) {
  if (process.env.TOKEN_USAGE_DEMO !== '1' || !process.env.DSH_HOME) throw new Error('History demo requires an explicitly isolated environment')
  void (async () => {
    for (const [index, provider, model] of [[0, 'local-server', 'Qwen'], [1, 'cloud-api', 'DeepSeek']]) {
      const id = `token-usage-demo-${index}`
      if (await ctx.sessionPersistence.stat(id)) continue
      const start = Date.now() - 60 * 86400000
      const handle = await ctx.sessionPersistence.create({ id, version: 3, createdAt: start, isSeeded: false })
      try {
        const events = Array.from({ length: 40 }, (_, seq) => {
          const time = start + seq * 86400000
          const usage = { inputTokens: 14000 + seq * 1200 + index * 5000, outputTokens: 2000 + seq * 80, cacheReadTokens: 4000 }
          return { type: 'assistant/message', surfaceOp: 'append', seq, time, data: { turn: seq, step: 0, message: { id: `${id}-${seq}`, role: 'assistant', content: [], source: { kind: 'model', provider, model } }, usage,
            stream: [{ type: 'chunk', time, chunk: { type: 'usage', usage } }, { type: 'chunk', time, chunk: { type: 'finish', reason: { kind: 'stop' } } }] } }
        })
        await handle.append(events); await handle.flush()
      } finally { await handle.close() }
    }
    writeFileSync(join(process.env.DSH_HOME, 'token-history-demo-ready'), 'ready')
  })().catch(error => ctx.logger.error(error.message))
}

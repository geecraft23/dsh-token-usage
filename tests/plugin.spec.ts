import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { LlmAdapter, type StreamChunk } from '@deepseek-ai/dsh-llm'
import type { ConnectionFetchRoute } from '@deepseek-ai/dsh-client-connection'
import * as plugin from '../src/index.js'
import { reportSchema } from '../src/types.js'

class Adapter extends LlmAdapter {
  async *stream(): AsyncIterable<StreamChunk> {
    yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 20 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

it('collects through the actual 0.1.5 LlmRuntime and serves the authenticated Connection extension', async () => {
  const ctx = new Context()
  const routes = new Map<string, ConnectionFetchRoute>()
  ctx.provide('connection', { fetch: { register(route: ConnectionFetchRoute) {
    routes.set(route.path, route)
    return async () => { routes.delete(route.path) }
  } } })
  const runtime = await ctx.plugin(LlmRuntime)
  const fiber = ctx.plugin(plugin, { databasePath: ':memory:', rules: [{ provider: 'spark', source: 'offline' }] })
  await fiber
  ctx.llm.registerAdapter(['spark'], new Adapter())
  for await (const _ of ctx.llm.stream({ provider: 'spark', model: 'qwen', messages: [], purpose: 'session-title' })) { /* consume the real service stream */ }
  const response = await routes.get('/api/token-usage/report')!.fetch(new Request('http://localhost/api/token-usage/report', { method: 'POST', body: '{}' }))
  expect(response.ok).toBe(true)
  const report = reportSchema.parse(await response.json())
  expect(report.totals).toMatchObject({ requests: 1, totalTokens: 30 })
  expect(report.sources.find(r => r.source === 'offline')?.totals.outputTokens).toBe(20)
  expect(report.purposes[0]?.purpose).toBe('session-title')
  const historyRoute = routes.get('/api/token-usage/history')!
  const historyStatus = await historyRoute.fetch(new Request('http://localhost/api/token-usage/history', { method: 'POST', body: '{"action":"status"}' }))
  expect(await historyStatus.json()).toMatchObject({ phase: 'unavailable' })
  const noSource = await historyRoute.fetch(new Request('http://localhost/api/token-usage/history', { method: 'POST', body: '{"action":"scan"}' }))
  expect(noSource.status).toBe(400)
  const bad = await routes.get('/api/token-usage/classify')!.fetch(new Request('http://localhost/api/token-usage/classify', { method: 'POST', body: JSON.stringify({ provider: 'spark', model: 'qwen', source: 'bad' }) }))
  expect(bad.ok).toBe(false)
  await fiber.dispose()
  expect(routes.size).toBe(0)
  await runtime.dispose()
})

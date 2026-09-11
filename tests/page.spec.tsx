// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { UsagePage } from '../src/client/UsagePage.js'
import { zh } from '../src/client/locales.js'
import { Ledger } from '../src/ledger.js'
afterEach(cleanup)

it('shows local input and output and changes a model classification through the supplied API', async () => {
  const ledger = new Ledger(':memory:', [{ provider: 'spark', source: 'offline' }], 1000)
  ledger.put({ id: 'x', startedAt: Date.now(), updatedAt: Date.now(), provider: 'spark', model: 'qwen',
    sessionId: null, purpose: 'conversation', status: 'stop', invalidUsage: false,
    usage: { inputTokens: 100, outputTokens: 75 } })
  const call = vi.fn(async (endpoint: string, payload: unknown) => {
    if (endpoint.endsWith('classify')) { ledger.classify('spark', 'qwen', 'online'); return null }
    return ledger.report({ utcOffsetMinutes: 480 })
  })
  render(<UsagePage t={key => zh[key]} call={call} />)
  await screen.findByText('按部署位置')
  expect(screen.getByText('qwen')).toBeTruthy()
  fireEvent.change(screen.getByRole('combobox', { name: 'spark / qwen 部署位置' }), { target: { value: 'online' } })
  await waitFor(() => expect(call).toHaveBeenCalledWith('classify', { provider: 'spark', model: 'qwen', source: 'online' }))
  await screen.findByText('已保存')
  ledger.close()
})

it('presents a load failure instead of fictional zero totals', async () => {
  render(<UsagePage t={key => zh[key]} call={async () => { throw new Error('offline') }} />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('累计 Token')).toBeNull()
})

it('keeps deployment and input/output independent and filters exact provider-model routes', async () => {
  const ledger = new Ledger(':memory:', [{ provider: 'local', source: 'offline' }, { provider: 'cloud', source: 'online' }], 1000)
  for (const [provider, inputTokens, outputTokens] of [['local', 100, 10], ['cloud', 200, 20]] as const) ledger.put({ id: provider, startedAt: Date.now(), updatedAt: Date.now(), provider, model: 'same-model', sessionId: null, purpose: 'conversation', status: 'stop', invalidUsage: false, usage: { inputTokens, outputTokens } })
  const call = vi.fn(async (_: string, payload: unknown) => ledger.report(payload as import('../src/types.js').Query))
  render(<UsagePage t={key => zh[key]} call={call} />)
  await screen.findByText('按部署位置')
  expect(screen.queryByText('线下累计生成')).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: '部署位置' }), { target: { value: 'offline' } })
  await waitFor(() => expect(call).toHaveBeenCalledWith('report', expect.objectContaining({ source: 'offline' }), expect.any(AbortSignal)))
  await screen.findByText('按部署位置')
  fireEvent.change(screen.getByRole('combobox', { name: '模型' }), { target: { value: JSON.stringify({ provider: 'cloud', model: 'same-model' }) } })
  await screen.findByText('这个时间范围内还没有模型请求。')
  fireEvent.change(screen.getByRole('combobox', { name: '部署位置' }), { target: { value: 'online' } })
  await screen.findByText('按部署位置')
  expect(screen.getAllByText('220').length).toBeGreaterThan(0)
  expect(screen.queryByText('110')).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Token 指标' }), { target: { value: 'outputTokens' } })
  expect(screen.getAllByRole('button').some(b => b.getAttribute('aria-label')?.includes('输出 20'))).toBe(true)
  ledger.close()
})

it('exports local/cloud deployment names and keeps exact input/output counters', async () => {
  const { exportUsage } = await import('../src/client/UsagePage.js')
  const ledger = new Ledger(':memory:', [{ provider: 'spark', source: 'offline' }], 1000)
  ledger.put({ id: 'export', startedAt: Date.now(), updatedAt: Date.now(), provider: 'spark', model: 'qwen', sessionId: null, purpose: 'conversation', status: 'stop', invalidUsage: false, usage: { inputTokens: 100, outputTokens: 25, cacheReadTokens: 50 } })
  const data = JSON.parse(exportUsage({ utcOffsetMinutes: 0, source: 'offline', provider: 'spark', model: 'qwen' }, ledger.report({ utcOffsetMinutes: 0 })))
  expect(data.query.source).toBe('local')
  expect(data.report.models[0].source).toBe('local')
  expect(data.report.totals).toMatchObject({ inputTokens: 150, outputTokens: 25, totalTokens: 175 })
  ledger.close()
})

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { UsagePage } from '../src/client/UsagePage.js'
import { zh } from '../src/client/locales.js'
import { Ledger } from '../src/ledger.js'
afterEach(cleanup)

it('shows offline generation and changes a model classification through the supplied API', async () => {
  const ledger = new Ledger(':memory:', [{ provider: 'spark', source: 'offline' }], 1000)
  ledger.put({ id: 'x', startedAt: Date.now(), updatedAt: Date.now(), provider: 'spark', model: 'qwen',
    sessionId: null, purpose: 'conversation', status: 'stop', invalidUsage: false,
    usage: { inputTokens: 100, outputTokens: 75 } })
  const call = vi.fn(async (endpoint: string, payload: unknown) => {
    if (endpoint.endsWith('classify')) { ledger.classify('spark', 'qwen', 'online'); return null }
    return ledger.report({ utcOffsetMinutes: 480 })
  })
  render(<UsagePage t={key => zh[key]} call={call} />)
  await screen.findByText('线下累计生成')
  expect(screen.getByText('qwen')).toBeTruthy()
  fireEvent.change(screen.getByRole('combobox', { name: 'spark / qwen 来源' }), { target: { value: 'online' } })
  await waitFor(() => expect(call).toHaveBeenCalledWith('classify', { provider: 'spark', model: 'qwen', source: 'online' }))
  await screen.findByText('已保存')
  ledger.close()
})

it('presents a load failure instead of fictional zero totals', async () => {
  render(<UsagePage t={key => zh[key]} call={async () => { throw new Error('offline') }} />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('累计 Token')).toBeNull()
})

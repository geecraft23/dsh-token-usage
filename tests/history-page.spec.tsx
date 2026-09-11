// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HistoryPanel } from '../src/client/HistoryPanel.js'
import { emptyHistory } from '../src/history-types.js'
import { zh } from '../src/client/locales.js'
afterEach(cleanup)
it('shows a preview before import and reports unresolved overlaps', async () => {
  const imported = vi.fn(), allTime = vi.fn()
  const call = vi.fn(async (_: string, payload: unknown) => {
    const { action } = payload as { action: string }
    return { ...emptyHistory(action === 'status' ? 'idle' : action === 'scan' ? 'ready' : 'complete'), candidates: action === 'status' ? 0 : 3, conflicts: action === 'status' ? 0 : 1, imported: action === 'import' ? 2 : 0, inputTokens: 3000, outputTokens: 500 }
  })
  render(<HistoryPanel t={key => zh[key]} call={call} onImported={imported} onAllTime={allTime} />)
  fireEvent.click(await screen.findByRole('button', { name: '扫描历史' }))
  expect(await screen.findByText('预览已就绪，尚未写入账本')).toBeTruthy()
  expect(screen.getByText('重叠待核对 1')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '导入可恢复记录' }))
  expect(await screen.findByText('导入完成')).toBeTruthy()
  expect(imported).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '查看全部时间' }))
  expect(allTime).toHaveBeenCalled()
})

it('shows the reason when listing fails before any candidates exist', async () => {
  const call = vi.fn(async () => ({ ...emptyHistory('failed'), issues: [{ sessionId: '', reason: 'list' }] }))
  render(<HistoryPanel t={key => zh[key]} call={call} onImported={() => {}} onAllTime={() => {}} />)
  expect(await screen.findByText(/会话列表读取失败/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: '导入可恢复记录' })).toBeNull()
})

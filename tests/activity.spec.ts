import { expect, it } from 'vitest'
import { calendar, insights, series, type Day } from '../src/client/activity-data.js'
const row = (day: string, totalTokens = 10): Day => ({ day, inputTokens: totalTokens - 2, outputTokens: 2, totalTokens, requests: 1 })
it('breaks streaks at missing calendar days and combines consecutive days across year boundaries', () => {
  expect(insights([row('2025-12-31'), row('2026-01-01'), row('2026-01-03', 30)])).toEqual({ peak: 30, active: 3, longest: 2 })
})
it('uses leap days, zero-activity days and Monday padding without losing fixed-offset dates', () => {
  const cells = calendar([row('2024-02-29')], { from: Date.parse('2024-02-27T16:00Z'), to: Date.parse('2024-03-01T16:00Z'), utcOffsetMinutes: 480 }, Date.parse('2024-03-10T00:00Z'))
  expect(cells.slice(0, 2)).toEqual([null, null])
  expect(cells.filter(Boolean).map(r => r?.day)).toEqual(['2024-02-28', '2024-02-29', '2024-03-01'])
  expect(cells.find(r => r?.day === '2024-03-01')?.requests).toBe(0)
})
it('limits all-time calendar to a year while retaining older rows in totals and trends', () => {
  const rows = [row('2020-01-01'), row('2026-09-11')]
  expect(calendar(rows, { utcOffsetMinutes: 0 }, Date.parse('2026-09-11T12:00Z')).filter(Boolean)).toHaveLength(366)
  expect(series(rows, 'outputTokens', 'cumulative').at(-1)?.value).toBe(4)
})
it('keeps empty weeks between observations and accumulates the selected token direction', () => {
  const rows = [row('2026-09-01', 100), row('2026-09-22', 20)]
  expect(series(rows, 'outputTokens', 'weekly').map(p => p.value)).toEqual([2, 0, 0, 2])
  expect(series(rows, 'inputTokens', 'cumulative').map(p => p.value)).toEqual([98, 116])
})

it('accepts local/cloud config while preserving existing online/offline rules', async () => {
  const { configSchema } = await import('../src/config.js')
  const rules = configSchema.parse({ rules: [{ provider: 'a', source: 'local' }, { provider: 'b', source: 'cloud' }, { provider: 'c', source: 'offline' }] }).rules
  expect(rules.map(r => r.source)).toEqual(['offline', 'online', 'offline'])
})

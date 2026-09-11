/** Calendar calculations use the same fixed UTC offset as ledger reports. */
import type { Query, Report } from '../types.js'
export type Metric = 'totalTokens' | 'inputTokens' | 'outputTokens'
export interface Day { day: string; inputTokens: number; outputTokens: number; totalTokens: number; requests: number }
const DAY = 86400000
export const dayKey = (timestamp: number): string => new Date(timestamp).toISOString().slice(0, 10)
export const dayTime = (day: string): number => Date.parse(`${day}T00:00:00Z`)

/** Combine deployment rows into one measured row per calendar day. */
export function dailyRows(report: Report): Day[] {
  const map = new Map<string, Day>()
  for (const row of report.days) {
    const value = map.get(row.day) ?? { day: row.day, inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 }
    for (const key of ['inputTokens', 'outputTokens', 'totalTokens', 'requests'] as const) value[key] += row.totals[key]
    map.set(row.day, value)
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day))
}

/** Activity means an observed request, including requests with unknown token usage. */
export function insights(rows: Day[]) {
  let longest = 0, run = 0, previous = -Infinity
  for (const row of rows.filter(r => r.requests > 0)) {
    const time = dayTime(row.day); run = time - previous === DAY ? run + 1 : 1
    longest = Math.max(longest, run); previous = time
  }
  return { peak: Math.max(0, ...rows.map(r => r.totalTokens)), active: rows.filter(r => r.requests > 0).length, longest }
}

/** Render at most 366 calendar days; nulls pad Monday-first weeks outside the range. */
export function calendar(rows: Day[], query: Query, now: number): (Day | null)[] {
  const offset = query.utcOffsetMinutes * 60000
  const end = dayTime(dayKey(Math.min(now, query.to === undefined ? now : query.to - 1) + offset))
  const earliest = query.from === undefined ? end - 365 * DAY : dayTime(dayKey(query.from + offset))
  const start = Math.max(earliest, end - 365 * DAY)
  if (start > end) return []
  const map = new Map(rows.map(r => [r.day, r]))
  const result: (Day | null)[] = Array.from({ length: (new Date(start).getUTCDay() + 6) % 7 }, () => null)
  for (let time = start; time <= end; time += DAY) {
    const day = dayKey(time); result.push(map.get(day) ?? { day, inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 })
  }
  while (result.length % 7) result.push(null)
  return result
}

/** Group into Monday-start weeks or running totals, retaining chronological labels. */
export function series(rows: Day[], metric: Metric, mode: 'weekly' | 'cumulative'): { label: string; value: number }[] {
  if (mode === 'cumulative') { let sum = 0; return rows.map(r => ({ label: r.day, value: sum += r[metric] })) }
  const weeks = new Map<string, number>()
  for (const r of rows) { const time = dayTime(r.day); const monday = dayKey(time - (new Date(time).getUTCDay() + 6) % 7 * DAY); weeks.set(monday, (weeks.get(monday) ?? 0) + r[metric]) }
  if (weeks.size) {
    const keys = [...weeks.keys()]; const end = dayTime(keys.at(-1)!)
    for (let time = dayTime(keys[0]!); time <= end; time += 7 * DAY) { const key = dayKey(time); if (!weeks.has(key)) weeks.set(key, 0) }
  }
  return [...weeks].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }))
}

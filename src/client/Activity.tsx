/** Accessible activity calendar with independent input/output and time-view controls. */
import { useState } from 'react'
import type { Query, Report } from '../types.js'
import type { Translate } from './locales.js'
import { calendar, dailyRows, series, dayTime, type Day, type Metric } from './activity-data.js'
const format = (n: number) => n.toLocaleString()
export function Activity({ report, query, t }: { report: Report; query: Query; t: Translate }) {
  const [mode, setMode] = useState<'daily' | 'weekly' | 'cumulative'>('daily')
  const [metric, setMetric] = useState<Metric>('totalTokens')
  const [selected, setSelected] = useState<string | null>(null)
  const rows = dailyRows(report), cells = calendar(rows, query, report.createdAt)
  const selection = cells.find((d): d is Day => d?.day === selected)
  const max = Math.max(1, ...cells.map(d => d?.[metric] ?? 0))
  const points = series(rows, metric, mode === 'weekly' ? 'weekly' : 'cumulative')
  const peak = Math.max(1, ...points.map(p => p.value))
  const first = cells.find(Boolean)?.day, last = cells.findLast(Boolean)?.day
  const label = metric === 'inputTokens' ? t('input') : metric === 'outputTokens' ? t('output') : t('totalColumn')
  return <div className="activity">
    <div className="section-heading"><h3>{t('activity')}</h3><select aria-label={t('metric')} value={metric} onChange={e => setMetric(e.target.value as Metric)}>
      <option value="totalTokens">{t('totalColumn')}</option><option value="inputTokens">{t('input')}</option><option value="outputTokens">{t('output')}</option>
    </select></div>
    <div className="view-tabs" role="group" aria-label={t('activity')}>{(['daily', 'weekly', 'cumulative'] as const).map(key => <button key={key} aria-pressed={mode === key} onClick={() => setMode(key)}>{t(key)}</button>)}</div>
    {mode === 'daily' ? <>
      <div className="calendar-scroll"><div className="calendar" style={{ gridTemplateColumns: `repeat(${Math.max(1, cells.length / 7)}, 8px)` }}>
        {cells.map((day, i) => day ? <button key={day.day} className={`day level-${day[metric] === 0 ? 0 : Math.min(4, Math.ceil(day[metric] / max * 4))}`} aria-label={`${day.day} · ${label} ${format(day[metric])} · ${t('requests')} ${day.requests}`} title={`${day.day}\n${t('input')}: ${format(day.inputTokens)}\n${t('output')}: ${format(day.outputTokens)}\n${t('requests')}: ${day.requests}`} aria-pressed={selected === day.day} onClick={() => setSelected(day.day)} /> : <span key={`pad-${i}`} />)}
      </div></div>
      <div className="axis"><span>{first}</span><span>{last !== first ? last : null}</span></div>
      <div className="heat-legend"><span>{t('less')}</span>{[0, 1, 2, 3, 4].map(level => <i key={level} className={`level-${level}`} />)}<span>{t('more')}</span></div>
      <p className="day-detail" aria-live="polite">{selection ? `${selection.day} · ${t('input')} ${format(selection.inputTokens)} · ${t('output')} ${format(selection.outputTokens)} · ${t('requests')} ${selection.requests}` : t('noSelection')}</p>
      <p className="muted">{t('heatHint')}</p>
    </> : <>
      <div className="plot" role="img" aria-label={`${t(mode)} · ${label}`}>
        <svg viewBox="0 0 600 130" preserveAspectRatio="none">
          {mode === 'weekly' ? points.map((p, i) => <rect key={p.label} x={i * 600 / Math.max(1, points.length) + 2} y={125 - p.value / peak * 115} width={Math.max(1, 600 / Math.max(1, points.length) - 4)} height={p.value / peak * 115} rx="2"><title>{p.label}: {format(p.value)}</title></rect>) : <polyline points={points.map((p, i) => `${points.length === 1 ? 300 : (dayTime(p.label) - dayTime(points[0]!.label)) / Math.max(1, dayTime(points.at(-1)!.label) - dayTime(points[0]!.label)) * 596 + 2},${125 - p.value / peak * 115}`).join(' ')} fill="none" strokeWidth="2" />}
          {mode === 'cumulative' && points.length === 1 && <circle cx="300" cy="10" r="3" />}
        </svg>
      </div><div className="axis"><span>{points[0]?.label}</span><span>{points.at(-1)?.label}</span></div>
      <details><summary>{t('dataDetails')}</summary>{points.map(p => <div key={p.label} className="series-row"><span>{p.label}</span><span>{format(p.value)}</span></div>)}</details>
    </>}
  </div>
}

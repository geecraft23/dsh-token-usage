/** Human-facing accounting dashboard in DSH Settings. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { reportSchema, type Query, type Report, type Source, type Totals } from '../types.js'
import type { Translate } from './locales.js'
import { css } from './styles.js'

export interface UsagePageProps {
  t: Translate
  call: (endpoint: string, payload: unknown, signal?: AbortSignal) => Promise<unknown>
}
const colors: Record<Source, string> = { online: '#829cf5', offline: '#36b79b', unclassified: '#9999a7' }
const number = (value: number): string => value.toLocaleString()
const dateValue = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function makeQuery(range: string, source: string, from: string, to: string): Query {
  const query: Query = { utcOffsetMinutes: -new Date().getTimezoneOffset() }
  if (source !== 'all') query.source = source as Source
  if (range === 'custom') {
    query.from = new Date(`${from}T00:00:00`).getTime()
    const end = new Date(`${to}T00:00:00`); end.setDate(end.getDate() + 1)
    query.to = end.getTime()
  } else if (range !== 'allTime') {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (range === 'week' ? 6 : 29))
    query.from = start.getTime()
  }
  return query
}

function Trend({ report, t }: { report: Report; t: Translate }) {
  const grouped = new Map<string, Record<Source, number>>()
  for (const row of report.days) {
    const values = grouped.get(row.day) ?? { online: 0, offline: 0, unclassified: 0 }
    values[row.source] = row.totals.totalTokens; grouped.set(row.day, values)
  }
  const rows = [...grouped].sort(([a], [b]) => a.localeCompare(b))
  const maximum = Math.max(1, ...rows.map(([, v]) => v.online + v.offline + v.unclassified))
  return <>
    <h3>{t('trend')}</h3>
    <div className="legend">{Object.keys(colors).map(key => <span key={key}><i className="dot" style={{ background: colors[key as Source] }} />{t(key as Source)}</span>)}</div>
    <div className="chart" role="img" aria-label={t('trend')}>
      {rows.map(([day, values]) => <div className="bar" key={day} title={`${day}\n${Object.entries(values).map(([k, v]) => `${t(k as Source)}: ${number(v)}`).join('\n')}`}>
        {Object.entries(values).map(([key, value]) => <span key={key} style={{ height: `${value / maximum * 100}%`, background: colors[key as Source] }} />)}
      </div>)}
    </div>
    <div className="axis"><span>{rows[0]?.[0]}</span><span>{rows.at(-1)?.[0]}</span></div>
  </>
}

/** Render cumulative counters with explicit unknown-usage and classification states. */
export function UsagePage({ t, call }: UsagePageProps) {
  const [range, setRange] = useState('month'), [source, setSource] = useState('all')
  const [from, setFrom] = useState(dateValue(new Date())), [to, setTo] = useState(dateValue(new Date()))
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false), [loading, setLoading] = useState(false)
  const request = useRef<AbortController | null>(null)
  const load = useCallback(async () => {
    request.current?.abort()
    const abort = new AbortController(); request.current = abort
    setLoading(true)
    try {
      const value = await call('report', makeQuery(range, source, from, to), abort.signal)
      if (!abort.signal.aborted) { setReport(reportSchema.parse(value)); setError(null) }
    } catch {
      if (!abort.signal.aborted) setError(t('error'))
    } finally { if (!abort.signal.aborted) setLoading(false) }
  }, [call, range, source, from, to, t])
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (!document.hidden) void load() }, 15000)
    return () => { request.current?.abort(); window.clearInterval(timer) }
  }, [load])
  const classify = async (provider: string, model: string, category: Source) => {
    setSaving(true); setSaved(false)
    try { await call('classify', { provider, model, source: category }); await load(); setSaved(true) }
    catch { setError(t('saveError')) }
    finally { setSaving(false) }
  }
  const download = () => {
    const blob = new Blob([JSON.stringify({ query: makeQuery(range, source, from, to), report }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = `dsh-token-usage-${dateValue(new Date())}.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const sourceTotals = (key: Source): Totals | undefined => report?.sources.find(row => row.source === key)?.totals
  return <section className="dsh-usage">
    <style>{css}</style>
    <h2>{t('title')}</h2><p className="muted">{t('subtitle')}</p>
    <div className="toolbar">
      <select aria-label={t('from')} value={range} onChange={e => { setReport(null); setRange(e.target.value) }}>
        {(['week', 'month', 'allTime', 'custom'] as const).map(key => <option key={key} value={key}>{t(key)}</option>)}
      </select>
      <select aria-label={t('source')} value={source} onChange={e => { setReport(null); setSource(e.target.value) }}>
        <option value="all">{t('all')}</option>{Object.keys(colors).map(key => <option key={key} value={key}>{t(key as Source)}</option>)}
      </select>
      <button onClick={() => void load()} disabled={loading}>{t('refresh')}</button>
      <button onClick={download} disabled={!report}>{t('export')}</button>
      {saved && <span className="status" role="status">{t('saved')}</span>}
    </div>
    {range === 'custom' && <div className="dates"><label>{t('from')} <input type="date" value={from} onChange={e => { setReport(null); setFrom(e.target.value) }} /></label><label>{t('to')} <input type="date" value={to} onChange={e => { setReport(null); setTo(e.target.value) }} /></label></div>}
    {error && <p className="notice" role="alert">{error}</p>}
    {report?.storageError && <p className="notice" role="alert">{t('storageError')}</p>}
    {!report && !error && <p className="empty">{t('loading')}</p>}
    {report && <>
      <div className="cards">
        <div className="card"><label>{t('total')}</label><div className="metric">{number(report.totals.totalTokens)}</div><div className="submetric">{t('input')} {number(report.totals.inputTokens)} · {t('output')} {number(report.totals.outputTokens)}</div></div>
        <div className="card offline"><label>{t('offlineOutput')}</label><div className="metric">{number(sourceTotals('offline')?.outputTokens ?? 0)}</div><div className="submetric">{t('total')} {number(sourceTotals('offline')?.totalTokens ?? 0)}</div></div>
        <div className="card"><label>{t('onlineTotal')}</label><div className="metric">{number(sourceTotals('online')?.totalTokens ?? 0)}</div><div className="submetric">{t('output')} {number(sourceTotals('online')?.outputTokens ?? 0)}</div></div>
      </div>
      {report.totals.requests === 0 ? <p className="empty">{t('empty')}</p> : <>
        <Trend report={report} t={t} />
        <h3>{t('models')}</h3><p className="muted">{t('classifyHint')}</p>
        <div className="table-wrap"><table><thead><tr><th>{t('model')}</th><th>{t('source')}</th><th className="num">{t('input')}</th><th className="num">{t('output')}</th><th className="num">{t('cached')}</th><th className="num">{t('requests')}</th></tr></thead><tbody>
          {report.models.map(row => <tr key={JSON.stringify([row.provider, row.model])}>
            <td>{row.model}<div className="muted">{row.provider}</div></td>
            <td><select aria-label={`${row.provider} / ${row.model} ${t('source')}`} disabled={saving} value={row.source} onChange={e => void classify(row.provider, row.model, e.target.value as Source)}>
              {Object.keys(colors).map(key => <option key={key} value={key}>{t(key as Source)}</option>)}
            </select></td><td className="num">{number(row.totals.inputTokens)}</td><td className="num">{number(row.totals.outputTokens)}</td><td className="num">{row.totals.cacheReadReports === 0 ? '—' : number(row.totals.cacheReadTokens)}</td><td className="num">{number(row.totals.requests)}</td>
          </tr>)}
        </tbody></table></div>
      </>}
      <div className="coverage"><span>{number(report.totals.requests)} {t('requests')}</span><span>{number(report.totals.reportedRequests)} {t('reported')}</span><span>{number(report.totals.missingRequests)} {t('missing')}</span><span>{number(report.totals.openRequests)} {t('open')}</span><span>{number(report.totals.failedRequests)} {t('failed')}</span>{report.totals.invalidRequests > 0 && <span>{number(report.totals.invalidRequests)} {t('invalid')}</span>}</div>
      <p className="muted">{t('since')} {new Date(report.trackingSince).toLocaleString()} · {t('timezone')} UTC{new Date().getTimezoneOffset() > 0 ? '−' : '+'}{Math.abs(new Date().getTimezoneOffset()) / 60}</p>
      <details><summary>{t('details')}</summary><p>{t('accounting')}</p><p>{t('missingHint')}</p><p>{t('scope')}</p><p>{t('auxiliary')}</p><p>{t('cacheWrite')} {report.totals.cacheWriteReports ? number(report.totals.cacheWriteTokens) : '—'} · {t('reasoning')} {report.totals.reasoningReports ? number(report.totals.reasoningTokens) : '—'}</p></details>
    </>}
  </section>
}

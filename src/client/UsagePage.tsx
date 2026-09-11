/** Human-facing accounting dashboard in DSH Settings. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { reportSchema, type Query, type Report, type Source } from '../types.js'
import type { Translate } from './locales.js'
import { TokenValue } from './TokenValue.js'
import { Activity } from './Activity.js'
import { dailyRows, insights } from './activity-data.js'
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
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (range === 'week' ? 6 : range === 'quarter' ? 89 : 29))
    query.from = start.getTime()
  }
  return query
}

/** Export user-facing deployment names while the persisted v1 ledger keeps its original IDs. */
export function exportUsage(query: Query, report: Report): string {
  return JSON.stringify({ formatVersion: 2, query, report }, (key, value: unknown) => key === 'source' ? (value === 'offline' ? 'local' : value === 'online' ? 'cloud' : value) : value, 2)
}

/** Render cumulative counters with explicit unknown-usage and classification states. */
export function UsagePage({ t, call }: UsagePageProps) {
  const [range, setRange] = useState('quarter'), [source, setSource] = useState('all')
  const [from, setFrom] = useState(dateValue(new Date())), [to, setTo] = useState(dateValue(new Date()))
  const [route, setRoute] = useState('all')
  const [catalog, setCatalog] = useState<Report['models']>([])
  const query = (): Query => ({ ...makeQuery(range, source, from, to), ...(route === 'all' ? {} : JSON.parse(route) as { provider: string; model: string }) })
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false), [loading, setLoading] = useState(false)
  const request = useRef<AbortController | null>(null)
  const load = useCallback(async () => {
    request.current?.abort()
    const abort = new AbortController(); request.current = abort
    setLoading(true)
    try {
      const [value, all] = await Promise.all([call('report', query(), abort.signal), call('report', { utcOffsetMinutes: -new Date().getTimezoneOffset() }, abort.signal)])
      if (!abort.signal.aborted) { setReport(reportSchema.parse(value)); setCatalog(reportSchema.parse(all).models); setError(null) }
    } catch {
      if (!abort.signal.aborted) setError(t('error'))
    } finally { if (!abort.signal.aborted) setLoading(false) }
  }, [call, range, source, from, to, route, t])
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
    const blob = new Blob([exportUsage(query(), report!)], { type: 'application/json' })
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = `dsh-token-usage-${dateValue(new Date())}.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const stats = report ? insights(dailyRows(report)) : null
  return <section className="dsh-usage">
    <style>{css}</style>
    <h2>{t('activity')}</h2>
    <div className="toolbar">
      <select aria-label={t('period')} value={range} onChange={e => { setReport(null); setRange(e.target.value) }}>
        {(['month', 'quarter', 'allTime', 'custom'] as const).map(key => <option key={key} value={key}>{t(key)}</option>)}
      </select>
      <select aria-label={t('source')} value={source} onChange={e => { setReport(null); setSource(e.target.value) }}>
        <option value="all">{t('all')}</option>{Object.keys(colors).map(key => <option key={key} value={key}>{t(key as Source)}</option>)}
      </select>
      <select aria-label={t('model')} value={route} onChange={e => { setReport(null); setRoute(e.target.value) }}>
        <option value="all">{t('allModels')}</option>{catalog.map(row => <option key={JSON.stringify([row.provider, row.model])} value={JSON.stringify({ provider: row.provider, model: row.model })}>{row.model} · {row.provider}</option>)}
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
      <Activity report={report} query={query()} t={t} />
      <div className="totals-strip">
        {(['totalTokens', 'inputTokens', 'outputTokens'] as const).map((key, i) => <div key={key}><strong><TokenValue value={report.totals[key]} /></strong><span>{t((['total', 'input', 'output'] as const)[i]!)}</span></div>)}
      </div>
      <div className="insights-strip">
        <div><strong><TokenValue value={stats!.peak} /></strong><span>{t('peak')}</span></div>
        <div><strong>{stats!.active}</strong><span>{t('activeDays')}</span></div>
        <div><strong>{stats!.longest} {t('days')}</strong><span>{t('streak')}</span></div>
        <div><strong>{number(report.totals.requests)}</strong><span>{t('requests')}</span></div>
      </div>
      {report.totals.requests === 0 ? <p className="empty">{t('empty')}</p> : <>
        <h3>{t('deployments')}</h3>
        <div className="table-wrap"><table><thead><tr><th>{t('source')}</th><th className="num">{t('input')}</th><th className="num">{t('output')}</th><th className="num">{t('totalColumn')}</th></tr></thead><tbody>
          {report.sources.filter(row => source === 'all' || row.source === source).map(row => <tr key={row.source}><td><i className="dot" style={{ background: colors[row.source] }} />{t(row.source)}</td><td className="num"><TokenValue value={row.totals.inputTokens} /></td><td className="num"><TokenValue value={row.totals.outputTokens} /></td><td className="num"><TokenValue value={row.totals.totalTokens} /></td></tr>)}
        </tbody></table></div>
        <h3>{t('models')}</h3><p className="muted">{t('classifyHint')}</p>
        <div className="table-wrap"><table><thead><tr><th>{t('model')}</th><th>{t('source')}</th><th className="num">{t('input')}</th><th className="num">{t('output')}</th><th className="num">{t('totalColumn')}</th><th className="num">{t('requests')}</th></tr></thead><tbody>
          {report.models.map(row => <tr key={JSON.stringify([row.provider, row.model])}>
            <td>{row.model}<div className="muted">{row.provider}</div></td>
            <td><select aria-label={`${row.provider} / ${row.model} ${t('source')}`} disabled={saving} value={row.source} onChange={e => void classify(row.provider, row.model, e.target.value as Source)}>
              {Object.keys(colors).map(key => <option key={key} value={key}>{t(key as Source)}</option>)}
            </select></td><td className="num"><TokenValue value={row.totals.inputTokens} /></td><td className="num"><TokenValue value={row.totals.outputTokens} /></td><td className="num"><TokenValue value={row.totals.totalTokens} /></td><td className="num">{number(row.totals.requests)}</td>
          </tr>)}
        </tbody></table></div>
      </>}
      <details><summary>{t('details')}</summary><p>{t('subtitle')}</p><p>{t('periodHint')}</p><p>{t('heatHint')}</p><p>{t('localHint')}</p><div className="coverage"><span>{number(report.totals.requests)} {t('requests')}</span><span>{number(report.totals.reportedRequests)} {t('reported')}</span><span>{number(report.totals.missingRequests)} {t('missing')}</span><span>{number(report.totals.openRequests)} {t('open')}</span><span>{number(report.totals.failedRequests)} {t('failed')}</span>{report.totals.invalidRequests > 0 && <span>{number(report.totals.invalidRequests)} {t('invalid')}</span>}</div>
      <p className="muted">{t('since')} {new Date(report.trackingSince).toLocaleString()} · {t('timezone')} UTC{new Date().getTimezoneOffset() > 0 ? '−' : '+'}{Math.abs(new Date().getTimezoneOffset()) / 60}</p>
      <p>{t('accounting')}</p><p>{t('missingHint')}</p><p>{t('scope')}</p><p>{t('auxiliary')}</p><p>{t('cached')} {report.totals.cacheReadReports ? <TokenValue value={report.totals.cacheReadTokens} /> : '—'} · {t('cacheWrite')} {report.totals.cacheWriteReports ? <TokenValue value={report.totals.cacheWriteTokens} /> : '—'} · {t('reasoning')} {report.totals.reasoningReports ? <TokenValue value={report.totals.reasoningTokens} /> : '—'}</p></details>
    </>}
  </section>
}

/** User-triggered history preview; imports remain server-owned when the panel closes. */
import { useEffect, useState } from 'react'
import { historyStateSchema, type HistoryState } from '../history-types.js'
import type { UsagePageProps } from './UsagePage.js'
import { TokenValue } from './TokenValue.js'
export function HistoryPanel({ t, call, onImported, onAllTime }: UsagePageProps & { onImported: () => void; onAllTime: () => void }) {
  const [state, setState] = useState<HistoryState | null>(null)
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)
  const busy = state?.phase === 'scanning' || state?.phase === 'importing'
  const action = async (action: 'status' | 'scan' | 'import' | 'cancel') => {
    if (action !== 'status') setPending(true)
    try { setState(historyStateSchema.parse(await call('history', { action }))); setError(false) }
    catch { setError(true) }
    finally { setPending(false) }
  }
  useEffect(() => { void action('status') }, [call])
  useEffect(() => {
    if (!busy) return
    let active = true
    const timer = window.setInterval(() => {
      void call('history', { action: 'status' }).then(value => { if (active) { setState(historyStateSchema.parse(value)); setError(false) } }).catch(() => { if (active) setError(true) })
    }, 500)
    return () => { active = false; window.clearInterval(timer) }
  }, [busy, call])
  useEffect(() => { if (state?.phase === 'complete') onImported() }, [state?.phase])
  return <div className="history-panel">
    <h3>{t('historyTitle')}</h3><p className="muted">{t('historyHint')}</p>
    {error && <p role="alert">{t('historyError')}</p>}
    {state && <>
      <p role="status">{t(`history_${state.phase}`)}{busy ? ` · ${state.phase === 'scanning' ? `${state.scanned}/${state.sessions}` : `${state.processed}/${state.candidates}`}` : ''}</p>
      <div className="history-actions">
        <button disabled={pending || busy || state.phase === 'unavailable'} onClick={() => void action('scan')}>{t('historyScan')}</button>
        {state.phase === 'ready' && <button disabled={pending || state.candidates === 0} onClick={() => void action('import')}>{t('historyImport')}</button>}
        {busy && <button disabled={pending} onClick={() => void action('cancel')}>{t('historyCancel')}</button>}
        {state.phase === 'complete' && <button onClick={onAllTime}>{t('historyAllTime')}</button>}
      </div>
      {state.candidates > 0 && <>
        <div className="history-counts"><span>{t('historyCandidates')} {state.candidates}</span><span>{t('historyExisting')} {state.existing}</span><span>{t('historyImported')} {state.imported}</span><span>{t('historyConflicts')} {state.conflicts}</span></div>
        <p>{t(state.phase === 'ready' ? 'historyPlanned' : 'historyAdded')} · {t('input')} <TokenValue value={state.inputTokens} /> · {t('output')} <TokenValue value={state.outputTokens} /></p>
        <p className="muted">{state.firstAt === null ? '' : new Date(state.firstAt).toLocaleDateString()} — {state.lastAt === null ? '' : new Date(state.lastAt).toLocaleDateString()}</p>
      </>}
      {(state.missing + state.unreadable + state.auxiliary + state.inherited + state.conflicts + state.issues.length) > 0 && <details><summary>{t('historyCoverage')}</summary>
        <p>{t('historyMissing')} {state.missing} · {t('historyUnreadable')} {state.unreadable}</p>
        <p>{t('historyInherited')} {state.inherited}</p><p>{t('historyAuxiliary')} {state.auxiliary}</p>
        <p>{t('historyConflictHint')}</p>
        {state.issues.map((issue, i) => <p key={i} className="muted">{issue.sessionId} · {t(`historyIssue_${issue.reason}`)}</p>)}
      </details>}
    </>}
  </div>
}

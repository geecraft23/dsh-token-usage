/** Register a native DSH settings section with localized copy and authenticated requests. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { en, zh, type Translate } from './locales.js'
import { UsagePage, type UsagePageProps } from './UsagePage.js'

export const inject = ['slots', 'locale']

/** Wire the settings page to the browser Connection without importing the Host runtime. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('token-usage', { en, zh }), 'token-usage dictionaries')
  const t = ctx.locale.bind('token-usage') as Translate
  const call: UsagePageProps['call'] = async (endpoint, payload, signal) => {
    const response = await fetch(`/api/token-usage/${endpoint}`, {
      method: 'POST', credentials: 'same-origin', signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error(`Token usage request failed: ${response.status}`)
    return response.json()
  }
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'token-usage', order: 25,
    label: () => t('nav'), inject: () => ({ t, call }),
  }, UsagePage))
}

import { expect, it } from 'vitest'
import { formatTokens } from '../src/client/TokenValue.js'
it('uses K by default, M at a million and B at a billion', () => {
  for (const [value, expected] of [[0, '0K'], [1, '0.001K'], [75, '0.075K'], [1234, '1.23K'], [999000, '999K'], [1000000, '1M'], [2492635, '2.49M'], [1000000000, '1B'], [26200000000, '26.2B']] as const) expect(formatTokens(value)).toBe(expected)
})

/** Compact token counts; the tooltip retains the exact integer. */
export function formatTokens(value: number): string {
  const divisor = value >= 1e9 ? 1e9 : value >= 1e6 ? 1e6 : 1e3
  const unit = divisor === 1e9 ? 'B' : divisor === 1e6 ? 'M' : 'K'
  const scaled = value / divisor
  return `${Number(scaled.toFixed(scaled > 0 && scaled < 1 ? 3 : 2))}${unit}`
}
export function TokenValue({ value }: { value: number }) {
  return <span className="token-value" title={value.toLocaleString()}>{formatTokens(value)}</span>
}

import { LlmAdapter } from '@deepseek-ai/dsh-llm'

export const name = 'token-usage-smoke-provider'
export const inject = ['llm']

export function apply(ctx) {
  ctx.llm.registerAdapter(['usage-smoke'], new class extends LlmAdapter {
    async resolveModel(provider, model) {
      return { provider, id: model, name: model, context: { contextWindow: 32768 } }
    }
    async *stream() {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: 'TOKEN_USAGE_SMOKE_OK' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'TOKEN_USAGE_SMOKE_OK' } }
      yield { type: 'usage', usage: { inputTokens: 128, outputTokens: 32, cacheReadTokens: 16, reasoningTokens: 8, totalTokens: 176 } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }())
}

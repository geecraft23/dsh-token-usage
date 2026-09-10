/** Observe the public LLM waterfall without retaining request or response content. */
import { randomUUID } from 'node:crypto'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { usageSchema, type Attempt } from './types.js'

export interface Sink { put(attempt: Attempt): void }

/** Track one stream attempt, replacing repeated cumulative usage reports. */
export async function* capture(
  options: GenerateOptions, next: () => AsyncIterable<StreamChunk>, sink: Sink,
): AsyncGenerator<StreamChunk> {
  const now = Date.now()
  const attempt: Attempt = {
    id: randomUUID(), startedAt: now, updatedAt: now, provider: options.provider, model: options.model,
    sessionId: options.sessionId ?? null, purpose: options.purpose ?? 'conversation',
    status: 'open', usage: null, invalidUsage: false,
  }
  sink.put(attempt)
  try {
    for await (const chunk of next()) {
      if (chunk.type === 'usage') {
        const parsed = usageSchema.safeParse(chunk.usage)
        attempt.invalidUsage ||= !parsed.success
        if (parsed.success) attempt.usage = parsed.data
        attempt.updatedAt = Date.now()
        sink.put(attempt)
      }
      if (chunk.type === 'finish') {
        attempt.status = chunk.reason.kind
        attempt.updatedAt = Date.now()
        sink.put(attempt)
      }
      yield chunk
    }
  } finally {
    if (attempt.status === 'open') attempt.status = options.signal?.aborted ? 'aborted' : 'interrupted'
    attempt.updatedAt = Date.now()
    sink.put(attempt)
  }
}

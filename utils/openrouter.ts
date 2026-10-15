import OpenAI from 'openai'

// The one OpenRouter client, constructed on first use. Building it at import
// would make `next build` need OPENROUTER_API_KEY (the build imports every
// route module), and an empty-string key fails inside the SDK with an obscure
// "Missing credentials" rather than a message about configuration.
//
// Server-only: the browser never calls OpenRouter. Model names live in
// utils/ai-models.ts.
let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY. Add it to .env.local (see .env.local.example).')
    }
    client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        ...(process.env.NEXT_PUBLIC_APP_URL ? { 'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL } : {}),
        'X-Title': process.env.OPENROUTER_APP_NAME || 'SaaS Starter',
      },
    })
  }
  return client
}

/** True when an OpenRouter key is configured, without constructing a client. */
export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

export const openrouter = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver)
  },
})

/**
 * True for a failure that says the provider is unavailable (rate limit, 5xx,
 * timeout, connection) rather than that the request was wrong: the only case
 * in which the fallback model should take over.
 */
export function isOutageError(e: unknown): boolean {
  if (e instanceof OpenAI.APIConnectionError) return true // includes timeouts
  if (e instanceof OpenAI.APIError) {
    const status = e.status ?? 0
    return status === 408 || status === 429 || status >= 500
  }
  return false
}

type ChatParams = Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, 'model'>
type ChatStreamParams = Omit<OpenAI.Chat.ChatCompletionCreateParamsStreaming, 'model' | 'stream'>

/** A chat completion on `model`, switching once to `fallback` on an outage. */
export async function completeWithFallback(
  params: ChatParams,
  model: string,
  fallback: string,
  options: { timeoutMs?: number } = {}
): Promise<{ completion: OpenAI.Chat.ChatCompletion; model: string; usedFallback: boolean }> {
  const timeout = options.timeoutMs ?? 60_000
  try {
    const completion = await openrouter.chat.completions.create({ ...params, model }, { timeout, maxRetries: 0 })
    return { completion, model, usedFallback: false }
  } catch (e) {
    if (!isOutageError(e)) throw e
    const completion = await openrouter.chat.completions.create({ ...params, model: fallback }, { timeout, maxRetries: 0 })
    return { completion, model: fallback, usedFallback: true }
  }
}

/**
 * A streamed chat completion on `model`, switching once to `fallback` when the
 * request fails before any token arrives. A stream that breaks part-way is the
 * caller's to handle.
 */
export async function streamWithFallback(
  params: ChatStreamParams,
  model: string,
  fallback: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<{ stream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>; model: string; usedFallback: boolean }> {
  const opts = { timeout: options.timeoutMs ?? 60_000, maxRetries: 0, signal: options.signal }
  try {
    const stream = await openrouter.chat.completions.create({ ...params, model, stream: true }, opts)
    return { stream, model, usedFallback: false }
  } catch (e) {
    if (!isOutageError(e)) throw e
    const stream = await openrouter.chat.completions.create({ ...params, model: fallback, stream: true }, opts)
    return { stream, model: fallback, usedFallback: true }
  }
}

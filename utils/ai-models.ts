// The one place model names live (OpenRouter ids). Change a model only after
// your quality check passes on the new one.

/** Everyday calls: low cost and fast. */
export const PRIMARY_MODEL = 'google/gemini-2.5-flash'

/** One retry on a stronger model, for a failure code can detect (invalid output). */
export const RETRY_MODEL = 'google/gemini-2.5-pro'

/** Same class, another provider: takes over when the primary is unavailable. */
export const FALLBACK_MODEL = 'openai/gpt-4.1-mini'

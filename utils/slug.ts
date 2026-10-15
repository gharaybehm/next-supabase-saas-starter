/** A URL-safe slug from a display name, or `fallback` when nothing usable is left. */
export function toSlug(name: string, fallback: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || fallback
  )
}

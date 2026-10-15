import { describe, expect, it } from 'vitest'
import { toSlug } from './slug'

describe('toSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(toSlug('  Acme  Farms Ltd. ', 'x')).toBe('acme-farms-ltd')
  })

  it('falls back when no latin characters are left', () => {
    expect(toSlug('مزرعة', 'tenant')).toBe('tenant')
  })
})

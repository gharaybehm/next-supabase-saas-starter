import { describe, expect, it } from 'vitest'
import { safeNextPath } from './safe-redirect'

describe('safeNextPath', () => {
  it('keeps a path on this site', () => {
    expect(safeNextPath('/abc/dashboard')).toBe('/abc/dashboard')
    expect(safeNextPath('/tenants?new=1')).toBe('/tenants?new=1')
  })

  it('falls back for anything that could leave the site', () => {
    for (const bad of ['//evil.example', '/\\evil.example', '@evil.example', 'https://evil.example', '', null, undefined]) {
      expect(safeNextPath(bad)).toBe('/tenants')
    }
  })
})

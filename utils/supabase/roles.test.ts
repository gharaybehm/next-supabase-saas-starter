import { describe, expect, it } from 'vitest'
import { atLeast, isTenantRole } from './roles'

describe('atLeast', () => {
  it('ranks worker < supervisor < admin', () => {
    expect(atLeast('admin', 'supervisor')).toBe(true)
    expect(atLeast('supervisor', 'supervisor')).toBe(true)
    expect(atLeast('worker', 'supervisor')).toBe(false)
    expect(atLeast('supervisor', 'admin')).toBe(false)
  })

  it('denies a missing role', () => {
    expect(atLeast(null, 'worker')).toBe(false)
    expect(atLeast(undefined, 'worker')).toBe(false)
  })
})

describe('isTenantRole', () => {
  it('accepts only the three tenant roles', () => {
    expect(isTenantRole('admin')).toBe(true)
    expect(isTenantRole('worker')).toBe(true)
    // The platform role is not a tenant role.
    expect(isTenantRole('super_admin')).toBe(false)
    expect(isTenantRole('owner')).toBe(false)
    expect(isTenantRole(undefined)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { applyRememberMe, readRememberMe } from './remember-me'

const lib = { path: '/', maxAge: 400 * 24 * 60 * 60, expires: new Date(0), sameSite: 'lax' }

describe('applyRememberMe', () => {
  it('makes a session cookie when the user did not tick remember me', () => {
    const o = applyRememberMe(lib, false)
    expect(o.maxAge).toBeUndefined()
    expect(o.expires).toBeUndefined()
    expect(o.path).toBe('/')
  })

  it('keeps the cookie for 30 days when they did', () => {
    const o = applyRememberMe(lib, true)
    expect(o.maxAge).toBe(60 * 60 * 24 * 30)
    expect(o.expires).toBeUndefined()
  })

  it('leaves the library default when no choice was made', () => {
    expect(applyRememberMe(lib, null)).toEqual(lib)
  })
})

describe('readRememberMe', () => {
  it('reads only the two stored values', () => {
    expect(readRememberMe('1')).toBe(true)
    expect(readRememberMe('0')).toBe(false)
    expect(readRememberMe(undefined)).toBeNull()
    expect(readRememberMe('yes')).toBeNull()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { rejectUnauthorizedCron, secretsMatch } from './cron-auth'

function request(auth?: string) {
  return new Request('https://app.example/api/cron/ping', {
    headers: auth ? { authorization: auth } : {},
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('rejectUnauthorizedCron', () => {
  it('lets the right bearer secret through', () => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    expect(rejectUnauthorizedCron(request('Bearer s3cret'))).toBeNull()
  })

  it('refuses a wrong, missing or differently-shaped secret', () => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    for (const auth of ['Bearer wrong', 'Bearer s3cre', 's3cret', undefined]) {
      expect(rejectUnauthorizedCron(request(auth))?.status).toBe(401)
    }
  })

  it('fails closed in production when no secret is configured', () => {
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(rejectUnauthorizedCron(request('Bearer anything'))?.status).toBe(503)
  })
})

describe('secretsMatch', () => {
  it('compares exactly', () => {
    expect(secretsMatch('abc', 'abc')).toBe(true)
    expect(secretsMatch('abc', 'abd')).toBe(false)
    expect(secretsMatch('', 'abc')).toBe(false)
  })
})

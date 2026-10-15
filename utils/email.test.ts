import { describe, expect, it } from 'vitest'
import { escapeHtml } from './email'

describe('escapeHtml', () => {
  it('escapes every character that can open markup or an attribute', () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;'
    )
  })

  it('leaves plain text alone', () => {
    expect(escapeHtml('Acme Ltd')).toBe('Acme Ltd')
  })
})

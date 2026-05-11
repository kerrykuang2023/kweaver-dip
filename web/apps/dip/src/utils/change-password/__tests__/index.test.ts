import { describe, expect, it } from 'vitest'
import { canShowChangePasswordEntry } from '..'

describe('canShowChangePasswordEntry', () => {
  it.each(['admin', 'security', 'audit', ' ADMIN '])(
    'shows change password entry for built-in account %s',
    (account) => {
      expect(canShowChangePasswordEntry({ account })).toBe(true)
    },
  )

  it('shows change password entry for local users', () => {
    expect(canShowChangePasswordEntry({ account: 'user', user_type: 1 })).toBe(true)
  })

  it('hides change password entry for domain and external users', () => {
    expect(canShowChangePasswordEntry({ account: 'domain-user', user_type: 2 })).toBe(false)
    expect(canShowChangePasswordEntry({ account: 'external-user', user_type: 3 })).toBe(false)
  })
})

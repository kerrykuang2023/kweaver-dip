import { describe, expect, it } from 'vitest'
import {
  DEFAULT_POLICY,
  getPasswordMinLength,
  getPasswordPolicy,
  isPasswordValid,
  PASSWORD_MIN_LENGTH,
} from '../utils'

describe('ChangePasswordModal utils', () => {
  it('normalizes password policy from api config', () => {
    expect(getPasswordPolicy({ strongStatus: true, strongPwdLength: 8 })).toEqual({
      strongPasswordStatus: true,
      strongPasswordLength: 8,
    })
    expect(getPasswordPolicy({ strongStatus: false, strongPwdLength: 8 })).toEqual({
      strongPasswordStatus: false,
      strongPasswordLength: 8,
    })
    expect(getPasswordPolicy({ strongStatus: true, strongPwdLength: 0 })).toEqual({
      strongPasswordStatus: true,
      strongPasswordLength: PASSWORD_MIN_LENGTH,
    })
  })

  it('uses default min length for weak password policy', () => {
    expect(getPasswordMinLength({ strongPasswordStatus: false, strongPasswordLength: 8 })).toBe(
      PASSWORD_MIN_LENGTH,
    )
  })

  it('validates weak password length and half-width characters', () => {
    expect(isPasswordValid('abcdef', DEFAULT_POLICY, PASSWORD_MIN_LENGTH)).toBe(true)
    expect(isPasswordValid('abc', DEFAULT_POLICY, PASSWORD_MIN_LENGTH)).toBe(false)
    expect(isPasswordValid('中文密码abc', DEFAULT_POLICY, PASSWORD_MIN_LENGTH)).toBe(false)
  })

  it('validates strong password composition', () => {
    const strongPolicy = { strongPasswordStatus: true, strongPasswordLength: 8 }

    expect(isPasswordValid('Abcdef1!', strongPolicy, 8)).toBe(true)
    expect(isPasswordValid('abcdef1!', strongPolicy, 8)).toBe(false)
    expect(isPasswordValid('ABCDEF1!', strongPolicy, 8)).toBe(false)
    expect(isPasswordValid('Abcdefgh!', strongPolicy, 8)).toBe(false)
    expect(isPasswordValid('Abcdef12', strongPolicy, 8)).toBe(false)
  })
})

import intl from 'react-intl-universal'
import type { PasswordConfigResponse } from '@/apis'

export const PASSWORD_MIN_LENGTH = 6
export const PASSWORD_MAX_LENGTH = 100

const HALF_WIDTH_VISIBLE_CHAR_PATTERN = /^[\x20-\x7E]+$/
const UPPERCASE_LETTER_PATTERN = /[A-Z]/
const LOWERCASE_LETTER_PATTERN = /[a-z]/
const DIGIT_PATTERN = /\d/
const HALF_WIDTH_SPECIAL_CHAR_PATTERN = /[^\da-zA-Z ]/

export interface PasswordPolicy {
  strongPasswordStatus: boolean
  strongPasswordLength: number
}

export const DEFAULT_POLICY: PasswordPolicy = {
  strongPasswordStatus: false,
  strongPasswordLength: PASSWORD_MIN_LENGTH,
}

export function getPasswordPolicy(passwordConfig?: PasswordConfigResponse): PasswordPolicy {
  const strongPasswordLength = Number(passwordConfig?.strongPwdLength)

  return {
    strongPasswordStatus: Boolean(passwordConfig?.strongStatus),
    strongPasswordLength: strongPasswordLength > 0 ? strongPasswordLength : PASSWORD_MIN_LENGTH,
  }
}

export function getPasswordMinLength(passwordPolicy: PasswordPolicy) {
  return passwordPolicy.strongPasswordStatus
    ? passwordPolicy.strongPasswordLength
    : PASSWORD_MIN_LENGTH
}

export function getChangePasswordErrorMessage(error: any): string {
  const code = error?.code
  const description = error?.description || error?.message

  switch (code) {
    case 401001003:
      return intl.get('changePassword.errors.oldPasswordIncorrect')
    case 401001014:
    case 401001015:
      return intl.get('changePassword.errors.newPasswordInvalid')
    case 401001020:
      return intl.get('changePassword.errors.passwordInvalidLocked')
    case 401001032:
      return intl.get('changePassword.errors.accountLocked')
    case 401001035:
      return intl.get('changePassword.errors.newPasswordIsInitial')
    default:
      return description || intl.get('changePassword.errors.submitFailed')
  }
}

export function isPasswordValid(
  password: string,
  passwordPolicy: PasswordPolicy,
  passwordMinLength: number,
): boolean {
  if (
    password.length < passwordMinLength ||
    password.length > PASSWORD_MAX_LENGTH ||
    !HALF_WIDTH_VISIBLE_CHAR_PATTERN.test(password)
  ) {
    return false
  }

  if (!passwordPolicy.strongPasswordStatus) {
    return true
  }

  return (
    UPPERCASE_LETTER_PATTERN.test(password) &&
    LOWERCASE_LETTER_PATTERN.test(password) &&
    DIGIT_PATTERN.test(password) &&
    HALF_WIDTH_SPECIAL_CHAR_PATTERN.test(password)
  )
}

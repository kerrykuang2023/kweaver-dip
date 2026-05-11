import type { UserInfo } from '@/apis'

const BUILT_IN_ACCOUNTS = new Set(['admin', 'security', 'audit'])
const LOCAL_USER_TYPE = 1

export function canShowChangePasswordEntry(
  userInfo?: Pick<UserInfo, 'account' | 'user_type'> | null,
) {
  const account = userInfo?.account?.trim().toLowerCase()

  if (account && BUILT_IN_ACCOUNTS.has(account)) {
    return true
  }

  return userInfo?.user_type === LOCAL_USER_TYPE
}

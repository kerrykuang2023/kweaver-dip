import { post } from '@/utils/http'
import type { PasswordConfigResponse } from './index.d'

export type { PasswordConfigResponse } from './index.d'

const BASE = '/isfweb/api/ShareMgnt'

export const getPasswordConfig = (): Promise<PasswordConfigResponse> =>
  post(`${BASE}/Usrm_GetPasswordConfig`, { body: [] })

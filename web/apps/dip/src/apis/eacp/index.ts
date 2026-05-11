import { post } from '@/utils/http'
import type { ModifyPasswordRequest } from './index.d'

export type { ModifyPasswordRequest } from './index.d'

const BASE = '/api/eacp/v1/auth1'

interface ModifyPasswordResponse {
  status: number
  data?: unknown
}

export const modifyPassword = (body: ModifyPasswordRequest, sign: string): Promise<void> =>
  post(`${BASE}/modifypassword?sign=${sign}`, {
    body,
    returnFullResponse: true,
    skipAuthRefreshOn401: true,
  }).then((response: ModifyPasswordResponse) => {
    if (response.status !== 200) {
      return Promise.reject(response.data || response)
    }
  })

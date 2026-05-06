import { get, put } from '@/utils/http'
import type { UserPreferences, UserPreferencesPutBody } from './index.d'

/**
 * 获取当前用户偏好（侧栏钉选数字员工等）
 * OpenAPI: GET /user/preferences
 */
export function getUserPreferences(): Promise<UserPreferences> {
  return get(`/api/dip-hub/v1/user/preferences`)
}

/**
 * 全量更新钉选数字员工 ID 列表
 * OpenAPI: PUT /user/preferences
 */
export function putUserPreferences(body: UserPreferencesPutBody): Promise<UserPreferences> {
  return put(`/api/dip-hub/v1/user/preferences`, {
    body: JSON.stringify(body),
  })
}

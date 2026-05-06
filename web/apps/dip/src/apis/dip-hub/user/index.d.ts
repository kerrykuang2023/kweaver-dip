/** 用户角色 */
export type UserRole =
  | 'normal_user'
  | 'super_admin'
  | 'org_manager'
  | 'org_audit'
  | 'sys_admin'
  | 'audit_admin'
  | 'sec_admin'

/** 用户信息 */
export interface UserInfo {
  /** 用户ID */
  id: string
  /** 账号 */
  account: string
  /** 用户类型：1 本地用户，2 域用户，3 外部用户 */
  user_type?: 1 | 2 | 3
  /** 显示名称 */
  vision_name: string
  /** 邮箱 */
  email?: string
  /** 角色 */
  roles?: Record<UserRole, boolean>
}

/** 角色对象 */
export interface RoleInfo {
  /** 角色ID */
  role_id: string
  /** 角色名称 */
  role_name: string
}

/** 用户偏好（Hub 持久化） */
export interface UserPreferences {
  /** 侧栏固定的数字员工 ID，顺序即展示顺序 */
  pinned_digital_human_ids: string[]
}

/** PUT /user/preferences 请求体 */
export type UserPreferencesPutBody = UserPreferences

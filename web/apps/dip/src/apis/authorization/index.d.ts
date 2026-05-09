export type AuthorizationAccessorType = 'user' | 'department' | 'group' | 'role' | 'app'

export interface AuthorizationPolicyOperationItem {
  id: string
  name?: string
}

export interface AuthorizationAccessorPolicy {
  id: string
  resource: {
    id: string
    type: string
    name: string
  }
  operation: {
    allow: AuthorizationPolicyOperationItem[]
    deny: AuthorizationPolicyOperationItem[]
  }
  expires_at: string
}

export interface ListAccessorPolicyParams {
  accessor_id: string
  accessor_type: AuthorizationAccessorType
  resource_type?: string
  resource_id?: string
  offset?: number
  limit?: number
}

export interface ListAccessorPolicyResponse {
  entries: AuthorizationAccessorPolicy[]
  total_count: number
}

export interface CreatePolicyInfo {
  accessor: {
    id: string
    type: AuthorizationAccessorType
  }
  resource: {
    id: string
    type: string
    name: string
  }
  operation: {
    allow: Array<{ id: string }>
    deny: Array<{ id: string }>
  }
  expires_at?: string
}

export type CreatePolicyInfos = CreatePolicyInfo[]

export interface PolicyIDInfos {
  ids: string[]
}

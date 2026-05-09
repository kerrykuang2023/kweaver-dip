export type AppCredentialType = 'password' | 'token'

export interface AppAccount {
  id: string
  name: string
  credential_type: AppCredentialType
}

export interface GetAppAccountsParams {
  limit?: number
  offset?: number
  direction?: 'asc' | 'desc'
  sort?: 'date_created' | 'name'
  keyword?: string
}

export interface AppAccountListResponse {
  entries: AppAccount[]
  total_count: number
}

export interface CreateAppAccountRequest {
  name: string
  password: string
}

export interface CreateAppAccountResponse {
  id: string
}

export interface CreateAppTokenRequest {
  id: string
}

export interface AppTokenInfo {
  token: string
}

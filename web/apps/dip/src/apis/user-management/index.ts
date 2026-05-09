import { get, post } from '@/utils/http'
import type {
  AppAccountListResponse,
  AppTokenInfo,
  CreateAppAccountRequest,
  CreateAppAccountResponse,
  CreateAppTokenRequest,
  GetAppAccountsParams,
} from './index.d'

export type {
  AppAccount,
  AppAccountListResponse,
  AppCredentialType,
  AppTokenInfo,
  CreateAppAccountRequest,
  CreateAppAccountResponse,
  CreateAppTokenRequest,
  GetAppAccountsParams,
} from './index.d'

const BASE = '/api/dip-studio/v1/user-management'

/** 获取应用账户列表（GET /user-management/v1/apps） */
export const getAppAccounts = (params?: GetAppAccountsParams): Promise<AppAccountListResponse> =>
  get(`${BASE}/apps`, { params }) as Promise<AppAccountListResponse>

/** 通用应用账户注册（POST /user-management/v1/apps） */
export const createAppAccount = (
  body: CreateAppAccountRequest,
): Promise<CreateAppAccountResponse> =>
  post(`${BASE}/apps`, { body }) as Promise<CreateAppAccountResponse>

/** 生成应用账户令牌（POST /user-management/v1/console/app-tokens） */
export const createAppToken = (body: CreateAppTokenRequest): Promise<AppTokenInfo> =>
  post(`${BASE}/console/app-tokens`, { body }) as Promise<AppTokenInfo>

import { get, post } from '@/utils/http'
import type {
  CreatePolicyInfos,
  ListAccessorPolicyParams,
  ListAccessorPolicyResponse,
  PolicyIDInfos,
} from './index.d'

export type {
  AuthorizationAccessorPolicy,
  AuthorizationAccessorType,
  CreatePolicyInfo,
  CreatePolicyInfos,
  ListAccessorPolicyParams,
  ListAccessorPolicyResponse,
  PolicyIDInfos,
} from './index.d'

const BASE = '/api/dip-studio/v1/authorization'

/** 获取访问者策略配置（GET /authorization/v1/accessor-policy） */
export const getAccessorPolicies = (
  params: ListAccessorPolicyParams,
): Promise<ListAccessorPolicyResponse> =>
  get(`${BASE}/accessor-policy`, { params }) as Promise<ListAccessorPolicyResponse>

/** 新建策略（POST /authorization/v1/policy） */
export const createAuthorizationPolicies = (body: CreatePolicyInfos): Promise<PolicyIDInfos> =>
  post(`${BASE}/policy`, { body }) as Promise<PolicyIDInfos>

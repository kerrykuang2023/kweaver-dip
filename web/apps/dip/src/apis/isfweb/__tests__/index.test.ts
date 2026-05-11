import { describe, expect, it, vi } from 'vitest'
import { getPasswordConfig } from '../index'

vi.mock('@/utils/http', () => ({
  post: vi.fn(),
}))

describe('isfweb api', () => {
  it('posts password config request with empty thrift payload', async () => {
    const { post } = await import('@/utils/http')

    getPasswordConfig()

    expect(post).toHaveBeenCalledWith('/isfweb/api/ShareMgnt/Usrm_GetPasswordConfig', {
      body: [],
    })
  })
})

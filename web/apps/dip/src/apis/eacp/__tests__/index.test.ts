import { describe, expect, it, vi } from 'vitest'
import { modifyPassword } from '../index'

vi.mock('@/utils/http', () => ({
  post: vi.fn(),
}))

describe('eacp api', () => {
  it('posts modify password request to the fixed EACP endpoint with sign param', async () => {
    const { post } = await import('@/utils/http')
    vi.mocked(post).mockResolvedValue({ status: 200 })
    const body = {
      account: 'admin',
      newpwd: 'new-encrypted',
      oldpwd: 'old-encrypted',
      vcodeinfo: {
        uuid: '',
        vcode: '',
      },
    }

    modifyPassword(body, 'a+b/c=d?')

    expect(Object.keys(body)).toEqual(['account', 'newpwd', 'oldpwd', 'vcodeinfo'])
    expect(post).toHaveBeenCalledWith('/api/eacp/v1/auth1/modifypassword?sign=a+b/c=d?', {
      body,
      returnFullResponse: true,
      skipAuthRefreshOn401: true,
    })
  })

  it('rejects modify password when response status is not 200', async () => {
    const { post } = await import('@/utils/http')
    const error = {
      code: 401001003,
      description: 'old password incorrect',
    }
    vi.mocked(post).mockResolvedValue({ status: 401, data: error })

    await expect(
      modifyPassword(
        {
          account: 'admin',
          newpwd: 'new-encrypted',
          oldpwd: 'old-encrypted',
        },
        'sign',
      ),
    ).rejects.toEqual(error)
  })
})

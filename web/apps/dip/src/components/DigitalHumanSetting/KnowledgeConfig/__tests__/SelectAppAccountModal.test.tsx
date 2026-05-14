import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAppAccounts } from '@/apis'
import SelectAppAccountModal from '../SelectAppAccountModal'

const mockOnOk = vi.fn()
const mockOnCancel = vi.fn()
const mockOnCreate = vi.fn()

vi.mock('@/apis', () => ({
  getAppAccounts: vi.fn(),
}))

vi.mock('@/components/ScrollBarContainer', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockedGetAppAccounts = vi.mocked(getAppAccounts)

describe('DigitalHumanSetting/KnowledgeConfig/SelectAppAccountModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetAppAccounts.mockResolvedValue({
      entries: [
        { id: 'app-1', name: '应用账户A', credential_type: 'token', has_kweaver_token: true },
        { id: 'app-2', name: '应用账户B', credential_type: 'token', has_kweaver_token: false },
      ],
      total_count: 2,
    })
  })

  it('切换到无 Studio token 的应用账户时显示 token 失效提醒', async () => {
    render(
      <SelectAppAccountModal
        open
        onOk={mockOnOk}
        onCancel={mockOnCancel}
        onCreate={mockOnCreate}
        defaultSelectedId="app-1"
      />,
    )

    await screen.findByText('应用账户A')
    expect(
      screen.queryByText('digitalHuman.appAccountModal.switchWarning'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('应用账户B'))

    expect(screen.getByText('digitalHuman.appAccountModal.switchWarning')).toBeInTheDocument()
  })

  it('切换到已有 Studio token 的应用账户时不显示切换提醒', async () => {
    render(
      <SelectAppAccountModal
        open
        onOk={mockOnOk}
        onCancel={mockOnCancel}
        onCreate={mockOnCreate}
        defaultSelectedId="app-2"
      />,
    )

    await screen.findByText('应用账户A')
    fireEvent.click(screen.getByText('应用账户A'))

    expect(screen.queryByText('digitalHuman.appAccountModal.switchWarning')).not.toBeInTheDocument()
  })
})

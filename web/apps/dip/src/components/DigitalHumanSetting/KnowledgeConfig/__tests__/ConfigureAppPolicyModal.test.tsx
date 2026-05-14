import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ConfigureAppPolicyModal from '../ConfigureAppPolicyModal'

describe('DigitalHumanSetting/KnowledgeConfig/ConfigureAppPolicyModal', () => {
  it('点击确定时仅确认选择，不直接调用后端授权接口', () => {
    const onOk = vi.fn()
    const onCancel = vi.fn()

    render(
      <ConfigureAppPolicyModal
        open
        appAccountId="app-1"
        networks={[
          { id: 'kn-1', name: '知识网络1' },
          { id: 'kn-2', name: '知识网络2' },
        ]}
        onOk={onOk}
        onCancel={onCancel}
      />,
    )

    const buttons = screen.getAllByRole('button')
    const okButton = buttons[buttons.length - 2]
    fireEvent.click(okButton)

    expect(onOk).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })
})

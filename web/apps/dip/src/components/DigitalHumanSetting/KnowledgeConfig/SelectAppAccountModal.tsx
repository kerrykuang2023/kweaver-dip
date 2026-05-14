import { SearchOutlined } from '@ant-design/icons'
import type { ModalProps } from 'antd'
import { Button, Input, Modal, Radio, Spin } from 'antd'
import { useEffect, useState } from 'react'
import intl from 'react-intl-universal'
import type { AppAccount } from '@/apis'
import { getAppAccounts } from '@/apis'
import Empty from '@/components/Empty'
import ScrollBarContainer from '@/components/ScrollBarContainer'
import { LoadStatus } from '@/types/enums'

export interface SelectAppAccountModalProps extends Omit<ModalProps, 'onCancel' | 'onOk'> {
  onOk: (account: AppAccount) => void
  onCancel: () => void
  onCreate: () => void
  defaultSelectedId?: string
}

const SelectAppAccountModal = ({
  open,
  onOk,
  onCancel,
  onCreate,
  defaultSelectedId,
}: SelectAppAccountModalProps) => {
  const [status, setStatus] = useState<LoadStatus>(LoadStatus.Empty)
  const [keyword, setKeyword] = useState('')
  const [accounts, setAccounts] = useState<AppAccount[]>([])
  const [selectedId, setSelectedId] = useState<string>()

  useEffect(() => {
    if (open) {
      setSelectedId(defaultSelectedId)
    }
  }, [defaultSelectedId, open])

  const fetchAccounts = async (nextKeyword = keyword) => {
    if (status === LoadStatus.Loading) return
    setStatus(LoadStatus.Loading)
    try {
      const result = await getAppAccounts({
        limit: 1000,
        keyword: nextKeyword.trim() || undefined,
        sort: 'name',
        direction: 'asc',
      })
      setAccounts(result.entries)
      setStatus(result.entries.length > 0 ? LoadStatus.Normal : LoadStatus.Empty)
    } catch {
      setAccounts([])
      setStatus(LoadStatus.Failed)
    }
  }

  useEffect(() => {
    if (open) {
      fetchAccounts('')
    }
  }, [open])

  const handleOk = () => {
    const selected = accounts.find((item) => item.id === selectedId)
    if (selected) {
      onOk(selected)
    }
  }

  const hasSelectedAccount = accounts.some((item) => item.id === selectedId)
  const selectedAccount = accounts.find((item) => item.id === selectedId)
  const shouldShowSwitchWarning =
    defaultSelectedId &&
    selectedId &&
    selectedId !== defaultSelectedId &&
    selectedAccount?.has_kweaver_token === false

  const renderContent = () => {
    if (status === LoadStatus.Loading) {
      return (
        <div className="flex min-h-[156px] items-center justify-center">
          <Spin />
        </div>
      )
    }
    if (status === LoadStatus.Failed) {
      return (
        <div className="flex min-h-[156px] items-center justify-center">
          <Empty type="failed" title={intl.get('digitalHuman.appAccountModal.loadFailed')} />
        </div>
      )
    }
    if (status === LoadStatus.Empty) {
      return (
        <div className="flex min-h-[156px] items-center justify-center">
          <Empty title={intl.get('digitalHuman.appAccountModal.emptyNoAccount')} />
        </div>
      )
    }

    return (
      <Radio.Group
        className="w-full"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
      >
        <div className="flex flex-col">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              className="flex h-10 items-center gap-2 rounded px-0 text-left transition-colors hover:bg-[var(--dip-hover-bg-color)]"
              onClick={() => setSelectedId(account.id)}
            >
              <Radio value={account.id} />
              <span className="min-w-0 flex-1 truncate text-sm font-normal leading-8 text-[--dip-text-color]">
                {account.name}
              </span>
            </button>
          ))}
        </div>
      </Radio.Group>
    )
  }

  return (
    <Modal
      title={
        <span className="text-base font-bold leading-[19px] text-[--dip-text-color]">
          {intl.get('digitalHuman.appAccountModal.title')}
        </span>
      }
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okButtonProps={{
        disabled: !hasSelectedAccount,
        style: { width: 74, height: 32, borderRadius: 6 },
      }}
      centered
      destroyOnHidden
      mask={{ closable: false }}
      width={480}
      okText={intl.get('global.ok')}
      cancelText={intl.get('global.cancel')}
      footer={(_, { OkBtn }) => (
        <div className="flex items-center justify-end gap-2">
          <OkBtn />
          <Button style={{ width: 74, height: 32, borderRadius: 6 }} onClick={onCancel}>
            {intl.get('global.cancel')}
          </Button>
        </div>
      )}
      styles={{
        container: {
          display: 'flex',
          flexDirection: 'column',
          height: 501,
          padding: 0,
        },
        header: {
          flex: '0 0 56px',
          marginBottom: 0,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
        },
        body: {
          flex: 1,
          minHeight: 0,
          padding: '15px 24px 0',
        },
        footer: {
          flex: '0 0 80px',
          marginTop: 0,
          padding: '24px 24px',
        },
      }}
    >
      <div className="flex flex-col">
        <div className="mb-4 text-sm font-normal leading-[22px] text-[--dip-text-color]">
          {intl.get('digitalHuman.appAccountModal.subtitle')}
        </div>
        {shouldShowSwitchWarning && (
          <div className="mb-4 rounded-lg border border-[#ffe58f] bg-[#fffbe6] px-3 py-2 text-sm leading-[22px] text-[--dip-text-color]">
            {intl.get('digitalHuman.appAccountModal.switchWarning')}
          </div>
        )}
        <div className="mb-4 flex items-center gap-2">
          <Input
            allowClear
            value={keyword}
            placeholder={intl.get('digitalHuman.appAccountModal.searchPlaceholder')}
            prefix={<SearchOutlined className="text-[14px] text-[--dip-text-color-45]" />}
            className="min-w-0 flex-1"
            style={{ height: 32, borderRadius: 6 }}
            onChange={(e) => {
              setKeyword(e.target.value)
              if (!e.target.value) {
                fetchAccounts('')
              }
            }}
            onPressEnter={(e) => fetchAccounts(e.currentTarget.value)}
          />
          <Button style={{ width: 60, height: 32, borderRadius: 4, padding: 0 }} onClick={onCreate}>
            {intl.get('digitalHuman.appAccountModal.create')}
          </Button>
        </div>
        <ScrollBarContainer>
          <div className="max-h-[208px] min-h-[156px] overflow-y-auto">{renderContent()}</div>
        </ScrollBarContainer>
      </div>
    </Modal>
  )
}

export default SelectAppAccountModal

import { PlusOutlined } from '@ant-design/icons'
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
        <div className="flex flex-col gap-1">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              className="flex h-[52px] items-center gap-3 rounded-md px-0 text-left transition-colors hover:bg-[var(--dip-hover-bg-color)]"
              onClick={() => setSelectedId(account.id)}
            >
              <Radio value={account.id} />
              <span className="min-w-0 flex-1 truncate text-sm font-normal text-[--dip-text-color]">
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
        <div className="flex flex-col gap-1">
          <span className="text-base font-medium leading-6 text-[--dip-text-color]">
            {intl.get('digitalHuman.appAccountModal.title')}
          </span>
          <span className="text-xs font-normal leading-5 text-[--dip-text-color-45]">
            {intl.get('digitalHuman.appAccountModal.subtitle')}
          </span>
        </div>
      }
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okButtonProps={{ disabled: !hasSelectedAccount }}
      centered
      destroyOnHidden
      mask={{ closable: false }}
      width={560}
      okText={intl.get('global.ok')}
      cancelText={intl.get('global.cancel')}
      footer={(_, { OkBtn }) => (
        <div className="flex items-center justify-end gap-3">
          <Button onClick={onCancel}>{intl.get('global.cancel')}</Button>
          <OkBtn />
        </div>
      )}
      styles={{
        header: {
          marginBottom: 16,
        },
        body: {
          paddingTop: 0,
        },
      }}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Input.Search
            allowClear
            value={keyword}
            placeholder={intl.get('digitalHuman.appAccountModal.searchPlaceholder')}
            className="min-w-0 flex-1"
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={(value) => fetchAccounts(value)}
          />
          <Button icon={<PlusOutlined />} onClick={onCreate}>
            {intl.get('digitalHuman.appAccountModal.create')}
          </Button>
        </div>
        <ScrollBarContainer>
          <div className="max-h-[260px] min-h-[156px] overflow-y-auto">{renderContent()}</div>
        </ScrollBarContainer>
      </div>
    </Modal>
  )
}

export default SelectAppAccountModal

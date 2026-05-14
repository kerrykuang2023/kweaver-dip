import type { ModalProps } from 'antd'
import { Button, Checkbox, Modal } from 'antd'
import { useEffect, useState } from 'react'
import intl from 'react-intl-universal'
import type { BknEntry } from '@/apis/dip-studio/digital-human'

export const BKN_POLICY_RESOURCE_TYPE = 'knowledge_network'
export const BKN_REQUIRED_OPERATION_IDS = ['data_query', 'view_detail'] as const
export const AUTHORIZATION_ACCESSOR_POLICY_PAGE_LIMIT = 1000

export interface ConfigureAppPolicyModalProps extends Omit<ModalProps, 'onCancel' | 'onOk'> {
  appAccountId?: string
  networks: BknEntry[]
  onOk: () => void
  onCancel: () => void
}

const ConfigureAppPolicyModal = ({
  open,
  appAccountId,
  networks,
  onOk,
  onCancel,
}: ConfigureAppPolicyModalProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setSelectedIds(networks.map((item) => item.id))
    }
  }, [networks, open])

  const handleOk = () => {
    onOk()
  }

  return (
    <Modal
      title={intl.get('digitalHuman.appPolicyModal.title')}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      centered
      destroyOnHidden
      mask={{ closable: false }}
      width={480}
      okText={intl.get('global.ok')}
      cancelText={intl.get('global.cancel')}
      okButtonProps={{
        style: { width: 74, height: 32, borderRadius: 6 },
      }}
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
          height: 430,
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
          padding: '8px 24px 0',
        },
        footer: {
          flex: '0 0 54px',
          marginTop: 0,
          padding: '11px 24px',
        },
      }}
    >
      <div className="mb-[13px] text-sm font-normal leading-[22px] text-[--dip-text-color-85]">
        {intl.get('digitalHuman.appPolicyModal.desc')}
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        {networks.map((network) => (
          <Checkbox
            key={network.id}
            checked={selectedIds.includes(network.id)}
            className="flex h-10 items-center text-sm font-normal leading-8 text-[--dip-text-color-85]"
            onChange={(e) => {
              setSelectedIds((current) =>
                e.target.checked
                  ? [...current, network.id]
                  : current.filter((item) => item !== network.id),
              )
            }}
          >
            <span className="inline-block max-w-[384px] truncate align-bottom" title={network.name}>
              {network.name || '--'}
            </span>
          </Checkbox>
        ))}
      </div>
    </Modal>
  )
}

export default ConfigureAppPolicyModal

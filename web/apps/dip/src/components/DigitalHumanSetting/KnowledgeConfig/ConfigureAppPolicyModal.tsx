import type { ModalProps } from 'antd'
import { Checkbox, Modal, message, Table } from 'antd'
import { useEffect, useState } from 'react'
import intl from 'react-intl-universal'
import { createAuthorizationPolicies } from '@/apis'
import type { BknEntry } from '@/apis/dip-studio/digital-human'
import AppIcon from '@/components/AppIcon'

export const BKN_POLICY_RESOURCE_TYPE = 'knowledge_network'
export const BKN_QUERY_OPERATION_ID = 'data_query'
export const PERMANENT_EXPIRES_AT = '1970-01-01T08:00:00+08:00'

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
  const [submitting, setSubmitting] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  useEffect(() => {
    if (open) {
      setSelectedIds(networks.map((item) => item.id))
    }
  }, [networks, open])

  const handleOk = async () => {
    if (!appAccountId || selectedIds.length === 0) {
      onOk()
      return
    }

    setSubmitting(true)
    try {
      await createAuthorizationPolicies(
        networks
          .filter((network) => selectedIds.includes(network.id))
          .map((network) => ({
            accessor: {
              id: appAccountId,
              type: 'app',
            },
            resource: {
              id: network.id,
              type: BKN_POLICY_RESOURCE_TYPE,
              name: network.name,
            },
            operation: {
              allow: [{ id: BKN_QUERY_OPERATION_ID }],
              deny: [],
            },
            expires_at: PERMANENT_EXPIRES_AT,
          })),
      )
      onOk()
    } catch (err: any) {
      messageApi.error(err?.description || intl.get('digitalHuman.appPolicyModal.saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={intl.get('digitalHuman.appPolicyModal.title')}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={submitting}
      centered
      destroyOnHidden
      mask={{ closable: false }}
      width={640}
      okText={intl.get('global.ok')}
      cancelText={intl.get('global.cancel')}
    >
      {contextHolder}
      <div className="mb-3 text-[--dip-text-color-65]">
        {intl.get('digitalHuman.appPolicyModal.desc')}
      </div>
      <Table<BknEntry>
        dataSource={networks}
        pagination={false}
        rowKey={(record) => record.id}
        size="small"
        columns={[
          {
            title: '',
            dataIndex: 'id',
            width: 48,
            render: (id: string) => (
              <Checkbox
                checked={selectedIds.includes(id)}
                onChange={(e) => {
                  setSelectedIds((current) =>
                    e.target.checked ? [...current, id] : current.filter((item) => item !== id),
                  )
                }}
              />
            ),
          },
          {
            title: intl.get('digitalHuman.common.columnName'),
            dataIndex: 'name',
            render: (text: string) => (
              <div className="flex items-center gap-2 truncate">
                <AppIcon
                  name={text}
                  size={20}
                  className="h-6 w-6 flex-shrink-0 rounded"
                  shape="square"
                />
                <span className="truncate" title={text}>
                  {text || '--'}
                </span>
              </div>
            ),
          },
          {
            title: intl.get('digitalHuman.appPolicyModal.operation'),
            width: 120,
            render: () => intl.get('digitalHuman.appPolicyModal.dataQuery'),
          },
          {
            title: intl.get('digitalHuman.appPolicyModal.expiresAt'),
            width: 120,
            render: () => intl.get('digitalHuman.appPolicyModal.permanent'),
          },
        ]}
      />
    </Modal>
  )
}

export default ConfigureAppPolicyModal

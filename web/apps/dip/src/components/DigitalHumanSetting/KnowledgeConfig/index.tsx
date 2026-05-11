import { DeleteOutlined, InfoCircleFilled, SwapOutlined } from '@ant-design/icons'
import { Button, Flex, Modal, message, Table, Tooltip } from 'antd'
import { memo, useMemo, useState } from 'react'
import intl from 'react-intl-universal'
import {
  type AppAccount,
  type BknKnowledgeNetworkInfo,
  createAppToken,
  getAccessorPolicies,
} from '@/apis'
import type { BknEntry } from '@/apis/dip-studio/digital-human'
import AppIcon from '@/components/AppIcon'
import Empty from '@/components/Empty'
import IconFont from '@/components/IconFont'
import ScrollBarContainer from '@/components/ScrollBarContainer'
import { useLanguageStore } from '@/stores/languageStore'
import { useDigitalHumanStore } from '../digitalHumanStore'
import ConfigureAppPolicyModal, {
  BKN_POLICY_RESOURCE_TYPE,
  BKN_QUERY_OPERATION_ID,
} from './ConfigureAppPolicyModal'
import CreateAppAccountModal, { type CreateAppAccountResult } from './CreateAppAccountModal'
import styles from './index.module.less'
import SelectAppAccountModal from './SelectAppAccountModal'
import SelectKnowledgeModal from './SelectKnowledgeModal'

interface KnowledgeConfigProps {
  /** 只读（非管理员详情等） */
  readonly?: boolean
}

const KnowledgeConfig = ({ readonly }: KnowledgeConfigProps) => {
  const { language } = useLanguageStore()
  const { bkn, appAccount, updateBkn, deleteBkn, updateAppAccount, deleteAppAccount } =
    useDigitalHumanStore()
  const [messageApi, contextHolder] = message.useMessage()
  const [selectAppAccountModalOpen, setSelectAppAccountModalOpen] = useState(false)
  const [createAppAccountModalOpen, setCreateAppAccountModalOpen] = useState(false)
  const [selectKnowledgeModalOpen, setSelectKnowledgeModalOpen] = useState(false)
  const [policyModalOpen, setPolicyModalOpen] = useState(false)
  const [pendingBkn, setPendingBkn] = useState<BknEntry[]>([])
  const [pendingPolicyBkn, setPendingPolicyBkn] = useState<BknEntry[]>([])

  /** 选择知识网络 */
  const handleSelectKnowledge = () => {
    if (!appAccount) {
      setSelectAppAccountModalOpen(true)
      return
    }
    setSelectKnowledgeModalOpen(true)
  }

  const openPolicyModalIfNeeded = async (account: AppAccount, nextBkn: BknEntry[]) => {
    if (nextBkn.length === 0) {
      updateBkn(nextBkn)
      return
    }

    const result = await getAccessorPolicies({
      accessor_id: account.id,
      accessor_type: 'app',
      resource_type: BKN_POLICY_RESOURCE_TYPE,
      limit: -1,
    })
    const authorizedIds = new Set(
      result.entries
        .filter((policy) =>
          policy.operation.allow.some((operation) => operation.id === BKN_QUERY_OPERATION_ID),
        )
        .map((policy) => policy.resource.id),
    )
    const unauthorizedBkn = nextBkn.filter((item) => !authorizedIds.has(item.id))
    if (unauthorizedBkn.length === 0) {
      updateBkn(nextBkn)
      return
    }

    setPendingBkn(nextBkn)
    setPendingPolicyBkn(unauthorizedBkn)
    setPolicyModalOpen(true)
  }

  const handleSelectAppAccountResult = async (account: AppAccount) => {
    try {
      const token = await createAppToken({ id: account.id })
      updateAppAccount(account, token.token)
      setSelectAppAccountModalOpen(false)
      if (bkn.length > 0) {
        await openPolicyModalIfNeeded(account, bkn)
        return
      }
      setSelectKnowledgeModalOpen(true)
    } catch (err: any) {
      messageApi.error(err?.description || intl.get('digitalHuman.appAccountModal.tokenFailed'))
    }
  }

  const handleCreateAppAccountResult = (result: CreateAppAccountResult) => {
    updateAppAccount(result.account, result.token)
    setCreateAppAccountModalOpen(false)
    setSelectAppAccountModalOpen(false)
    setSelectKnowledgeModalOpen(true)
  }

  /** 选择知识网络结果，写入 store */
  const handleSelectKnowledgeResult = async (result: BknKnowledgeNetworkInfo[]) => {
    const next: BknEntry[] = result.map((k) => ({
      name: k.name,
      id: k.id,
      comment: k.comment,
      color: k.color,
    }))
    if (!appAccount) {
      setPendingBkn(next)
      setSelectAppAccountModalOpen(true)
      return
    }

    try {
      await openPolicyModalIfNeeded(appAccount, next)
    } catch (err: any) {
      messageApi.error(err?.description || intl.get('digitalHuman.appPolicyModal.loadFailed'))
    }
  }

  const handleDeleteAppAccount = () => {
    Modal.confirm({
      title: intl.get('digitalHuman.appAccountModal.deleteTitle'),
      content: intl.get('digitalHuman.appAccountModal.deleteContent'),
      okText: intl.get('digitalHuman.appAccountModal.deleteOk'),
      cancelText: intl.get('global.cancel'),
      okButtonProps: { danger: true },
      onOk: deleteAppAccount,
    })
  }

  // 知识表格列定义（备注列展示业务知识网络 comment）
  const knowledgeColumns = useMemo(() => {
    const columns = [
      {
        title: intl.get('digitalHuman.common.columnName'),
        dataIndex: 'name',
        key: 'name',
        width: '40%',
        render: (text: string, record: BknEntry) => (
          <div className="flex items-center gap-2 truncate">
            <AppIcon
              name={text}
              size={20}
              className="w-6 h-6 rounded flex-shrink-0"
              shape="square"
              color={record.color}
            />
            <span title={text} className="truncate">
              {text || '--'}
            </span>
          </div>
        ),
      },
      {
        title: intl.get('digitalHuman.common.columnFunctionDesc'),
        dataIndex: 'comment',
        key: 'comment',
        ellipsis: true,
        render: (text: string) => text || '--',
      },
      {
        title: intl.get('digitalHuman.common.columnAction'),
        key: 'action',
        width: 80,
        render: (_: unknown, record: BknEntry) => (
          <Flex align="center">
            <Tooltip title={intl.get('digitalHuman.common.remove')}>
              <Button
                type="text"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteBkn(record.id)
                }}
                icon={<IconFont type="icon-remove" />}
              />
            </Tooltip>
          </Flex>
        ),
      },
    ]
    return readonly ? columns.slice(0, 2) : columns
  }, [deleteBkn, readonly, language])

  return (
    <ScrollBarContainer className="h-full flex flex-col p-6">
      {contextHolder}
      <div className="mb-4 flex justify-between">
        <div className="flex flex-col gap-y-1">
          <div className="font-medium text-[--dip-text-color]">
            {intl.get('digitalHuman.setting.menuKnowledge')}
          </div>
          <div className="text-[--dip-text-color-45]">
            {intl.get('digitalHuman.knowledge.sectionDesc')}
          </div>
        </div>
        <div className="flex flex-col items-end gap-y-3">
          <div className="flex h-6 items-center gap-x-3">
            <div className="max-w-[360px] truncate rounded-lg bg-[#fafafa] px-2 py-px text-xs leading-5 text-[#6c798b]">
              <span>{intl.get('digitalHuman.appAccountModal.statusPrefix')}</span>
              <span className={appAccount ? '' : 'text-[rgba(108,121,139,0.45)]'}>
                {appAccount?.name || intl.get('digitalHuman.appAccountModal.unboundStatus')}
              </span>
            </div>
            {appAccount && !readonly && (
              <div className="flex items-center gap-x-3">
                <Tooltip title={intl.get('digitalHuman.appAccountModal.switch')}>
                  <Button
                    type="text"
                    className="h-6 w-6 rounded p-0 text-[--dip-text-color-45] hover:bg-[rgba(0,0,0,0.06)]"
                    icon={<SwapOutlined className="text-base" />}
                    onClick={() => setSelectAppAccountModalOpen(true)}
                  >
                    <span className="sr-only">
                      {intl.get('digitalHuman.appAccountModal.switch')}
                    </span>
                  </Button>
                </Tooltip>
                <Tooltip title={intl.get('digitalHuman.appAccountModal.delete')}>
                  <Button
                    type="text"
                    className="h-6 w-6 rounded p-0 text-[--dip-text-color-45] hover:bg-[rgba(0,0,0,0.06)]"
                    icon={<DeleteOutlined className="text-base" />}
                    onClick={handleDeleteAppAccount}
                  >
                    <span className="sr-only">
                      {intl.get('digitalHuman.appAccountModal.delete')}
                    </span>
                  </Button>
                </Tooltip>
              </div>
            )}
          </div>
          {bkn.length > 0 && !readonly && (
            <Button
              color="primary"
              icon={<IconFont type="icon-add" />}
              onClick={handleSelectKnowledge}
              variant="outlined"
            >
              {intl.get('digitalHuman.knowledge.addButton')}
            </Button>
          )}
        </div>
      </div>
      {!appAccount && bkn.length > 0 && (
        <div className="mb-3 flex h-10 items-center rounded-lg border border-[#bae0ff] bg-[#e6f4ff] px-3 text-sm leading-8 text-[--dip-text-color]">
          <InfoCircleFilled className="mr-2 shrink-0 text-[#1677ff]" />
          <span className="min-w-0 flex-1 truncate">
            {intl.get('digitalHuman.appAccountModal.unboundKnowledgeWarning')}
          </span>
          {!readonly && (
            <Button
              type="link"
              className="h-[22px] px-0 text-sm"
              onClick={() => setSelectAppAccountModalOpen(true)}
            >
              {intl.get('digitalHuman.appAccountModal.bindNow')}
            </Button>
          )}
        </div>
      )}
      <Table<BknEntry>
        dataSource={bkn}
        columns={knowledgeColumns}
        pagination={false}
        className={styles['knowledge-table']}
        rowKey={(record) => record.id}
        bordered={false}
        size="small"
        scroll={{ y: 'max(246px, calc(100vh - 299px))' }}
        locale={{
          emptyText: (
            <Empty type="empty" title={intl.get('digitalHuman.knowledge.emptyNoKnowledge')}>
              {readonly ? undefined : (
                <Button
                  icon={<IconFont type="icon-add" />}
                  color="primary"
                  variant="outlined"
                  onClick={handleSelectKnowledge}
                >
                  {intl.get('digitalHuman.knowledge.addButton')}
                </Button>
              )}
            </Empty>
          ),
        }}
      />

      <SelectAppAccountModal
        open={selectAppAccountModalOpen}
        onOk={handleSelectAppAccountResult}
        onCancel={() => setSelectAppAccountModalOpen(false)}
        onCreate={() => setCreateAppAccountModalOpen(true)}
        defaultSelectedId={appAccount?.id}
      />

      <CreateAppAccountModal
        open={createAppAccountModalOpen}
        onOk={handleCreateAppAccountResult}
        onCancel={() => setCreateAppAccountModalOpen(false)}
      />

      {/* 选择知识网络弹窗 */}
      <SelectKnowledgeModal
        open={selectKnowledgeModalOpen}
        onOk={handleSelectKnowledgeResult}
        onCancel={() => setSelectKnowledgeModalOpen(false)}
        defaultSelectedIds={bkn.map((item) => item.id) || []}
      />

      <ConfigureAppPolicyModal
        open={policyModalOpen}
        appAccountId={appAccount?.id}
        networks={pendingPolicyBkn}
        onOk={() => {
          updateBkn(pendingBkn)
          setPolicyModalOpen(false)
          setPendingBkn([])
          setPendingPolicyBkn([])
        }}
        onCancel={() => {
          setPolicyModalOpen(false)
          setPendingBkn([])
          setPendingPolicyBkn([])
        }}
      />
    </ScrollBarContainer>
  )
}

export default memo(KnowledgeConfig)

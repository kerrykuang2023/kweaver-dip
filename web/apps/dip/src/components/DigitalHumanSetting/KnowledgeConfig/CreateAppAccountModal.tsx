import type { ModalProps } from 'antd'
import { Form, Input, Modal, message } from 'antd'
import intl from 'react-intl-universal'
import type { AppAccount } from '@/apis'
import { createAppAccount, createAppToken } from '@/apis'

export interface CreateAppAccountResult {
  account: AppAccount
  token: string
}

export interface CreateAppAccountModalProps extends Omit<ModalProps, 'onCancel' | 'onOk'> {
  onOk: (result: CreateAppAccountResult) => void
  onCancel: () => void
}

const CreateAppAccountModal = ({ open, onOk, onCancel }: CreateAppAccountModalProps) => {
  const [form] = Form.useForm<{ name: string }>()
  const [messageApi, contextHolder] = message.useMessage()

  const handleOk = async () => {
    const values = await form.validateFields()
    try {
      const name = values.name.trim()
      const account = await createAppAccount({ name, password: '' })
      const token = await createAppToken({ id: account.id })
      onOk({
        account: {
          id: account.id,
          name,
          credential_type: 'token',
        },
        token: token.token,
      })
      form.resetFields()
    } catch (err: any) {
      messageApi.error(err?.description || intl.get('digitalHuman.appAccountModal.createFailed'))
    }
  }

  return (
    <Modal
      title={intl.get('digitalHuman.appAccountModal.createTitle')}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      centered
      destroyOnHidden
      mask={{ closable: false }}
      okText={intl.get('global.ok')}
      cancelText={intl.get('global.cancel')}
      afterClose={() => form.resetFields()}
    >
      {contextHolder}
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label={intl.get('digitalHuman.appAccountModal.nameLabel')}
          rules={[
            {
              required: true,
              whitespace: true,
              message: intl.get('digitalHuman.appAccountModal.nameRequired'),
            },
          ]}
        >
          <Input placeholder={intl.get('digitalHuman.appAccountModal.namePlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default CreateAppAccountModal

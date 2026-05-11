import { Form, Input, Modal, message } from 'antd'
import md5 from 'md5'
import { pki } from 'node-forge'
import { useEffect, useState } from 'react'
import intl from 'react-intl-universal'
import { getPasswordConfig, type ModifyPasswordRequest, modifyPassword } from '@/apis'
import styles from './index.module.less'
import {
  getChangePasswordErrorMessage,
  getPasswordMinLength,
  getPasswordPolicy,
  isPasswordValid,
  PASSWORD_MAX_LENGTH,
  type PasswordPolicy,
} from './utils'

interface ChangePasswordModalProps {
  open: boolean
  account: string
  onCancel: () => void
  onSuccess: () => void
}

interface ChangePasswordFormValues {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

const PublicKey: any = pki.publicKeyFromPem(`-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDB2fhLla9rMx+6LWTXajnK11Kd
p520s1Q+TfPfIXI/7G9+L2YC4RA3M5rgRi32s5+UFQ/CVqUFqMqVuzaZ4lw/uEdk
1qHcP0g6LB3E9wkl2FclFR0M+/HrWmxPoON+0y/tFQxxfNgsUodFzbdh0XY1rIVU
IbPLvufUBbLKXHDPpwIDAQAB
-----END PUBLIC KEY-----`)

const ChangePasswordModal = ({ open, account, onCancel, onSuccess }: ChangePasswordModalProps) => {
  const [form] = Form.useForm<ChangePasswordFormValues>()
  const [messageApi, messageContextHolder] = message.useMessage()
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const passwordMinLength = passwordPolicy ? getPasswordMinLength(passwordPolicy) : 0

  useEffect(() => {
    let ignore = false

    async function loadPasswordConfig() {
      setErrorMessage('')
      setPasswordPolicy(null)

      try {
        const passwordConfig = await getPasswordConfig()
        if (!ignore) {
          setPasswordPolicy(getPasswordPolicy(passwordConfig))
        }
      } catch {
        if (!ignore) {
          Modal.warning({
            title: intl.get('changePassword.title'),
            content: intl.get('changePassword.errors.configLoadFailed'),
            okText: intl.get('global.ok'),
          })
          onCancel()
        }
      }
    }

    if (open) {
      loadPasswordConfig()
    } else {
      form.resetFields()
      setPasswordPolicy(null)
      setSubmitting(false)
    }

    return () => {
      ignore = true
    }
  }, [form, open])

  const handleSubmit = async (values: ChangePasswordFormValues) => {
    if (!account) {
      const messageText = intl.get('changePassword.errors.accountUnavailable')
      setErrorMessage(messageText)
      messageApi.error(messageText)
      return
    }

    if (!passwordPolicy) {
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    try {
      const body: ModifyPasswordRequest = {
        account,
        newpwd: btoa(PublicKey.encrypt(values.newPassword, 'RSAES-PKCS1-V1_5')),
        oldpwd: btoa(PublicKey.encrypt(values.oldPassword, 'RSAES-PKCS1-V1_5')),
      }

      const sign = md5(`${JSON.stringify(body)}eisoo.com`)
      await modifyPassword(body, sign)
      messageApi.success(intl.get('changePassword.success'))
      onSuccess()
    } catch (error) {
      setErrorMessage(getChangePasswordErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (!(open && passwordPolicy)) {
    return messageContextHolder
  }

  return (
    <>
      {messageContextHolder}
      <Modal
        title={intl.get('changePassword.title')}
        open={open}
        onCancel={onCancel}
        maskClosable={false}
        destroyOnHidden
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={intl.get('global.ok')}
        cancelText={intl.get('global.cancel')}
        footer={(_, { OkBtn, CancelBtn }) => (
          <>
            <OkBtn />
            <CancelBtn />
          </>
        )}
        width={624}
      >
        <div className={styles.policyTip}>
          {passwordPolicy.strongPasswordStatus
            ? intl.get('changePassword.strongPolicyTip', {
                length: passwordPolicy.strongPasswordLength,
              })
            : intl.get('changePassword.policyTip')}
        </div>
        <Form
          form={form}
          layout="horizontal"
          labelAlign="left"
          labelCol={{ span: 5 }}
          wrapperCol={{ span: 19 }}
          autoComplete="off"
          onFinish={handleSubmit}
        >
          <Form.Item label={intl.get('changePassword.account')}>
            <span className={styles.account}>{account || '-'}</span>
          </Form.Item>
          <Form.Item
            label={intl.get('changePassword.oldPassword')}
            name="oldPassword"
            rules={[
              {
                required: true,
                message: intl.get('changePassword.validation.oldPasswordRequired'),
              },
              {
                max: PASSWORD_MAX_LENGTH,
                message: intl.get('changePassword.errors.oldPasswordIncorrect'),
              },
            ]}
          >
            <Input.Password
              autoComplete="off"
              visibilityToggle={false}
              placeholder={intl.get('changePassword.placeholder.oldPassword')}
            />
          </Form.Item>
          <Form.Item
            label={intl.get('changePassword.newPassword')}
            name="newPassword"
            rules={[
              {
                required: true,
                message: intl.get('changePassword.validation.newPasswordRequired'),
              },
              {
                validator: (_, value?: string) => {
                  if (!value) return Promise.resolve()
                  if (value === form.getFieldValue('oldPassword')) {
                    return Promise.reject(
                      new Error(intl.get('changePassword.validation.samePassword')),
                    )
                  }
                  if (!isPasswordValid(value, passwordPolicy, passwordMinLength)) {
                    return Promise.reject(
                      new Error(intl.get('changePassword.errors.newPasswordInvalid')),
                    )
                  }
                  return Promise.resolve()
                },
              },
            ]}
          >
            <Input.Password
              autoComplete="off"
              visibilityToggle={false}
              placeholder={intl.get('changePassword.placeholder.newPassword')}
            />
          </Form.Item>
          <Form.Item
            label={intl.get('changePassword.confirmPassword')}
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              {
                required: true,
                message: intl.get('changePassword.validation.confirmPasswordRequired'),
              },
              {
                validator: (_, value?: string) => {
                  if (!value || value === form.getFieldValue('newPassword')) {
                    return Promise.resolve()
                  }
                  return Promise.reject(
                    new Error(intl.get('changePassword.validation.confirmPasswordMismatch')),
                  )
                },
              },
            ]}
          >
            <Input.Password
              autoComplete="off"
              visibilityToggle={false}
              placeholder={intl.get('changePassword.placeholder.confirmPassword')}
            />
          </Form.Item>
        </Form>
        {errorMessage ? <div className={styles.errorText}>{errorMessage}</div> : null}
      </Modal>
    </>
  )
}

export default ChangePasswordModal

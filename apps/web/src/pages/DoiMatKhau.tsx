import { useState } from 'react';
import { Alert, Button, Card, Form, Input } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export default function DoiMatKhau() {
  const { nguoiDung } = useAuth();
  const nav = useNavigate();
  const [loi, setLoi] = useState<string>();
  const [thanhCong, setThanhCong] = useState(false);
  const [dangGui, setDangGui] = useState(false);

  const gui = async (v: { currentPassword: string; password: string; passwordConfirmation: string }) => {
    setLoi(undefined);
    setDangGui(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: {
          currentPassword: v.currentPassword,
          password: v.password,
          passwordConfirmation: v.passwordConfirmation,
        },
      });
      setThanhCong(true);
    } catch (e) {
      setLoi((e as Error).message);
    } finally {
      setDangGui(false);
    }
  };

  if (!nguoiDung) return null;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <Card className="card-mem" title="Đổi mật khẩu">
        {thanhCong ? (
          <div>
            <Alert type="success" showIcon message="Đổi mật khẩu thành công!" style={{ marginBottom: 16 }} />
            <Button type="primary" onClick={() => nav('/')}>
              Về trang chủ
            </Button>
          </div>
        ) : (
          <>
            {loi && <Alert type="error" showIcon message={loi} style={{ marginBottom: 16 }} />}
            <Form layout="vertical" size="large" onFinish={gui} requiredMark={false}>
              <Form.Item
                name="currentPassword"
                label="Mật khẩu hiện tại"
                rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu hiện tại" autoComplete="current-password" />
              </Form.Item>
              <Form.Item
                name="password"
                label="Mật khẩu mới"
                rules={[
                  { required: true, message: 'Nhập mật khẩu mới' },
                  { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu mới" autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                name="passwordConfirmation"
                label="Xác nhận mật khẩu mới"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Xác nhận mật khẩu mới' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) return Promise.resolve();
                      return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Xác nhận mật khẩu mới" autoComplete="new-password" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={dangGui} style={{ height: 44 }}>
                  Đổi mật khẩu
                </Button>
              </Form.Item>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
}

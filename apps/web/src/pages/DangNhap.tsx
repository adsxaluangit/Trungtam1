import { useState } from 'react';
import { Alert, Button, Form, Input } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { NguoiDung, useAuth } from '../auth';

interface DangNhapResponse {
  jwt: string;
  user: NguoiDung;
}

export default function DangNhap() {
  const { dangNhap } = useAuth();
  const nav = useNavigate();
  const [loi, setLoi] = useState<string>();
  const [dangGui, setDangGui] = useState(false);

  const gui = async (v: { identifier: string; password: string }) => {
    setLoi(undefined);
    setDangGui(true);
    try {
      const r = await api<DangNhapResponse>('/auth/local', {
        method: 'POST',
        body: { identifier: v.identifier, password: v.password },
      });
      dangNhap(r.jwt, r.user);
      nav('/tong-quan', { replace: true });
    } catch (e) {
      setLoi((e as Error).message);
    } finally {
      setDangGui(false);
    }
  };

  return (
    <main className="dang-nhap">
      <section className="hero">
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(255, 255, 255, 0.95)',
              padding: '8px 16px',
              borderRadius: 12,
              marginBottom: 18,
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #1677ff, #0958d9)',
                display: 'grid',
                placeItems: 'center',
                padding: 4,
              }}
            >
              <img
                src="/logo.png"
                alt="Logo MIC1"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <span style={{ color: '#0958d9', fontWeight: 700, fontSize: 13.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              PTNL – Trường CĐ Hàng hải và Đường thủy I
            </span>
          </div>
          <h2>Trung tâm Đào tạo Phát triển nguồn lực</h2>
          <p>Hệ thống Quản lý Đào tạo – Học viên, Giảng viên, Lớp học tập trung, chính xác và cập nhật theo thời gian thực.</p>
        </div>
      </section>
      <section className="ben-phai">
        <div className="the-dang-nhap">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: 'linear-gradient(135deg,#1677ff,#0958d9)',
                display: 'grid',
                placeItems: 'center',
                padding: 7,
                boxShadow: '0 4px 12px rgba(22,119,255,0.3)',
                flex: 'none',
              }}
            >
              <img
                src="/logo.png"
                alt="Logo PTNL"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1677ff', textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1.35 }}>
                PTNL – Trung tâm Đào tạo Phát triển nguồn lực
              </div>
              <h1 style={{ margin: '2px 0 0', fontSize: 22, color: '#0f1f3d' }}>Đăng nhập</h1>
            </div>
          </div>
          <div className="phu">Hệ thống Quản lý Đào tạo – Đăng nhập để tiếp tục</div>
          {loi && <Alert type="error" showIcon message={loi} style={{ marginBottom: 16 }} />}
          <Form layout="vertical" size="large" onFinish={gui} requiredMark={false}>
            <Form.Item
              name="identifier"
              label="Email hoặc Tên đăng nhập"
              rules={[{ required: true, message: 'Nhập email hoặc tên đăng nhập' }]}
            >
              <Input
                id="ten-dang-nhap"
                prefix={<UserOutlined />}
                placeholder="Email hoặc tên đăng nhập"
                autoComplete="username"
                autoFocus
              />
            </Form.Item>
            <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
              <Input.Password
                id="mat-khau"
                prefix={<LockOutlined />}
                placeholder="Mật khẩu"
                autoComplete="current-password"
              />
            </Form.Item>
            <Button id="nut-dang-nhap" type="primary" htmlType="submit" block loading={dangGui} style={{ height: 46, marginTop: 4 }}>
              Đăng nhập
            </Button>
          </Form>
        </div>
      </section>
    </main>
  );
}

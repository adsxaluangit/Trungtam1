import React, { useState } from 'react';
import { App, Avatar, Badge, Button, Dropdown, Layout, Menu, Tooltip } from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  DashboardOutlined,
  UserOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  FormOutlined,
  TrophyOutlined,
  BarChartOutlined,
  SearchOutlined,
  SettingOutlined,
  PrinterOutlined,
  KeyOutlined,
  LogoutOutlined,
  RobotOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { chuCaiDau, getRoleFromUser, isAdmin, NHAN_VAI_TRO } from '../constants';

const { Sider, Header, Content } = Layout;

interface MenuItemDef {
  key: string;
  icon: React.ReactNode;
  label: string;
  onlyAdmin?: boolean;
}

const MENU: MenuItemDef[] = [
  { key: '/tong-quan', icon: <DashboardOutlined />, label: 'Bảng điều khiển' },
  { key: '/hoc-vien', icon: <UserOutlined />, label: 'Quản lý học viên' },
  { key: '/danh-muc', icon: <AppstoreOutlined />, label: 'Danh mục' },
  { key: '/quyet-dinh', icon: <FileTextOutlined />, label: 'Quyết định mở lớp' },
  { key: '/phan-cong', icon: <CalendarOutlined />, label: 'Phân công giảng dạy' },
  { key: '/duyet-thi', icon: <CheckCircleOutlined />, label: 'Duyệt thi' },
  { key: '/nhap-diem', icon: <FormOutlined />, label: 'Nhập điểm' },
  { key: '/cong-nhan', icon: <TrophyOutlined />, label: 'Quyết định công nhận' },
  { key: '/thong-ke', icon: <BarChartOutlined />, label: 'Thống kê' },
  { key: '/tra-cuu', icon: <SearchOutlined />, label: 'Tra cứu' },
  { key: '/quan-tri', icon: <SettingOutlined />, label: 'Quản trị hệ thống', onlyAdmin: true },
  { key: '/mau-in', icon: <PrinterOutlined />, label: 'Mẫu in', onlyAdmin: true },
  { key: '/cau-hinh-ai', icon: <RobotOutlined />, label: 'Cấu hình AI', onlyAdmin: true },
];

const TIEU_DE: [RegExp, string][] = [
  [/^\/tong-quan/, 'Bảng điều khiển'],
  [/^\/hoc-vien/, 'Quản lý học viên'],
  [/^\/danh-muc/, 'Danh mục hệ thống'],
  [/^\/quyet-dinh/, 'Quyết định mở lớp'],
  [/^\/phan-cong/, 'Phân công giảng dạy'],
  [/^\/duyet-thi/, 'Duyệt thi tốt nghiệp'],
  [/^\/nhap-diem/, 'Nhập điểm kết thúc môn'],
  [/^\/cong-nhan/, 'Quyết định công nhận tốt nghiệp'],
  [/^\/thong-ke/, 'Thống kê đào tạo'],
  [/^\/tra-cuu/, 'Tra cứu hồ sơ học viên'],
  [/^\/quan-tri/, 'Quản trị hệ thống'],
  [/^\/mau-in/, 'Quản lý mẫu in'],
  [/^\/cau-hinh-ai/, 'Cấu hình AI Provider'],
  [/^\/doi-mat-khau/, 'Đổi mật khẩu'],
];

export default function AppLayout() {
  const { message } = App.useApp();
  const { nguoiDung, dangXuat } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [dangSaoLuu, setDangSaoLuu] = useState(false);

  const userIsAdmin = isAdmin(nguoiDung || undefined);
  const userRole = getRoleFromUser(nguoiDung || undefined);

  const handleManualBackup = async () => {
    if (dangSaoLuu) return;
    setDangSaoLuu(true);
    try {
      const res = await api<any>('/backup', { method: 'POST' });
      message.success(
        `Đã sao lưu CSDL thành công: ${res?.file || 'backup.sql'} (${res?.sizeKB || 0} KB). Đang lưu ${res?.totalBackups || 1} bản trong thư mục backups`,
      );
    } catch (err: any) {
      message.error('Sao lưu CSDL thất bại: ' + (err?.message || 'Lỗi kết nối'));
    } finally {
      setDangSaoLuu(false);
    }
  };

  // Lấy số lượng học viên chưa duyệt để hiển thị Badge
  const unapprovedQuery = useQuery({
    queryKey: ['unapproved-students-count'],
    refetchInterval: 60_000,
    queryFn: async () => {
      try {
        const res = await api<any>(
          '/students?filters[is_approved][$ne]=true&pagination[page]=1&pagination[pageSize]=1&publicationState=preview',
        );
        return res?.meta?.pagination?.total || 0;
      } catch {
        return 0;
      }
    },
  });

  if (!nguoiDung) return null;

  const items = MENU.filter((m) => !m.onlyAdmin || userIsAdmin).map(({ key, icon, label }) => ({
    key,
    icon,
    label:
      key === '/hoc-vien' ? (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{label}</span>
          <Badge
            count={unapprovedQuery.data ?? 0}
            size="small"
            style={{ backgroundColor: '#ef4444' }}
            offset={[-4, 0]}
          />
        </span>
      ) : (
        label
      ),
  }));

  const chon =
    items
      .map((i) => i.key)
      .filter((k) => (k === '/' ? loc.pathname === '/' : loc.pathname.startsWith(k)))
      .sort((a, b) => b.length - a.length)[0] ?? '';

  const tieuDe = TIEU_DE.find(([re]) => re.test(loc.pathname))?.[1] ?? 'TRUNG TÂM – Trung tâm Đào tạo Phát triển nguồn lực';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={260} breakpoint="lg" collapsedWidth={72} className="sider">
        <Tooltip title="Trung tâm Đào tạo Phát triển nguồn lực (TRUNG TÂM)" placement="right">
          <div className="logo" onClick={() => nav('/tong-quan')} style={{ cursor: 'pointer' }}>
            <div
              style={{
                width: 42,
                height: 42,
                background: 'linear-gradient(135deg, #1677ff, #0958d9)',
                borderRadius: 10,
                display: 'grid',
                placeItems: 'center',
                padding: 5,
                boxShadow: '0 4px 12px rgba(22, 119, 255, 0.4)',
                flex: 'none',
              }}
            >
              <img
                src="/logo.png"
                alt="Logo TRUNG TÂM"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <b style={{ fontSize: 16, display: 'block', lineHeight: 1.25, color: '#ffffff' }}>TRUNG TÂM</b>
              <small
                style={{
                  fontSize: 11,
                  color: '#94a3b8',
                  lineHeight: 1.2,
                  display: 'block',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                TT Đào tạo Phát triển nguồn lực
              </small>
            </div>
          </div>
        </Tooltip>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[chon]}
          items={items}
          onClick={(e) => nav(e.key)}
        />
      </Sider>

      <Layout>
        <Header className="header">
          <h1>{tieuDe}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {(userIsAdmin || userRole === 'MANAGER') && (
              <Tooltip title="Sao lưu dữ liệu ngay lập tức vào thư mục backups (Tự động chạy 02:00 sáng hàng ngày, giữ 7 bản gần nhất)">
                <Button
                  icon={<DatabaseOutlined />}
                  loading={dangSaoLuu}
                  onClick={handleManualBackup}
                  style={{
                    borderRadius: 8,
                    fontWeight: 600,
                    borderColor: '#10b981',
                    color: '#059669',
                    background: '#ecfdf5',
                  }}
                >
                  Sao lưu CSDL
                </Button>
              </Tooltip>
            )}

            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'mk',
                    icon: <KeyOutlined />,
                    label: 'Đổi mật khẩu',
                    onClick: () => nav('/doi-mat-khau'),
                  },
                  { type: 'divider' as const },
                  {
                    key: 'out',
                    icon: <LogoutOutlined />,
                    label: 'Đăng xuất',
                    danger: true,
                    onClick: () => {
                      dangXuat();
                      nav('/dang-nhap', { replace: true });
                    },
                  },
                ],
              }}
            >
              <div className="user-chip" id="menu-nguoi-dung">
                <div className="ten">
                  <b>{nguoiDung.username}</b>
                  <small>{NHAN_VAI_TRO[userRole]}</small>
                </div>
                <Avatar style={{ background: 'linear-gradient(135deg, #1677ff, #0958d9)' }}>
                  {chuCaiDau(nguoiDung.username)}
                </Avatar>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="content" key={loc.pathname}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

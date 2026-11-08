import { useEffect, useState } from 'react';
import {
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { api } from '../api';

const { Title, Text } = Typography;

const PERMISSIONS_LIST = [
  { id: 'view_dashboard', label: 'Xem Bảng điều khiển & Thống kê' },
  { id: 'manage_students', label: 'Quản lý Học viên' },
  { id: 'manage_classes', label: 'Quản lý Danh mục & Lớp học' },
  { id: 'manage_decisions', label: 'Quản lý Quyết định (Mở lớp, Công nhận)' },
  { id: 'exam_approval', label: 'Duyệt điều kiện dự thi & In danh sách' },
  { id: 'manage_grades', label: 'Nhập & Quản lý Điểm số' },
  { id: 'manage_users', label: 'Quản trị Người dùng & Hệ thống' },
];

export default function QuanTri() {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);

  // Create User Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);

  // Edit User Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm] = Form.useForm();
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    loadUsersAndRoles();
  }, []);

  const loadUsersAndRoles = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api<any[]>('/users?populate=role'),
        api<any>('/users-permissions/roles'),
      ]);

      const rawUsers = Array.isArray(usersRes) ? usersRes : [];
      setUsers(rawUsers);

      const rawRoles = rolesRes?.roles || (Array.isArray(rolesRes) ? rolesRes : []);
      setAvailableRoles(rawRoles);
    } catch (err: any) {
      message.error('Lỗi khi tải dữ liệu người dùng: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (values: any) => {
    setCreating(true);
    try {
      // Find role id
      let roleId = values.role;
      if (!roleId && availableRoles.length > 0) {
        const defaultRole = availableRoles.find((r) => r.type === 'authenticated') || availableRoles[0];
        roleId = defaultRole.id;
      }

      await api('/users', {
        method: 'POST',
        body: {
          username: values.username,
          email: values.email,
          password: values.password,
          role: roleId,
          blocked: false,
          confirmed: true,
          permissions: values.permissions || [],
        },
      });

      message.success('Đã tạo tài khoản người dùng mới thành công!');
      setIsCreateModalOpen(false);
      createForm.resetFields();
      await loadUsersAndRoles();
    } catch (err: any) {
      message.error('Tạo người dùng thất bại: ' + (err.message || ''));
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    editForm.setFieldsValue({
      username: user.username,
      email: user.email,
      role: user.role?.id,
      blocked: user.blocked || false,
      permissions: user.permissions || [],
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (values: any) => {
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const payload: any = {
        email: values.email,
        blocked: values.blocked,
        permissions: values.permissions || [],
      };
      if (values.role) payload.role = values.role;
      if (values.password) payload.password = values.password;

      await api(`/users/${editingUser.id}`, {
        method: 'PUT',
        body: payload,
      });

      message.success('Cập nhật người dùng thành công!');
      setIsEditModalOpen(false);
      setEditingUser(null);
      await loadUsersAndRoles();
    } catch (err: any) {
      message.error('Cập nhật thất bại: ' + (err.message || ''));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    try {
      await api(`/users/${user.id}`, {
        method: 'DELETE',
      });
      message.success(`Đã xóa tài khoản "${user.username}"!`);
      await loadUsersAndRoles();
    } catch (err: any) {
      message.error('Xóa người dùng thất bại: ' + (err.message || ''));
    }
  };

  // User role counts
  const adminCount = users.filter((u) => u.role?.name?.toLowerCase().includes('admin')).length;
  const teacherCount = users.filter((u) => u.role?.name?.toLowerCase().includes('teacher') || u.role?.name?.toLowerCase().includes('giảng')).length;
  const otherCount = users.length - adminCount - teacherCount;

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space align="center" size="middle">
              <SettingOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Quản trị Hệ thống & Người dùng
                </Title>
                <Text type="secondary">
                  Quản lý tài khoản đăng nhập, phân quyền thao tác và vai trò người dùng trong hệ thống
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadUsersAndRoles}>
                Làm mới
              </Button>
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  const defaultRole = availableRoles.find((r) => r.type === 'authenticated') || availableRoles[0];
                  createForm.setFieldsValue({
                    role: defaultRole?.id,
                    permissions: ['view_dashboard', 'manage_students', 'manage_classes'],
                  });
                  setIsCreateModalOpen(true);
                }}
              >
                Tạo người dùng mới
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Quản trị viên (Admin)"
              value={adminCount}
              prefix={<SafetyCertificateOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Quản lý đào tạo (Manager)"
              value={otherCount}
              prefix={<KeyOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Giảng viên & Khách"
              value={teacherCount}
              prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Users Table */}
      <Card title="Danh sách tài khoản hệ thống">
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : users.length === 0 ? (
          <Empty description="Không có người dùng nào." />
        ) : (
          <Table
            dataSource={users}
            rowKey="id"
            pagination={{ pageSize: 10, showTotal: (t) => `Tổng số ${t} tài khoản` }}
            columns={[
              {
                title: 'STT',
                width: 50,
                align: 'center',
                render: (_, __, idx) => idx + 1,
              },
              {
                title: 'Tài khoản',
                key: 'user',
                render: (_, record) => (
                  <Space align="center">
                    <Avatar
                      style={{
                        backgroundColor: record.blocked ? '#d9d9d9' : '#1677ff',
                        verticalAlign: 'middle',
                      }}
                    >
                      {(record.username || 'U').charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                      <div style={{ fontWeight: 600 }}>{record.username}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.email}
                      </Text>
                    </div>
                  </Space>
                ),
              },
              {
                title: 'Vai trò (Role)',
                dataIndex: 'role',
                width: 180,
                render: (role) => {
                  const name = role?.name || 'Authenticated';
                  const lower = name.toLowerCase();
                  let color = 'default';
                  if (lower.includes('admin')) color = 'error';
                  else if (lower.includes('manager') || lower.includes('đào tạo')) color = 'processing';
                  else color = 'success';

                  return <Tag color={color}>{name.toUpperCase()}</Tag>;
                },
              },
              {
                title: 'Quyền hạn',
                dataIndex: 'permissions',
                render: (perms, record) => {
                  if (record.role?.name?.toLowerCase().includes('admin')) {
                    return <Tag color="red">Toàn quyền hệ thống</Tag>;
                  }
                  if (!perms || perms.length === 0) {
                    return <Text type="secondary">Mặc định theo vai trò</Text>;
                  }
                  return (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {perms.length} quyền được cấp
                    </Text>
                  );
                },
              },
              {
                title: 'Trạng thái',
                dataIndex: 'blocked',
                width: 130,
                align: 'center',
                render: (blocked) =>
                  blocked ? (
                    <Tag color="default" icon={<CloseCircleOutlined />}>
                      Đã khóa
                    </Tag>
                  ) : (
                    <Tag color="success" icon={<CheckCircleOutlined />}>
                      Hoạt động
                    </Tag>
                  ),
              },
              {
                title: 'Hành động',
                width: 160,
                render: (_, record) => (
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openEditModal(record)}
                    >
                      Sửa quyền
                    </Button>
                    <Popconfirm
                      title="Xóa tài khoản này?"
                      description={`Bạn có chắc muốn xóa vĩnh viễn user "${record.username}"?`}
                      onConfirm={() => handleDeleteUser(record)}
                      okText="Xóa"
                      cancelText="Hủy"
                      okButtonProps={{ danger: true }}
                    >
                      <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                        Xóa
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* Modal Tạo Người Dùng */}
      <Modal
        title={
          <Space>
            <UserAddOutlined style={{ color: '#1677ff' }} />
            <span>Tạo tài khoản người dùng mới</span>
          </Space>
        }
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        forceRender
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateUser}
          onFinishFailed={(errInfo) => {
            const firstErr = errInfo.errorFields?.[0]?.errors?.[0];
            if (firstErr) message.warning(firstErr);
          }}
          initialValues={{
            role: availableRoles[0]?.id,
            permissions: ['view_dashboard', 'manage_students', 'manage_classes'],
          }}
        >
          <Form.Item
            name="username"
            label="Tên đăng nhập"
            rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Ví dụ: nguyenvanan" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Địa chỉ Email"
            rules={[
              { required: true, message: 'Vui lòng nhập email!' },
              { type: 'email', message: 'Email không hợp lệ!' },
            ]}
          >
            <Input placeholder="Ví dụ: an.nv@edumaster.vn" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu khởi tạo"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu!' },
              { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự!' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu tối thiểu 6 ký tự" />
          </Form.Item>

          <Form.Item name="role" label="Vai trò (Role)" rules={[{ required: true }]}>
            <Select placeholder="Chọn vai trò">
              {availableRoles.map((r) => (
                <Select.Option key={r.id} value={r.id}>
                  {r.name} ({r.type})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="permissions" label="Phân quyền chi tiết">
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[8, 8]}>
                {PERMISSIONS_LIST.map((p) => (
                  <Col span={24} key={p.id}>
                    <Checkbox value={p.id}>{p.label}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Row justify="end" gutter={8} style={{ marginTop: 16 }}>
            <Col>
              <Button onClick={() => setIsCreateModalOpen(false)}>Hủy</Button>
            </Col>
            <Col>
              <Button type="primary" htmlType="submit" loading={creating}>
                Tạo tài khoản
              </Button>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal Sửa Người Dùng */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: '#1677ff' }} />
            <span>Chỉnh sửa tài khoản: {editingUser?.username}</span>
          </Space>
        }
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingUser(null);
        }}
        footer={null}
        forceRender
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleSaveEdit}
          onFinishFailed={(errInfo) => {
            const firstErr = errInfo.errorFields?.[0]?.errors?.[0];
            if (firstErr) message.warning(firstErr);
          }}
        >
          <Form.Item name="username" label="Tên đăng nhập">
            <Input disabled />
          </Form.Item>

          <Form.Item
            name="email"
            label="Địa chỉ Email"
            rules={[
              { required: true, message: 'Vui lòng nhập email!' },
              { type: 'email', message: 'Email không hợp lệ!' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="password"
            label="Đổi mật khẩu mới (để trống nếu giữ nguyên)"
            rules={[{ min: 6, message: 'Mật khẩu tối thiểu 6 ký tự!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu mới nếu muốn đổi" />
          </Form.Item>

          <Form.Item name="role" label="Vai trò (Role)">
            <Select placeholder="Chọn vai trò">
              {availableRoles.map((r) => (
                <Select.Option key={r.id} value={r.id}>
                  {r.name} ({r.type})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="blocked" label="Khóa tài khoản" valuePropName="checked">
            <Switch checkedChildren="Khóa" unCheckedChildren="Hoạt động" />
          </Form.Item>

          <Form.Item name="permissions" label="Phân quyền chi tiết">
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[8, 8]}>
                {PERMISSIONS_LIST.map((p) => (
                  <Col span={24} key={p.id}>
                    <Checkbox value={p.id}>{p.label}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Row justify="end" gutter={8} style={{ marginTop: 16 }}>
            <Col>
              <Button onClick={() => setIsEditModalOpen(false)}>Hủy</Button>
            </Col>
            <Col>
              <Button type="primary" htmlType="submit" loading={savingEdit}>
                Lưu thay đổi
              </Button>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

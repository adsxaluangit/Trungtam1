import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Space,
  Table,
  Tag,
} from 'antd';
import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SolutionOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api, COLLECTIONS, normalizeStrapiList } from '../api';
import { fmtNgay, MAU_TRANG_THAI_LOP } from '../constants';
import dayjs from 'dayjs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Activity {
  id: string;
  text: string;
  time: string;
  type: 'OPENING' | 'RECOGNITION';
}

/** Chuyển khoảng thời gian (ms) sang chuỗi "X phút/giờ/ngày trước" */
function timeAgo(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} giờ trước`;
  return `${Math.floor(diffMin / 1440)} ngày trước`;
}

export default function TongQuan() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const nav = useNavigate();

  // ─── 1. Thống kê tổng quan (dựa vào decisions) ───────────────────────────
  const statsQuery = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [studentsRes, teachersRes, decisionsRes] = await Promise.all([
        api<any>(`/students?pagination[pageSize]=1&publicationState=preview`),
        api<any>(`/teachers?pagination[pageSize]=1&publicationState=preview`),
        api<any>(
          `/${COLLECTIONS.CLASS_DECISIONS}?populate[school_class]=true&populate[students][fields][0]=id&populate[related_decision]=true&sort=updatedAt:desc&pagination[pageSize]=300&publicationState=preview`,
        ),
      ]);

      const totalStudents: number = studentsRes?.meta?.pagination?.total ?? 0;
      const totalTeachers: number = teachersRes?.meta?.pagination?.total ?? 0;

      const decisions: any[] = normalizeStrapiList(decisionsRes);

      // Các QĐ công nhận tốt nghiệp → lấy documentId của QĐ mở lớp liên quan
      const recognitionDecisions = decisions.filter((d) => d.type === 'RECOGNITION');
      const completedOpeningIds = new Set<string>(
        recognitionDecisions.map((d) => {
          const rel = d.related_decision?.data || d.related_decision;
          return String(rel?.documentId || rel?.id || '');
        }),
      );

      // Lớp đang mở: QĐ OPENING chưa có QĐ công nhận tương ứng
      const openClasses = decisions.filter((d) => {
        if (d.type !== 'OPENING') return false;
        const id = String(d.documentId || d.id);
        return !completedOpeningIds.has(id);
      });

      // Đã tốt nghiệp: tổng học viên trong tất cả QĐ công nhận
      let graduatedStudents = 0;
      recognitionDecisions.forEach((d) => {
        const studs = d.students;
        graduatedStudents += Array.isArray(studs)
          ? studs.length
          : (studs?.data?.length ?? studs?.count ?? 0);
      });

      // Biểu đồ theo tháng (năm hiện tại, QĐ mở lớp)
      const currentYear = new Date().getFullYear();
      const chartMap = new Map<number, number>();
      for (let i = 0; i < 12; i++) chartMap.set(i, 0);
      decisions.forEach((d) => {
        if (d.type !== 'OPENING') return;
        const date = new Date(d.signed_date || d.createdAt);
        if (date.getFullYear() !== currentYear) return;
        const month = date.getMonth(); // 0-11
        const cnt = Array.isArray(d.students)
          ? d.students.length
          : (d.students?.data?.length ?? d.students?.count ?? 0);
        chartMap.set(month, (chartMap.get(month) ?? 0) + cnt);
      });
      const chartData = Array.from(chartMap.entries()).map(([m, hv]) => ({
        month: `Tháng ${m + 1}`,
        'Học viên': hv,
      }));

      // Hoạt động gần đây: 5 QĐ cập nhật gần nhất
      const activities: Activity[] = decisions.slice(0, 5).map((d) => {
        const typeText = d.type === 'OPENING' ? 'mở lớp' : 'công nhận tốt nghiệp';
        const code = d.decision_number || '---';
        const className =
          d.school_class?.data?.attributes?.name || d.school_class?.name || '...';
        return {
          id: String(d.documentId || d.id),
          text: `QĐ #${code} ${typeText} – ${className}`,
          time: timeAgo(d.updatedAt || d.createdAt),
          type: d.type as 'OPENING' | 'RECOGNITION',
        };
      });

      return {
        totalStudents,
        totalTeachers,
        openClassesCount: openClasses.length,
        graduatedStudents,
        chartData,
        activities,
      };
    },
  });

  // ─── 2. Học viên chờ duyệt gần đây ──────────────────────────────────────
  const pendingStudentsQuery = useQuery({
    queryKey: ['pending-students-recent'],
    queryFn: async () => {
      const res = await api<any>(
        `/${COLLECTIONS.STUDENTS}?filters[is_approved][$ne]=true&sort=createdAt:desc&pagination[pageSize]=6&populate[school_class]=true&publicationState=preview`,
      );
      return normalizeStrapiList(res);
    },
  });

  // ─── 3. Lớp học (hiển thị bảng) ──────────────────────────────────────────
  const classesQuery = useQuery({
    queryKey: ['dashboard-classes'],
    queryFn: async () => {
      const res = await api<any>(
        `/${COLLECTIONS.CLASSES}?pagination[pageSize]=6&publicationState=preview`,
      );
      return normalizeStrapiList(res);
    },
  });

  // ─── Mutation duyệt nhanh học viên ───────────────────────────────────────
  const duyetMut = useMutation({
    mutationFn: async (documentId: string) => {
      return api(`/${COLLECTIONS.STUDENTS}/${documentId}`, {
        method: 'PUT',
        body: { data: { is_approved: true } },
      });
    },
    onSuccess: () => {
      message.success('Đã duyệt học viên thành công');
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['pending-students-recent'] });
      qc.invalidateQueries({ queryKey: ['unapproved-students-count'] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'Lỗi khi duyệt học viên');
    },
  });

  if (statsQuery.isLoading) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  const stats = statsQuery.data;

  // ─── Stat cards ──────────────────────────────────────────────────────────
  const statCards = [
    {
      title: 'Tổng học viên',
      value: stats?.totalStudents ?? 0,
      icon: <TeamOutlined />,
      color: '#1677ff',
      link: '/hoc-vien',
    },
    {
      title: 'Lớp đang mở',
      value: stats?.openClassesCount ?? 0,
      icon: <BookOutlined />,
      color: '#6366f1',
      link: '/quyet-dinh',
    },
    {
      title: 'Giảng viên',
      value: stats?.totalTeachers ?? 0,
      icon: <SolutionOutlined />,
      color: '#8b5cf6',
      link: '/danh-muc',
    },
    {
      title: 'Đã tốt nghiệp',
      value: stats?.graduatedStudents ?? 0,
      icon: <CheckCircleOutlined />,
      color: '#10b981',
      link: '/quyet-dinh',
    },
  ];

  // ─── Bảng học viên chờ duyệt ─────────────────────────────────────────────
  const pendingColumns = [
    {
      title: 'Họ và tên',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (text: string, r: any) => (
        <div>
          <b style={{ color: '#0f1f3d' }}>{text || r.fullName || '---'}</b>
          <div style={{ fontSize: 11, color: '#64748b' }}>CCCD: {r.id_number || r.student_code || '---'}</div>
        </div>
      ),
    },
    {
      title: 'Lớp đăng ký',
      dataIndex: 'school_class',
      key: 'school_class',
      render: (sc: any, r: any) => sc?.name || r.class_name || r.group || '---',
    },
    {
      title: 'SĐT',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 100,
      render: (_: any, r: any) => (
        <Button
          type="primary"
          size="small"
          loading={duyetMut.isPending}
          onClick={() => duyetMut.mutate(r.documentId || r.id)}
        >
          Duyệt
        </Button>
      ),
    },
  ];

  // ─── Bảng lớp học ────────────────────────────────────────────────────────
  const classColumns = [
    {
      title: 'Mã lớp',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (v: string) => <Tag color="blue">{v || '---'}</Tag>,
    },
    {
      title: 'Tên lớp học',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <b>{v}</b>,
    },
    {
      title: 'Khai giảng',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 120,
      render: (v: string) => fmtNgay(v) || '---',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (v: string) => (
        <Tag color={MAU_TRANG_THAI_LOP[v] || 'default'}>
          {v === 'active' || v === 'OPENING' ? 'Đang mở' : v || 'Chờ mở'}
        </Tag>
      ),
    },
  ];

  const activities: Activity[] = stats?.activities ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Stat cards */}
      <Row gutter={[16, 16]}>
        {statCards.map((c) => (
          <Col key={c.title} xs={24} sm={12} md={6} style={{ flex: 1 }}>
            <Card
              className="the-so card-mem"
              style={{ color: c.color, cursor: 'pointer' }}
              onClick={() => nav(c.link)}
            >
              <div className="icon" style={{ background: c.color }}>
                {c.icon}
              </div>
              <div className="so">{c.value}</div>
              <div className="nhan">{c.title}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 2. Biểu đồ + Hoạt động gần đây */}
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={16}>
          <Card
            className="card-mem"
            title={`Biểu đồ tăng trưởng học viên (Năm ${dayjs().year()})`}
            size="small"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats?.chartData ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="Học viên" fill="#1677ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            className="card-mem"
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#f59e0b' }} />
                <span>Hoạt động gần đây</span>
              </Space>
            }
            style={{ height: '100%' }}
            size="small"
          >
            {activities.length === 0 ? (
              <Empty description="Chưa có hoạt động nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {activities.map((act) => (
                  <div key={act.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {/* Colored dot */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: act.type === 'OPENING' ? '#1677ff' : '#10b981',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.4 }}>
                        {act.text}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {act.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 3. Chi tiết: Học viên chờ duyệt & Lớp học đang mở */}
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={12}>
          <Card
            className="card-mem"
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#ef4444' }} />
                <span>Học viên chờ duyệt mới nhất</span>
                {pendingStudentsQuery.data && pendingStudentsQuery.data.length > 0 ? (
                  <Badge
                    count={pendingStudentsQuery.data.length}
                    style={{ backgroundColor: '#ef4444' }}
                  />
                ) : null}
              </Space>
            }
            extra={<Link to="/hoc-vien">Xem tất cả</Link>}
          >
            <Table
              dataSource={pendingStudentsQuery.data ?? []}
              columns={pendingColumns}
              rowKey={(r) => r.documentId || r.id}
              pagination={false}
              size="small"
              locale={{
                emptyText: (
                  <Empty
                    description="Không có học viên chờ duyệt"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            className="card-mem"
            title={
              <Space>
                <BookOutlined style={{ color: '#1677ff' }} />
                <span>Danh sách lớp đào tạo</span>
              </Space>
            }
            extra={<Link to="/danh-muc">Quản lý lớp</Link>}
          >
            <Table
              dataSource={classesQuery.data ?? []}
              columns={classColumns}
              rowKey={(r) => r.documentId || r.id}
              pagination={false}
              size="small"
              locale={{
                emptyText: (
                  <Empty
                    description="Chưa có dữ liệu lớp học"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

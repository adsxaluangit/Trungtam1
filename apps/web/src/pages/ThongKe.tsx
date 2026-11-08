import { useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Progress,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { api, COLLECTIONS, normalizeStrapiList } from '../api';
import { fmtNgay } from '../constants';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface StatDecision {
  id: string;
  number: string;
  className: string;
  trainingCourse: string;
  signedDate: string;
  startDate: string;
  studentCount: number;
  status: 'Ongoing' | 'Completed';
  month: number;
  year: number;
  quarter: number;
  classId?: string;
}

export default function ThongKe() {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StatDecision[]>([]);
  const [uniqueClasses, setUniqueClasses] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(6, 'month'),
    dayjs(),
  ]);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api<any>(
        `/${COLLECTIONS.CLASS_DECISIONS}?populate[school_class]=true&populate[related_decision]=true&populate[students][fields][0]=id&publicationState=preview&pagination[limit]=1000`,
      );
      const allDecs = normalizeStrapiList(res);

      // Recognition decisions to identify finalized ones
      const recognitionDecisions = allDecs.filter((d: any) => d.type === 'RECOGNITION');
      const finalizedIds = new Set(
        recognitionDecisions
          .map((d: any) => {
            const rel = d.related_decision;
            return String(rel?.documentId || rel?.id || '');
          })
          .filter((id: string) => id !== ''),
      );

      const openingDecs = allDecs.filter((d: any) => d.type === 'OPENING');
      const classesMap = new Map<string, string>();

      const processed: StatDecision[] = openingDecs.map((d: any) => {
        const date = dayjs(d.signed_date || d.createdAt);
        const id = String(d.documentId || d.id);
        const cls = d.school_class || {};
        const clsId = String(cls.documentId || cls.id || '');
        const clsName = cls.name || 'Lớp chưa đặt tên';

        if (clsId) {
          classesMap.set(clsId, clsName);
        }

        const sCount = d.students?.count ?? (Array.isArray(d.students) ? d.students.length : 0);

        return {
          id,
          number: d.decision_number || '---',
          className: clsName,
          trainingCourse: d.training_course || 'K.01',
          signedDate: d.signed_date || date.format('YYYY-MM-DD'),
          startDate: d.start_date || d.signed_date || date.format('YYYY-MM-DD'),
          studentCount: sCount,
          status: finalizedIds.has(id) ? 'Completed' : 'Ongoing',
          month: date.month() + 1,
          year: date.year(),
          quarter: Math.ceil((date.month() + 1) / 3),
          classId: clsId,
        };
      });

      setData(processed);
      setUniqueClasses(
        Array.from(classesMap.entries()).map(([id, name]) => ({ id, name })),
      );
    } catch (err: any) {
      message.error('Lỗi khi tải dữ liệu thống kê: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const filteredData = data.filter((item) => {
    // Date filter
    if (dateRange && dateRange[0] && dateRange[1]) {
      const d = dayjs(item.signedDate);
      if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) {
        return false;
      }
    }

    // Class filter
    if (selectedClass !== 'all' && item.classId !== selectedClass) {
      return false;
    }

    // Status filter
    if (selectedStatus !== 'all' && item.status !== selectedStatus) {
      return false;
    }

    return true;
  });

  // Calculate aggregates
  const totalClasses = filteredData.length;
  const totalStudents = filteredData.reduce((acc, d) => acc + d.studentCount, 0);
  const completedClasses = filteredData.filter((d) => d.status === 'Completed').length;
  const completedStudents = filteredData
    .filter((d) => d.status === 'Completed')
    .reduce((acc, d) => acc + d.studentCount, 0);
  const ongoingClasses = totalClasses - completedClasses;
  const ongoingStudents = totalStudents - completedStudents;

  const completionRate = totalStudents > 0 ? Math.round((completedStudents / totalStudents) * 100) : 0;

  // Data cho BarChart - nhóm học viên theo tháng ký quyết định
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach((d) => {
      const month = dayjs(d.signedDate).format('MM/YYYY');
      map[month] = (map[month] || 0) + (d.studentCount || 0);
    });
    return Object.entries(map)
      .map(([month, count]) => ({ month, 'Học viên': count }))
      .slice(-12);
  }, [filteredData]);

  // Data cho PieChart - phân bổ theo trạng thái
  const statusData = useMemo(
    () => [
      { name: 'Đang học', value: filteredData.filter((d) => d.status === 'Ongoing').length },
      { name: 'Hoàn thành', value: filteredData.filter((d) => d.status === 'Completed').length },
    ],
    [filteredData],
  );
  const COLORS = ['#1677ff', '#52c41a'];

  // Breakdown by class
  const classBreakdown = uniqueClasses.map((cls) => {
    const list = filteredData.filter((d) => d.classId === cls.id);
    const count = list.reduce((acc, d) => acc + d.studentCount, 0);
    return {
      className: cls.name,
      classCount: list.length,
      studentCount: count,
    };
  }).filter((c) => c.studentCount > 0);

  const handleExportExcel = async () => {
    if (filteredData.length === 0) {
      message.warning('Không có dữ liệu trong khoảng thời gian đã chọn để xuất.');
      return;
    }

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();

    // Sheet 1: Tổng hợp
    const ws1 = wb.addWorksheet('Tổng hợp');
    ws1.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'Số Quyết định', key: 'number', width: 18 },
      { header: 'Tên lớp', key: 'className', width: 25 },
      { header: 'Khóa', key: 'trainingCourse', width: 15 },
      { header: 'Ngày ký', key: 'signedDate', width: 12 },
      { header: 'Sĩ số HV', key: 'studentCount', width: 10 },
      { header: 'Trạng thái', key: 'status', width: 15 },
    ];

    const hdr1 = ws1.getRow(1);
    hdr1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
    hdr1.alignment = { horizontal: 'center' };

    filteredData.forEach((d, idx) => {
      const row = ws1.addRow({
        stt: idx + 1,
        number: d.number,
        className: d.className,
        trainingCourse: d.trainingCourse,
        signedDate: fmtNgay(d.signedDate),
        studentCount: d.studentCount,
        status: d.status === 'Completed' ? 'Đã tốt nghiệp' : 'Đang đào tạo',
      });
      if (idx % 2 === 1) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }
    });

    ws1.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    });

    // Sheet 2: Chi tiết theo chương trình
    const ws2 = wb.addWorksheet('Chi tiết theo lớp');
    ws2.columns = [
      { header: 'Tên lớp', key: 'className', width: 25 },
      { header: 'Số lớp đào tạo', key: 'classCount', width: 15 },
      { header: 'Tổng học viên', key: 'studentCount', width: 15 },
      { header: 'Tỷ lệ (%)', key: 'pct', width: 12 },
    ];

    const hdr2 = ws2.getRow(1);
    hdr2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF52C41A' } };
    hdr2.alignment = { horizontal: 'center' };

    classBreakdown.forEach((cb, idx) => {
      const pct = totalStudents > 0 ? Math.round((cb.studentCount / totalStudents) * 100) : 0;
      const row = ws2.addRow({
        className: cb.className,
        classCount: cb.classCount,
        studentCount: cb.studentCount,
        pct,
      });
      if (idx % 2 === 1) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }
    });

    ws2.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([buf]), `Bao_Cao_Thong_Ke_${dayjs().format('DDMMYYYY')}.xlsx`);
    message.success('Đã xuất file báo cáo thống kê Excel thành công!');
  };

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space align="center" size="middle">
              <BarChartOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Thống kê & Báo cáo Đào tạo
                </Title>
                <Text type="secondary">
                  Tổng hợp số liệu học viên, tỷ lệ tốt nghiệp và tiến độ mở lớp theo thời gian
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>
                Xuất Excel
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadData}>
                Làm mới
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Filter toolbar */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col xs={24} md={10}>
            <Space>
              <Text strong>Khoảng thời gian:</Text>
              <RangePicker
                value={dateRange}
                onChange={(dates) => dates && setDateRange([dates[0]!, dates[1]!])}
                format="DD/MM/YYYY"
                allowClear={false}
              />
            </Space>
          </Col>
          <Col xs={24} sm={12} md={7}>
            <Space style={{ width: '100%' }}>
              <Text strong>Lớp học:</Text>
              <Select
                value={selectedClass}
                onChange={(val) => setSelectedClass(val)}
                style={{ width: 180 }}
              >
                <Select.Option value="all">Tất cả lớp học</Select.Option>
                {uniqueClasses.map((c) => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.name}
                  </Select.Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={7}>
            <Space style={{ width: '100%' }}>
              <Text strong>Trạng thái:</Text>
              <Select
                value={selectedStatus}
                onChange={(val) => setSelectedStatus(val)}
                style={{ width: 170 }}
              >
                <Select.Option value="all">Tất cả trạng thái</Select.Option>
                <Select.Option value="Ongoing">Đang đào tạo</Select.Option>
                <Select.Option value="Completed">Đã tốt nghiệp</Select.Option>
              </Select>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Tổng số học viên"
              value={totalStudents}
              suffix="học viên"
              prefix={<TeamOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Tổng số lớp học"
              value={totalClasses}
              suffix="lớp"
              prefix={<FileTextOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Đã tốt nghiệp / Công nhận"
              value={completedStudents}
              suffix={`(${completedClasses} lớp)`}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Đang trong tiến trình"
              value={ongoingStudents}
              suffix={`(${ongoingClasses} lớp)`}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="Học viên theo tháng" size="small">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Học viên" fill="#1677ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Trạng thái lớp" size="small">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ''}: ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {statusData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Progress & Breakdown */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card title="Tỷ lệ hoàn thành đào tạo" style={{ height: '100%' }}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Progress
                type="circle"
                percent={completionRate}
                size={140}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              <div style={{ marginTop: 20 }}>
                <Text type="secondary">
                  {completedStudents} / {totalStudents} học viên đã nhận quyết định công nhận tốt nghiệp
                </Text>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card title="Phân bổ học viên theo chương trình đào tạo" style={{ height: '100%' }}>
            {classBreakdown.length === 0 ? (
              <Empty description="Chưa có dữ liệu phân bổ." />
            ) : (
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {classBreakdown.map((cb, idx) => {
                  const pct = totalStudents > 0 ? Math.round((cb.studentCount / totalStudents) * 100) : 0;
                  return (
                    <div key={idx} style={{ marginBottom: 14 }}>
                      <Row justify="space-between" style={{ marginBottom: 4 }}>
                        <Col>
                          <Text strong>{cb.className}</Text>{' '}
                          <Text type="secondary">({cb.classCount} lớp)</Text>
                        </Col>
                        <Col>
                          <Text strong>{cb.studentCount} HV</Text> ({pct}%)
                        </Col>
                      </Row>
                      <Progress percent={pct} strokeColor="#1677ff" size="small" showInfo={false} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Detail Table */}
      <Card title="Danh sách các khóa & lớp đào tạo trong kỳ">
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : filteredData.length === 0 ? (
          <Empty description="Không có lớp nào phù hợp với bộ lọc." />
        ) : (
          <Table
            dataSource={filteredData}
            rowKey="id"
            pagination={{ pageSize: 10, showTotal: (t) => `Tổng số ${t} lớp` }}
            columns={[
              {
                title: 'STT',
                width: 60,
                align: 'center',
                render: (_, __, idx) => idx + 1,
              },
              {
                title: 'Số Quyết định',
                dataIndex: 'number',
                render: (val) => <Text strong style={{ color: '#1677ff' }}>{val}</Text>,
              },
              {
                title: 'Tên lớp đào tạo',
                dataIndex: 'className',
                render: (val, record) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{val}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Khóa: {record.trainingCourse}
                    </Text>
                  </div>
                ),
              },
              {
                title: 'Ngày ký QĐ',
                dataIndex: 'signedDate',
                width: 130,
                render: (val) => fmtNgay(val),
              },
              {
                title: 'Sĩ số',
                dataIndex: 'studentCount',
                width: 100,
                align: 'center',
                render: (c) => <Tag color="blue">{c} học viên</Tag>,
              },
              {
                title: 'Trạng thái',
                dataIndex: 'status',
                width: 160,
                align: 'center',
                render: (st) =>
                  st === 'Completed' ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>
                      ĐÃ TỐT NGHIỆP
                    </Tag>
                  ) : (
                    <Tag color="processing" icon={<ClockCircleOutlined />}>
                      ĐANG ĐÀO TẠO
                    </Tag>
                  ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

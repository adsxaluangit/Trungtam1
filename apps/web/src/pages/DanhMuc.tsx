import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
} from 'antd';
import type { TableProps } from 'antd';
import {
  ApartmentOutlined,
  BookOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  GlobalOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SolutionOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, COLLECTIONS, normalizeStrapiList } from '../api';
import { fmtNgay, MAU_TRANG_THAI_LOP, toIso } from '../constants';

export default function DanhMuc() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('classes');
  const [tuKhoa, setTuKhoa] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- CSV Helpers ----
  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplateMonHoc = () => {
    const content = [
      'Tên môn học,Mã môn,Giờ LT,Giờ TH,Thi LT (true/false),Thi TH (true/false)',
      'Pháp luật,MH01,16,0,true,false',
      'Điện cơ bản,MH02,20,40,true,true',
    ].join('\r\n');
    downloadCsv(content, 'Template_MonHoc.csv');
  };

  const downloadTemplateLopHoc = () => {
    const content = [
      'Mã lớp,Tên lớp học,Ngày khai giảng (DD/MM/YYYY),Ngày kết thúc (DD/MM/YYYY),Trạng thái (OPENING/PENDING/CLOSED)',
      'TH2026-01,Thủy thủ Hạng Nhất Khóa 1,01/01/2026,30/06/2026,OPENING',
    ].join('\r\n');
    downloadCsv(content, 'Template_LopHoc.csv');
  };

  const downloadTemplateGiangVien = () => {
    const content = [
      'Mã GV,Họ và tên,Điện thoại,Email,Chuyên môn',
      'GV01,Nguyễn Văn A,0912345678,gv01@example.com,Điều khiển tàu biển',
    ].join('\r\n');
    downloadCsv(content, 'Template_GiangVien.csv');
  };

  const parseCSV = (text: string): string[][] => {
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '')
      .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
  };

  const importMonHocFromCSV = async (file: File) => {
    setImportLoading(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) {
        message.warning('File CSV trống hoặc chỉ có header.');
        return;
      }
      const dataRows = rows.slice(1); // skip header
      let successCount = 0;
      let errorCount = 0;
      for (const row of dataRows) {
        const [name, code, gioLT, gioTH, thiLT, thiTH] = row;
        if (!name) continue;
        try {
          await api(`/${COLLECTIONS.SUBJECTS}`, {
            method: 'POST',
            body: {
              data: {
                name: name.trim(),
                code: code?.trim() || undefined,
                theory_hours: Number(gioLT) || 0,
                practice_hours: Number(gioTH) || 0,
                has_theory: String(thiLT).toLowerCase() === 'true',
                has_practice: String(thiTH).toLowerCase() === 'true',
                publishedAt: new Date().toISOString(),
              },
            },
          });
          successCount++;
        } catch {
          errorCount++;
        }
      }
      message.success(`Import thành công ${successCount} môn học${errorCount > 0 ? `, thất bại ${errorCount}` : ''}.`);
      qc.invalidateQueries({ queryKey: ['cat-subjects'] });
    } catch (err: any) {
      message.error('Lỗi đọc file: ' + (err.message || ''));
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Form states
  const [form] = Form.useForm();
  const [moModal, setMoModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Queries cho các danh mục
  const queryNations = useQuery({
    queryKey: ['cat-nations'],
    queryFn: async () => normalizeStrapiList(await api<any>(`/${COLLECTIONS.NATIONS}?pagination[pageSize]=200&publicationState=preview`)),
  });

  const querySuppliers = useQuery({
    queryKey: ['cat-suppliers'],
    queryFn: async () => normalizeStrapiList(await api<any>(`/${COLLECTIONS.SUPPLIERS}?pagination[pageSize]=200&publicationState=preview`)),
  });

  const queryClassrooms = useQuery({
    queryKey: ['cat-classrooms'],
    queryFn: async () => normalizeStrapiList(await api<any>(`/${COLLECTIONS.CLASSROOMS}?pagination[pageSize]=200&publicationState=preview`)),
  });

  const querySubjects = useQuery({
    queryKey: ['cat-subjects'],
    queryFn: async () => normalizeStrapiList(await api<any>(`/${COLLECTIONS.SUBJECTS}?pagination[pageSize]=200&publicationState=preview`)),
  });

  const queryTeachers = useQuery({
    queryKey: ['cat-teachers'],
    queryFn: async () => normalizeStrapiList(await api<any>(`/${COLLECTIONS.TEACHERS}?populate=*&pagination[pageSize]=200&publicationState=preview`)),
  });

  const queryClasses = useQuery({
    queryKey: ['cat-classes'],
    queryFn: async () => normalizeStrapiList(await api<any>(`/${COLLECTIONS.CLASSES}?populate=*&pagination[pageSize]=200&publicationState=preview`)),
  });

  // Xác định collection hiện tại dựa trên activeTab
  const getCollectionName = () => {
    switch (activeTab) {
      case 'nations': return COLLECTIONS.NATIONS;
      case 'suppliers': return COLLECTIONS.SUPPLIERS;
      case 'classrooms': return COLLECTIONS.CLASSROOMS;
      case 'subjects': return COLLECTIONS.SUBJECTS;
      case 'teachers': return COLLECTIONS.TEACHERS;
      default: return COLLECTIONS.CLASSES;
    }
  };

  const getQueryKey = () => `cat-${activeTab}`;

  const mapSubjectNumericIds = (subIds: any[]) =>
    (subIds || [])
      .map((docId: any) => {
        if (typeof docId === 'number') return docId;
        const found = querySubjects.data?.find(
          (s: any) =>
            String(s.documentId) === String(docId) ||
            String(s.id) === String(docId) ||
            String(s.strapiId) === String(docId),
        );
        if (found && found.strapiId) return Number(found.strapiId);
        const num = Number(docId);
        return !isNaN(num) && num > 0 ? num : null;
      })
      .filter(Boolean);

  // Mutation Lưu (Thêm / Sửa)
  const luuMut = useMutation({
    mutationFn: async (values: any) => {
      const coll = getCollectionName();
      let payload: Record<string, any> = {};

      if (activeTab === 'classes') {
        payload = {
          code: values.code,
          name: values.name,
          start_date: values.startDate ? toIso(values.startDate) : null,
          end_date: values.endDate ? toIso(values.endDate) : null,
          status: values.status || 'OPENING',
          student_count: Number(values.student_count || 0),
          notes: values.notes || '',
          subjects: mapSubjectNumericIds(values.subjects),
        };
      } else if (activeTab === 'teachers') {
        payload = {
          code: values.code,
          name: values.name,
          full_name: values.name,
          phone: values.phone || '',
          email: values.email || '',
          specialization: values.specialization || '',
          subjects: mapSubjectNumericIds(values.subjects),
        };
      } else if (activeTab === 'subjects') {
        payload = {
          code: values.code,
          name: values.name,
          sessions: Number(values.sessions || 0),
          total_hours: Number(values.total_hours || 0),
          theory_hours: Number(values.theory_hours || 0),
          practice_hours: Number(values.practice_hours || 0),
          has_theory: Boolean(values.has_theory),
          has_practice: Boolean(values.has_practice),
          notes: values.notes || '',
        };
      } else if (activeTab === 'classrooms') {
        payload = {
          code: values.code,
          name: values.name,
          capacity: Number(values.capacity || 0),
          building: values.building || '',
          status: values.status || 'ACTIVE',
        };
      } else if (activeTab === 'suppliers') {
        payload = {
          code: values.code,
          name: values.name,
          tax_id: values.tax_id || '',
          phone: values.phone || '',
          email: values.email || '',
          address: values.address || '',
          status: values.status || 'ACTIVE',
        };
      } else if (activeTab === 'nations') {
        payload = {
          code: values.code,
          name: values.name,
          abbr: values.abbr || '',
          status: values.status || 'ACTIVE',
        };
      }

      if (editingItem) {
        return api(`/${coll}/${editingItem.documentId || editingItem.id}`, {
          method: 'PUT',
          body: { data: payload },
        });
      } else {
        payload.publishedAt = new Date().toISOString();
        return api(`/${coll}`, {
          method: 'POST',
          body: { data: payload },
        });
      }
    },
    onSuccess: () => {
      message.success(editingItem ? 'Cập nhật thành công' : 'Thêm mới thành công');
      setMoModal(false);
      setEditingItem(null);
      form.resetFields();
      qc.invalidateQueries({ queryKey: [getQueryKey()] });
      if (activeTab === 'classes' || activeTab === 'subjects') {
        qc.invalidateQueries({ queryKey: ['classes-list-for-filter'] });
      }
    },
    onError: (err: Error) => {
      message.error(err.message || 'Lỗi khi lưu dữ liệu');
    },
  });

  // Mutation Xóa
  const xoaMut = useMutation({
    mutationFn: async (documentId: string) => {
      const coll = getCollectionName();
      return api(`/${coll}/${documentId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      message.success('Đã xóa bản ghi');
      qc.invalidateQueries({ queryKey: [getQueryKey()] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'Lỗi khi xóa bản ghi');
    },
  });

  const moThemMoi = () => {
    setEditingItem(null);
    form.resetFields();
    if (activeTab === 'classes') {
      form.setFieldsValue({ status: 'OPENING', student_count: 0 });
    } else if (activeTab === 'subjects') {
      form.setFieldsValue({ has_theory: true, has_practice: false, sessions: 15, total_hours: 45 });
    }
    setMoModal(true);
  };

  const moSua = (item: any) => {
    setEditingItem(item);
    form.resetFields();

    const vals = { ...item };
    if (activeTab === 'classes') {
      vals.startDate = item.start_date ? dayjs(item.start_date) : null;
      vals.endDate = item.end_date ? dayjs(item.end_date) : null;
      // subjects mapping
      const subs = item.subjects || [];
      vals.subjects = subs.map((s: any) => s.documentId || s.id);
    } else if (activeTab === 'teachers') {
      const subs = item.subjects || [];
      vals.subjects = subs.map((s: any) => s.documentId || s.id);
    }

    form.setFieldsValue(vals);
    setMoModal(true);
  };

  // Lọc dữ liệu theo từ khóa
  const locDuLieu = (data: any[]) => {
    if (!tuKhoa.trim()) return data;
    const k = tuKhoa.toLowerCase();
    return data.filter(
      (it: any) =>
        (it.name || '').toLowerCase().includes(k) ||
        (it.code || '').toLowerCase().includes(k) ||
        (it.phone || '').includes(k),
    );
  };

  // Tabs Header
  const tabItems = [
    { key: 'classes', label: 'Lớp học', icon: <BookOutlined /> },
    { key: 'teachers', label: 'Giảng viên', icon: <SolutionOutlined /> },
    { key: 'subjects', label: 'Môn học', icon: <ApartmentOutlined /> },
    { key: 'classrooms', label: 'Phòng học', icon: <HomeOutlined /> },
    { key: 'suppliers', label: 'Dãy nhà / Cơ sở', icon: <ApartmentOutlined /> },
    { key: 'nations', label: 'Quốc gia', icon: <GlobalOutlined /> },
  ];

  // ================= Cột bảng theo từng tab =================
  const colClasses: TableProps<any>['columns'] = [
    { title: 'STT', width: 60, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Mã lớp', dataIndex: 'code', key: 'code', width: 120, render: (v) => <Tag color="blue">{v}</Tag> },
    { title: 'Tên lớp học', dataIndex: 'name', key: 'name', render: (v) => <b>{v}</b> },
    { title: 'Ngày bắt đầu', dataIndex: 'start_date', key: 'start_date', width: 130, render: (v) => fmtNgay(v) || '---' },
    { title: 'Ngày kết thúc', dataIndex: 'end_date', key: 'end_date', width: 130, render: (v) => fmtNgay(v) || '---' },
    {
      title: 'Môn học',
      dataIndex: 'subjects',
      key: 'subjects',
      render: (subs: any[]) => (
        <span>{Array.isArray(subs) ? subs.length : 0} môn</span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (v) => <Tag color={MAU_TRANG_THAI_LOP[v] || 'default'}>{v === 'OPENING' || v === 'active' ? 'Đang mở' : v || 'Chờ mở'}</Tag>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => moSua(r)} />
          <Popconfirm title="Xóa lớp này?" onConfirm={() => xoaMut.mutate(r.documentId || r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const colTeachers: TableProps<any>['columns'] = [
    { title: 'STT', width: 60, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Mã GV', dataIndex: 'code', key: 'code', width: 110, render: (v) => <Tag color="purple">{v}</Tag> },
    { title: 'Họ và tên', dataIndex: 'name', key: 'name', render: (v) => <b>{v}</b> },
    { title: 'Chuyên môn', dataIndex: 'specialization', key: 'specialization' },
    { title: 'Điện thoại', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => moSua(r)} />
          <Popconfirm title="Xóa giảng viên này?" onConfirm={() => xoaMut.mutate(r.documentId || r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const colSubjects: TableProps<any>['columns'] = [
    { title: 'STT', width: 60, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Mã môn', dataIndex: 'code', key: 'code', width: 110, render: (v) => <Tag color="cyan">{v}</Tag> },
    { title: 'Tên môn học', dataIndex: 'name', key: 'name', render: (v) => <b>{v}</b> },
    { title: 'Số ca', dataIndex: 'sessions', key: 'sessions', width: 80, align: 'center' },
    { title: 'Tổng giờ', dataIndex: 'total_hours', key: 'total_hours', width: 90, align: 'center' },
    { title: 'Lý thuyết', dataIndex: 'theory_hours', key: 'theory_hours', width: 90, align: 'center' },
    { title: 'Thực hành', dataIndex: 'practice_hours', key: 'practice_hours', width: 90, align: 'center' },
    {
      title: 'Thi TH/LT',
      key: 'has',
      width: 130,
      render: (_, r) => (
        <Space size={4}>
          {r.has_theory && <Tag color="blue">LT</Tag>}
          {r.has_practice && <Tag color="green">TH</Tag>}
        </Space>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => moSua(r)} />
          <Popconfirm title="Xóa môn học này?" onConfirm={() => xoaMut.mutate(r.documentId || r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const colClassrooms: TableProps<any>['columns'] = [
    { title: 'STT', width: 60, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Mã phòng', dataIndex: 'code', key: 'code', width: 110, render: (v) => <Tag>{v}</Tag> },
    { title: 'Tên phòng học', dataIndex: 'name', key: 'name', render: (v) => <b>{v}</b> },
    { title: 'Sức chứa', dataIndex: 'capacity', key: 'capacity', width: 100, align: 'center' },
    { title: 'Dãy nhà / Tòa', dataIndex: 'building', key: 'building' },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => moSua(r)} />
          <Popconfirm title="Xóa phòng học này?" onConfirm={() => xoaMut.mutate(r.documentId || r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const colSuppliers: TableProps<any>['columns'] = [
    { title: 'STT', width: 60, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Mã', dataIndex: 'code', key: 'code', width: 110 },
    { title: 'Tên dãy nhà / cơ sở', dataIndex: 'name', key: 'name', render: (v) => <b>{v}</b> },
    { title: 'Điện thoại', dataIndex: 'phone', key: 'phone' },
    { title: 'Địa chỉ', dataIndex: 'address', key: 'address' },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => moSua(r)} />
          <Popconfirm title="Xóa dãy nhà này?" onConfirm={() => xoaMut.mutate(r.documentId || r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const colNations: TableProps<any>['columns'] = [
    { title: 'STT', width: 60, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Mã', dataIndex: 'code', key: 'code', width: 100 },
    { title: 'Tên quốc gia', dataIndex: 'name', key: 'name', render: (v) => <b>{v}</b> },
    { title: 'Viết tắt', dataIndex: 'abbr', key: 'abbr', width: 120 },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => moSua(r)} />
          <Popconfirm title="Xóa quốc gia này?" onConfirm={() => xoaMut.mutate(r.documentId || r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Lấy dữ liệu và cột theo tab
  const getTableProps = () => {
    switch (activeTab) {
      case 'classes':
        return { data: locDuLieu(queryClasses.data || []), cols: colClasses, loading: queryClasses.isFetching };
      case 'teachers':
        return { data: locDuLieu(queryTeachers.data || []), cols: colTeachers, loading: queryTeachers.isFetching };
      case 'subjects':
        return { data: locDuLieu(querySubjects.data || []), cols: colSubjects, loading: querySubjects.isFetching };
      case 'classrooms':
        return { data: locDuLieu(queryClassrooms.data || []), cols: colClassrooms, loading: queryClassrooms.isFetching };
      case 'suppliers':
        return { data: locDuLieu(querySuppliers.data || []), cols: colSuppliers, loading: querySuppliers.isFetching };
      case 'nations':
        return { data: locDuLieu(queryNations.data || []), cols: colNations, loading: queryNations.isFetching };
      default:
        return { data: [], cols: [], loading: false };
    }
  };

  const { data, cols, loading } = getTableProps();

  return (
    <Card className="card-mem">
      <Tabs
        activeKey={activeTab}
        onChange={(k) => {
          setActiveTab(k);
          setTuKhoa('');
        }}
        items={tabItems}
      />

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Input.Search
            placeholder="Tìm kiếm trong danh mục..."
            allowClear
            value={tuKhoa}
            onChange={(e) => setTuKhoa(e.target.value)}
            style={{ width: 260 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: [getQueryKey()] })}>
            Làm mới
          </Button>
        </Space>
        <Space>
          {/* Download template buttons */}
          {activeTab === 'subjects' && (
            <>
              {/* Hidden file input for CSV import */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importMonHocFromCSV(file);
                }}
              />
              <Button
                icon={<DownloadOutlined />}
                onClick={downloadTemplateMonHoc}
              >
                Tải mẫu CSV
              </Button>
              <Button
                icon={<UploadOutlined />}
                loading={importLoading}
                onClick={() => fileInputRef.current?.click()}
              >
                Import CSV
              </Button>
            </>
          )}
          {activeTab === 'classes' && (
            <Button icon={<DownloadOutlined />} onClick={downloadTemplateLopHoc}>
              Tải mẫu CSV
            </Button>
          )}
          {activeTab === 'teachers' && (
            <Button icon={<DownloadOutlined />} onClick={downloadTemplateGiangVien}>
              Tải mẫu CSV
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={moThemMoi}>
            Thêm mới
          </Button>
        </Space>
      </div>

      <Table
        dataSource={data}
        columns={cols}
        rowKey={(r) => r.documentId || r.id}
        loading={loading}
        pagination={{ pageSize: 15 }}
        locale={{
          emptyText: <Empty description="Chưa có dữ liệu danh mục" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
        }}
      />

      {/* Modal Thêm / Sửa theo từng danh mục */}
      <Modal
        title={editingItem ? 'Chỉnh sửa danh mục' : 'Thêm mới danh mục'}
        open={moModal}
        width={activeTab === 'classes' || activeTab === 'subjects' || activeTab === 'teachers' ? 700 : 540}
        onCancel={() => setMoModal(false)}
        onOk={() => form.submit()}
        confirmLoading={luuMut.isPending}
        forceRender
        okText="Lưu lại"
        cancelText="Đóng"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => luuMut.mutate(v)}
          onFinishFailed={(errInfo) => {
            const firstErr = errInfo.errorFields?.[0]?.errors?.[0];
            if (firstErr) message.warning(firstErr);
          }}
          style={{ marginTop: 16 }}
        >
          {/* TAB: LỚP HỌC */}
          {activeTab === 'classes' && (
            <>
              <Row gutter={16}>
                <Col span={10}>
                  <Form.Item name="code" label="Mã lớp học" rules={[{ required: true, message: 'Nhập mã lớp' }]}>
                    <Input placeholder="Vd: TH2026-01" />
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item name="name" label="Tên lớp học" rules={[{ required: true, message: 'Nhập tên lớp' }]}>
                    <Input placeholder="Vd: Thủy thủ Hạng Nhất Khóa 1" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="startDate" label="Ngày khai giảng">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="endDate" label="Ngày kết thúc">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="subjects" label="Môn học trong chương trình đào tạo">
                <Select
                  mode="multiple"
                  placeholder="Chọn các môn học..."
                  options={querySubjects.data?.map((s: any) => ({
                    value: s.documentId || s.id,
                    label: `[${s.code}] ${s.name}`,
                  }))}
                />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="status" label="Trạng thái">
                    <Select
                      options={[
                        { value: 'OPENING', label: 'Đang khai giảng' },
                        { value: 'PENDING', label: 'Chờ khai giảng' },
                        { value: 'CLOSED', label: 'Đã kết thúc' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="student_count" label="Số học viên dự kiến">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="notes" label="Ghi chú">
                <Input.TextArea rows={2} />
              </Form.Item>
            </>
          )}

          {/* TAB: GIẢNG VIÊN */}
          {activeTab === 'teachers' && (
            <>
              <Row gutter={16}>
                <Col span={10}>
                  <Form.Item name="code" label="Mã giảng viên" rules={[{ required: true, message: 'Nhập mã GV' }]}>
                    <Input placeholder="GV01" />
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item name="name" label="Họ và tên giảng viên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
                    <Input placeholder="Nguyễn Văn A" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="phone" label="Số điện thoại">
                    <Input placeholder="09xxxxxxx" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="email" label="Email">
                    <Input placeholder="email@example.com" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="specialization" label="Chuyên môn giảng dạy">
                <Input placeholder="Điều khiển tàu biển, Máy tàu..." />
              </Form.Item>
              <Form.Item name="subjects" label="Môn học có thể đảm nhận">
                <Select
                  mode="multiple"
                  placeholder="Chọn các môn học..."
                  options={querySubjects.data?.map((s: any) => ({
                    value: s.documentId || s.id,
                    label: `[${s.code}] ${s.name}`,
                  }))}
                />
              </Form.Item>
            </>
          )}

          {/* TAB: MÔN HỌC */}
          {activeTab === 'subjects' && (
            <>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="code" label="Mã môn học" rules={[{ required: true, message: 'Nhập mã môn' }]}>
                    <Input placeholder="MH01" />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item name="name" label="Tên môn học" rules={[{ required: true, message: 'Nhập tên môn' }]}>
                    <Input placeholder="Luật Hàng hải quốc tế" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item name="sessions" label="Số ca">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="total_hours" label="Tổng giờ">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="theory_hours" label="Giờ lý thuyết">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="practice_hours" label="Giờ thực hành">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="has_theory" label="Thi lý thuyết" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="has_practice" label="Thi thực hành" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="notes" label="Ghi chú">
                <Input.TextArea rows={2} />
              </Form.Item>
            </>
          )}

          {/* TAB: PHÒNG HỌC */}
          {activeTab === 'classrooms' && (
            <>
              <Row gutter={16}>
                <Col span={10}>
                  <Form.Item name="code" label="Mã phòng" rules={[{ required: true, message: 'Nhập mã phòng' }]}>
                    <Input placeholder="P101" />
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item name="name" label="Tên phòng học" rules={[{ required: true, message: 'Nhập tên phòng' }]}>
                    <Input placeholder="Phòng học Lý thuyết 1" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="capacity" label="Sức chứa (Chỗ ngồi)">
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="building" label="Dãy nhà / Tòa">
                    <Input placeholder="Nhà A, Tầng 1" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* TAB: DÃY NHÀ */}
          {activeTab === 'suppliers' && (
            <>
              <Row gutter={16}>
                <Col span={10}>
                  <Form.Item name="code" label="Mã dãy nhà" rules={[{ required: true }]}>
                    <Input placeholder="NHA-A" />
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item name="name" label="Tên dãy nhà / cơ sở" rules={[{ required: true }]}>
                    <Input placeholder="Khu Giảng đường A" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="phone" label="Số điện thoại">
                    <Input placeholder="0225.xxxx" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="email" label="Email liên hệ">
                    <Input placeholder="daotao@example.com" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="address" label="Địa chỉ">
                <Input placeholder="Khuôn viên trường..." />
              </Form.Item>
            </>
          )}

          {/* TAB: QUỐC GIA */}
          {activeTab === 'nations' && (
            <>
              <Row gutter={16}>
                <Col span={10}>
                  <Form.Item name="code" label="Mã quốc gia" rules={[{ required: true }]}>
                    <Input placeholder="VN" />
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item name="name" label="Tên quốc gia" rules={[{ required: true }]}>
                    <Input placeholder="Việt Nam" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="abbr" label="Viết tắt">
                <Input placeholder="VNM" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </Card>
  );
}

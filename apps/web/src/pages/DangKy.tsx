import { useState, useRef } from 'react';
import React from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Grid,
  Input,
  Modal,
  Radio,
  Result,
  Row,
  Select,
  Space,
  Typography,
  Upload,
} from 'antd';
import {
  CheckCircleOutlined,
  CameraOutlined,
  IdcardOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api, checkDuplicateStudent, COLLECTIONS, normalizeStrapiList, uploadFile } from '../api';
import { PROVINCES_LIST, toIso } from '../constants';

const { Title, Text, Paragraph } = Typography;

export default function DangKy() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [dangGui, setDangGui] = useState(false);
  const [thanhCong, setThanhCong] = useState(false);
  const [thongTinDangKy, setThongTinDangKy] = useState<{ hoTen: string; lop: string; soCccd: string } | null>(null);

  // Ảnh 3x4 và CCCD 2 mặt
  const [anh3x4, setAnh3x4] = useState<string | null>(null);
  const [anhCccdTruoc, setAnhCccdTruoc] = useState<string | null>(null);
  const [anhCccdSau, setAnhCccdSau] = useState<string | null>(null);

  // State camera WebRTC
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Danh sách lớp học
  const { data: danhSachLop, isLoading: dangTaiLop } = useQuery({
    queryKey: ['public-classes'],
    queryFn: async () => {
      const res = await api<any>(
        `/${COLLECTIONS.CLASSES}?populate=*&sort=createdAt:desc&pagination[pageSize]=100&publicationState=preview`,
      );
      return normalizeStrapiList(res);
    },
  });

  // Chuyển file sang Base64
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const xuLyUpload = async (file: File, loai: '3x4' | 'cccd_truoc' | 'cccd_sau') => {
    try {
      const base64 = await fileToBase64(file);
      if (loai === '3x4') setAnh3x4(base64);
      else if (loai === 'cccd_truoc') setAnhCccdTruoc(base64);
      else setAnhCccdSau(base64);
      message.success('Đã chọn ảnh thành công');
    } catch {
      message.error('Không thể đọc file ảnh');
    }
    return false; // Chặn antd tự upload
  };

  // Auto-fill form khi nhập CCCD đã tồn tại
  const onCCCDBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const idNumber = e.target.value?.trim();
    if (!idNumber || idNumber.length < 9) return;
    try {
      const res = await fetch(`/api/students?filters[id_number][$eq]=${idNumber}&pagination[limit]=1`);
      const data = await res.json();
      if (data.data?.length > 0) {
        const s = data.data[0];
        const attrs = s.attributes || s;
        form.setFieldsValue({
          fullName: attrs.full_name,
          dob: attrs.dob ? dayjs(attrs.dob) : undefined,
          pob: attrs.pob,
          ethnicity: attrs.ethnicity,
          address: attrs.address,
          phone: attrs.phone,
          gender: attrs.gender,
        });
        message.info('Đã tìm thấy thông tin học viên, tự động điền vào form');
      }
    } catch {
      // silent
    }
  };

  const onFinish = async (values: any) => {
    const cccd = (values.idNumber || '').trim();
    if (cccd.length !== 12) {
      message.error('Số CCCD/CMND phải đúng 12 chữ số!');
      return;
    }

    if (!values.classIds || values.classIds.length === 0) {
      message.error('Vui lòng chọn ít nhất 1 lớp học!');
      return;
    }

    setDangGui(true);
    try {
      // 1. Kiểm tra trùng lặp cho từng lớp được chọn
      for (const classDocId of values.classIds) {
        const cls = danhSachLop?.find((c: any) => c.documentId === classDocId || c.id === classDocId);
        const dup = await checkDuplicateStudent(cccd, classDocId);
        if (dup.exists) {
          message.error(`Học viên với CCCD ${cccd} đã đăng ký lớp "${cls?.name || classDocId}" rồi!`);
          setDangGui(false);
          return;
        }
      }

      // 2. Upload file nếu có
      let photoUrl: string | null = null;
      if (anh3x4) {
        const up = await uploadFile(anh3x4, `avatar_${cccd}_${Date.now()}.jpg`);
        if (up && up.length > 0) photoUrl = up[0].url;
      }

      let cccdTruocUrl: string | null = null;
      if (anhCccdTruoc) {
        const up = await uploadFile(anhCccdTruoc, `cccd_truoc_${cccd}_${Date.now()}.jpg`);
        if (up && up.length > 0) cccdTruocUrl = up[0].url;
      }

      let cccdSauUrl: string | null = null;
      if (anhCccdSau) {
        const up = await uploadFile(anhCccdSau, `cccd_sau_${cccd}_${Date.now()}.jpg`);
        if (up && up.length > 0) cccdSauUrl = up[0].url;
      }

      const nameParts = values.fullName.trim().split(/\s+/);
      const firstName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : values.fullName;
      const lastName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
      const dobIso = values.dob ? toIso(values.dob) : null;

      const tenCacLop: string[] = [];

      // 3. Tạo record student cho mỗi lớp
      for (const classDocId of values.classIds) {
        const cls = danhSachLop?.find(
          (c: any) =>
            String(c.documentId) === String(classDocId) ||
            String(c.id) === String(classDocId) ||
            String(c.strapiId) === String(classDocId),
        );
        if (cls?.name) tenCacLop.push(cls.name);
        const classNumericId = cls?.strapiId
          ? Number(cls.strapiId)
          : !isNaN(Number(classDocId)) && Number(classDocId) > 0
            ? Number(classDocId)
            : null;

        const payload: any = {
          student_code: cccd,
          id_number: cccd,
          card_number: cccd,
          full_name: values.fullName.toUpperCase().trim(),
          first_name: firstName.toUpperCase().trim(),
          last_name: lastName.toUpperCase().trim(),
          dob: dobIso,
          pob: values.pob || '',
          gender: values.gender || 'Nam',
          ethnicity: values.ethnicity || 'Kinh',
          nationality: values.nationality || 'Việt Nam',
          phone: values.phone || '',
          address: values.address || '',
          company: values.company || '',
          notes: values.notes || '',
          photo: photoUrl,
          class_code: cls?.code || '',
          class_name: cls?.name || '',
          group: cls?.name || '',
          is_approved: false,
          publishedAt: new Date().toISOString(),
        };
        if (classNumericId) {
          payload.school_class = classNumericId;
        }

        const res = await api<any>(`/${COLLECTIONS.STUDENTS}`, {
          method: 'POST',
          body: { data: payload },
        });

        const studentNumericId = res?.data?.id || res?.data?.strapiId;

        // Lưu tài liệu CCCD
        if (cccdTruocUrl) {
          await api('/student-documents/replace-or-create', {
            method: 'POST',
            body: {
              name: 'CCCD Mặt trước',
              type: 'image/jpeg',
              url: cccdTruocUrl,
              date: new Date().toLocaleDateString('vi-VN'),
              student: studentNumericId ? Number(studentNumericId) : undefined,
              id_number: cccd,
            },
          }).catch(() => {});
        }

        if (cccdSauUrl) {
          await api('/student-documents/replace-or-create', {
            method: 'POST',
            body: {
              name: 'CCCD Mặt sau',
              type: 'image/jpeg',
              url: cccdSauUrl,
              date: new Date().toLocaleDateString('vi-VN'),
              student: studentNumericId ? Number(studentNumericId) : undefined,
              id_number: cccd,
            },
          }).catch(() => {});
        }
      }

      setThongTinDangKy({
        hoTen: values.fullName.toUpperCase().trim(),
        lop: tenCacLop.join(', '),
        soCccd: cccd,
      });
      setThanhCong(true);
      message.success('Đăng ký khóa học thành công!');
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Có lỗi xảy ra khi gửi đăng ký.');
    } finally {
      setDangGui(false);
    }
  };

  const dangKyMoi = () => {
    form.resetFields();
    setAnh3x4(null);
    setAnhCccdTruoc(null);
    setAnhCccdSau(null);
    setThanhCong(false);
  };

  // ── Camera WebRTC ─────────────────────────────────────────────────────────
  const moCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        message.info('Đang chuyển sang kết nối bảo mật HTTPS để sử dụng Camera...');
        setTimeout(() => {
          window.location.href = `https://${window.location.hostname}${window.location.pathname}${window.location.search}`;
        }, 600);
        return;
      }
      message.error('Trình duyệt không hỗ trợ Camera. Vui lòng truy cập qua https:// để bật Camera.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 80);
    } catch {
      message.error('Không thể truy cập camera');
      setIsCameraOpen(false);
    }
  };

  const chupAnh = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 900;
    canvas.height = 1200;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const ratio = 3 / 4;
    let sX = 0, sY = 0, sW = vw, sH = vh;
    if (vw / vh > ratio) { sW = vh * ratio; sX = (vw - sW) / 2; }
    else { sH = vw / ratio; sY = (vh - sH) / 2; }
    ctx.drawImage(video, sX, sY, sW, sH, 0, 0, 900, 1200);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setAnh3x4(dataUrl);
    dongCamera();
  };

  const dongCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOpen(false);
  };

  if (thanhCong) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f0f2f5',
          display: 'grid',
          placeItems: 'center',
          padding: isMobile ? 12 : 24,
        }}
      >
        <Card
          style={{ maxWidth: 640, width: '100%', borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
          styles={{ body: { padding: isMobile ? '20px 14px' : '24px 32px' } }}
        >
          <Result
            status="success"
            title="Đăng ký học viên thành công!"
            subTitle={
              <div>
                <Paragraph style={{ margin: 0, fontSize: 15 }}>
                  Hồ sơ của học viên <b>{thongTinDangKy?.hoTen}</b> (CCCD: {thongTinDangKy?.soCccd}) đã được tiếp nhận cho lớp:
                </Paragraph>
                <Paragraph style={{ color: '#1677ff', fontWeight: 600, fontSize: 16, marginTop: 4 }}>
                  {thongTinDangKy?.lop}
                </Paragraph>
                <Text type="secondary">
                  Nhà trường sẽ liên hệ xác nhận thông tin và duyệt hồ sơ trước ngày khai giảng.
                </Text>
              </div>
            }
            extra={
              <div
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: 10,
                  justifyContent: 'center',
                }}
              >
                <Button type="primary" key="them" icon={<PlusOutlined />} onClick={dangKyMoi} block={isMobile} size="large">
                  Đăng ký thêm khóa học / học viên khác
                </Button>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: isMobile ? '12px 8px' : '32px 16px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <Card
          style={{
            borderRadius: isMobile ? 12 : 16,
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
          styles={{ body: { padding: isMobile ? '20px 14px' : '32px 40px' } }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 20 : 32 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <div
                style={{
                  width: isMobile ? 48 : 56,
                  height: isMobile ? 48 : 56,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #1677ff, #0958d9)',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 7,
                  boxShadow: '0 6px 16px rgba(22, 119, 255, 0.28)',
                }}
              >
                <img
                  src="/logo.png"
                  alt="Logo PTNL"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            </div>
            <Title level={isMobile ? 4 : 2} style={{ margin: '0 0 8px', color: '#0f1f3d' }}>
              Phiếu Đăng Ký Khóa Đào Tạo
            </Title>
            <Paragraph type="secondary" style={{ fontSize: isMobile ? 13 : 14, marginBottom: 0 }}>
              Học viên vui lòng điền đầy đủ và chính xác các thông tin bên dưới để hoàn tất đăng ký.
            </Paragraph>
          </div>

          <Form
            form={form}
            layout="vertical"
            size="large"
            onFinish={onFinish}
            initialValues={{
              gender: 'Nam',
              ethnicity: 'Kinh',
              nationality: 'Việt Nam',
            }}
          >
            {/* 1. Thông tin cá nhân */}
            <Title level={5} style={{ color: '#1677ff', borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
              1. Thông tin cá nhân
            </Title>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="idNumber"
                  label="Số CCCD / CMND:"
                  rules={[
                    { required: true, message: 'Vui lòng nhập số CCCD' },
                    { pattern: /^\d{12}$/, message: 'Số CCCD phải gồm đúng 12 chữ số' },
                  ]}
                >
                  <Input placeholder="12 chữ số trên căn cước công dân" maxLength={12} onBlur={onCCCDBlur} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="fullName"
                  label="Họ và tên:"
                  rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
                >
                  <Input placeholder="VÍ DỤ: NGUYỄN VĂN AN" style={{ textTransform: 'uppercase' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="dob"
                  label="Ngày sinh:"
                  rules={[
                    { required: true, message: 'Vui lòng chọn ngày sinh' },
                    {
                      validator: (_, value) => {
                        if (!value) return Promise.resolve();
                        const age = dayjs().diff(dayjs(value), 'year');
                        if (age < 16) return Promise.reject('Học viên phải đủ 16 tuổi');
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <DatePicker
                    format="DD/MM/YYYY"
                    placeholder="DD/MM/YYYY"
                    style={{ width: '100%' }}
                    disabledDate={(d) => d && d > dayjs().subtract(15, 'year')}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="gender"
                  label="Giới tính:"
                  rules={[{ required: true, message: 'Chọn giới tính' }]}
                >
                  <Radio.Group>
                    <Radio value="Nam">Nam</Radio>
                    <Radio value="Nữ">Nữ</Radio>
                  </Radio.Group>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="pob"
                  label="Nơi sinh (Tỉnh / Thành):"
                  rules={[{ required: true, message: 'Chọn nơi sinh' }]}
                >
                  <Select
                    showSearch
                    placeholder="Chọn tỉnh/thành"
                    options={PROVINCES_LIST.map((p) => ({ value: p, label: p }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="ethnicity" label="Dân tộc:">
                  <Input placeholder="Kinh, Tày, Nùng..." />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="nationality" label="Quốc tịch:">
                  <Input placeholder="Việt Nam" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="phone"
                  label="Số điện thoại liên hệ:"
                  rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
                >
                  <Input placeholder="09xxxxxxx" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="address"
                  label="Địa chỉ thường trú:"
                  rules={[{ required: true, message: 'Vui lòng nhập địa chỉ thường trú' }]}
                >
                  <Input placeholder="Số nhà, đường, xã/phường, quận/huyện, tỉnh/thành" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="company" label="Cơ quan / Đơn vị công tác (Nếu có):">
                  <Input placeholder="Tên công ty, cơ quan đang làm việc" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="notes" label="Ghi chú thêm:">
              <Input.TextArea rows={2} placeholder="Yêu cầu đặc biệt hoặc thông tin bổ sung..." />
            </Form.Item>

            {/* 2. Chọn lớp học */}
            <Title level={5} style={{ color: '#1677ff', borderBottom: '1px solid #f0f0f0', paddingBottom: 8, marginTop: 24 }}>
              2. Lớp học đăng ký
            </Title>
            <Form.Item
              name="classIds"
              label="Chọn lớp học (Có thể chọn nhiều lớp):"
              rules={[{ required: true, message: 'Vui lòng chọn ít nhất 1 lớp học!' }]}
            >
              <Select
                mode="multiple"
                placeholder="Tìm kiếm và chọn lớp học..."
                loading={dangTaiLop}
                allowClear
                options={danhSachLop?.map((c: any) => ({
                  value: c.documentId || c.id,
                  label: `${c.code ? `[${c.code}] ` : ''}${c.name}`,
                }))}
              />
            </Form.Item>

            {/* 3. Tải lên hình ảnh hồ sơ */}
            <Title level={5} style={{ color: '#1677ff', borderBottom: '1px solid #f0f0f0', paddingBottom: 8, marginTop: 24 }}>
              3. Giấy tờ đính kèm
            </Title>
            <Row gutter={16}>
              <Col xs={24} md={8} style={{ display: 'none' }}>
                <Card size="small" title="Ảnh 3x4 (Nền xanh/trắng)" style={{ textAlign: 'center', marginBottom: 16 }}>
                  {anh3x4 && (
                    <div style={{ marginBottom: 8 }}>
                      <img
                        src={anh3x4}
                        alt="3x4"
                        style={{ width: 100, height: 133, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }}
                      />
                    </div>
                  )}
                  <Space direction="vertical" size={6}>
                    <Button size="small" type="primary" ghost icon={<CameraOutlined />} onClick={moCamera}>
                      Chụp ảnh 3x4
                    </Button>
                    <Upload
                      showUploadList={false}
                      beforeUpload={(f) => xuLyUpload(f, '3x4')}
                      accept="image/*"
                    >
                      <Button size="small" icon={<PictureOutlined />}>Tải ảnh 3x4</Button>
                    </Upload>
                    {anh3x4 && (
                      <Button size="small" danger onClick={() => setAnh3x4(null)}>
                        Xóa ảnh
                      </Button>
                    )}
                  </Space>
                </Card>
              </Col>

              <Col xs={24} md={12}>
                <Card size="small" title="CCCD Mặt trước" style={{ textAlign: 'center', marginBottom: 16 }}>
                  {anhCccdTruoc ? (
                    <div>
                      <img
                        src={anhCccdTruoc}
                        alt="CCCD Trước"
                        style={{ width: '100%', maxHeight: 110, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Button size="small" danger onClick={() => setAnhCccdTruoc(null)}>
                          Xóa ảnh
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Upload
                      showUploadList={false}
                      beforeUpload={(f) => xuLyUpload(f, 'cccd_truoc')}
                      accept="image/*"
                    >
                      <Button icon={<IdcardOutlined />}>Tải mặt trước</Button>
                    </Upload>
                  )}
                </Card>
              </Col>

              <Col xs={24} md={12}>
                <Card size="small" title="CCCD Mặt sau" style={{ textAlign: 'center', marginBottom: 16 }}>
                  {anhCccdSau ? (
                    <div>
                      <img
                        src={anhCccdSau}
                        alt="CCCD Sau"
                        style={{ width: '100%', maxHeight: 110, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Button size="small" danger onClick={() => setAnhCccdSau(null)}>
                          Xóa ảnh
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Upload
                      showUploadList={false}
                      beforeUpload={(f) => xuLyUpload(f, 'cccd_sau')}
                      accept="image/*"
                    >
                      <Button icon={<IdcardOutlined />}>Tải mặt sau</Button>
                    </Upload>
                  )}
                </Card>
              </Col>
            </Row>

            {/* Nút gửi */}
            <div
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row-reverse',
                gap: 12,
                justifyContent: isMobile ? 'stretch' : 'flex-start',
                marginTop: 24,
              }}
            >
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={dangGui}
                icon={<CheckCircleOutlined />}
                block={isMobile}
                style={{ fontWeight: 600 }}
              >
                Gửi Phiếu Đăng Ký
              </Button>
              <Button
                size="large"
                icon={<ReloadOutlined />}
                onClick={dangKyMoi}
                block={isMobile}
              >
                Nhập lại phiếu
              </Button>
            </div>
          </Form>
        </Card>
      </div>

      {/* Modal Camera chụp ảnh */}
      <Modal
        title="Chụp ảnh học viên"
        open={isCameraOpen}
        onCancel={dongCamera}
        footer={null}
        width={isMobile ? '95%' : 520}
        centered
        destroyOnClose
      >
        <div style={{ textAlign: 'center' }}>
          <video ref={videoRef} autoPlay style={{ width: '100%', maxHeight: 400, borderRadius: 8 }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={{ marginTop: 12 }}>
            <Button type="primary" icon={<CameraOutlined />} onClick={chupAnh} size="large">
              Chụp
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={dongCamera}>
              Hủy
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

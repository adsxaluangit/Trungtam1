import { useEffect, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  FileDoneOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { api, COLLECTIONS, normalizeStrapiList } from '../api';

const { Title, Text } = Typography;
const { TextArea } = Input;

type TemplateType = 'decision' | 'recognition' | 'certificate_list';

interface TemplateCardInfo {
  type: TemplateType;
  title: string;
  description: string;
  iconColor: string;
}

const TEMPLATE_CARDS: TemplateCardInfo[] = [
  {
    type: 'decision',
    title: 'Mẫu Quyết định Mở lớp Đào tạo',
    description: 'Quyết định hành chính thành lập lớp đào tạo, căn cứ pháp lý và danh sách học viên',
    iconColor: '#1677ff',
  },
  {
    type: 'recognition',
    title: 'Mẫu Quyết định Công nhận Tốt nghiệp',
    description: 'Quyết định công nhận hoàn thành khóa học và cấp chứng chỉ đào tạo chuyên môn',
    iconColor: '#52c41a',
  },
  {
    type: 'certificate_list',
    title: 'Mẫu Danh sách Đề nghị Cấp GCN',
    description: 'Biểu mẫu danh sách thí sinh đạt yêu cầu cấp giấy chứng chỉ kèm điểm chi tiết',
    iconColor: '#722ed1',
  },
];

const DEFAULT_TEMPLATES: Record<TemplateType, any> = {
  decision: {
    headerLine1: 'BỘ GIAO THÔNG VẬN TẢI',
    headerLine2: 'TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM',
    headerLine3: '',
    nation: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    motto: 'Độc lập - Tự do - Hạnh phúc',
    title: 'QUYẾT ĐỊNH',
    subtitle: 'Về việc mở lớp đào tạo chứng chỉ chuyên môn',
    authority: 'HIỆU TRƯỞNG TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM',
    preamble:
      'Căn cứ Luật Giáo dục nghề nghiệp ngày 27 tháng 11 năm 2014;\nCăn cứ chức năng nhiệm vụ và quyền hạn của Trường Đại học Hàng hải Việt Nam;\nXét đề nghị của Trưởng phòng Đào tạo.',
    article1: 'Mở lớp đào tạo chứng chỉ chuyên môn cho các học viên có tên trong danh sách đính kèm.',
    article2: 'Thời gian đào tạo, địa điểm và chương trình thực hiện theo kế hoạch chi tiết của Phòng Đào tạo.',
    article3: 'Các Ông (Bà) Trưởng phòng Đào tạo, Trưởng các đơn vị liên quan và các học viên có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này.',
    signerTitle: 'HIỆU TRƯỞNG',
    signerName: 'PGS. TS. PHẠM XUÂN DƯƠNG',
    recipients: '- Như Điều 3;\n- Ban Giám hiệu (để b/c);\n- Lưu: VT, ĐT.',
  },
  recognition: {
    headerLine1: 'BỘ GIAO THÔNG VẬN TẢI',
    headerLine2: 'TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM',
    headerLine3: '',
    nation: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    motto: 'Độc lập - Tự do - Hạnh phúc',
    title: 'QUYẾT ĐỊNH',
    subtitle: 'Về việc công nhận tốt nghiệp và cấp Giấy chứng nhận',
    authority: 'HIỆU TRƯỞNG TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM',
    preamble:
      'Căn cứ Quy chế đào tạo và kiểm tra công nhận kết quả học tập hiện hành;\nCăn cứ Biên bản họp Hội đồng thi và xét duyệt công nhận kết quả đào tạo;\nTheo đề nghị của Trưởng phòng Đào tạo.',
    article1: 'Công nhận tốt nghiệp và cấp Giấy chứng nhận cho các học viên đủ điều kiện.',
    article2: 'Phòng Đào tạo có trách nhiệm hoàn tất thủ tục cấp phát chứng chỉ theo đúng quy định.',
    article3: 'Trưởng phòng Đào tạo, các đơn vị liên quan và các cá nhân có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này.',
    signerTitle: 'HIỆU TRƯỞNG',
    signerName: 'PGS. TS. PHẠM XUÂN DƯƠNG',
    recipients: '- Như Điều 3;\n- Ban Giám hiệu;\n- Lưu: VT, ĐT.',
  },
  certificate_list: {
    headerLine1: 'BỘ GIAO THÔNG VẬN TẢI',
    headerLine2: 'TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM',
    headerLine3: 'PHÒNG ĐÀO TẠO',
    nation: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    motto: 'Độc lập - Tự do - Hạnh phúc',
    title: 'DANH SÁCH ĐỀ NGHỊ CẤP GIẤY CHỨNG NHẬN',
    subtitle: 'DANH SÁCH HỌC VIÊN ĐỦ ĐIỀU KIỆN TỐT NGHIỆP',
    preamble: 'Kèm theo Quyết định số: .../QĐ-ĐHHHVN',
    signerTitle: 'TRƯỞNG PHÒNG ĐÀO TẠO',
    signerName: 'TS. NGUYỄN VĂN A',
    signerTitle2: 'NGƯỜI LẬP BIỂU',
    signerName2: 'NGUYỄN VĂN B',
  },
};

export default function MauIn() {
  const { message } = App.useApp();

  const [_loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [editingType, setEditingType] = useState<TemplateType | null>(null);
  const [templateForm] = Form.useForm();
  const [previewData, setPreviewData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await api<any>(`/${COLLECTIONS.PRINT_TEMPLATES}?publicationState=preview&pagination[limit]=100`);
      const list = normalizeStrapiList(res);
      setTemplates(list);
    } catch (err: any) {
      console.warn('Lỗi tải danh sách mẫu in:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (type: TemplateType) => {
    const found = templates.find((t) => t.type === type);
    const initialContent = found?.content || DEFAULT_TEMPLATES[type];
    setPreviewData(initialContent);
    setEditingType(type);
  };

  useEffect(() => {
    if (editingType && previewData) {
      templateForm.setFieldsValue(previewData);
    }
  }, [editingType]);

  const handleValuesChange = (_: any, allValues: any) => {
    setPreviewData(allValues);
  };

  const handleSave = async () => {
    if (!editingType) return;
    setSaving(true);
    try {
      const values = { ...previewData, ...templateForm.getFieldsValue() };
      const found = templates.find((t) => t.type === editingType);

      const payload = {
        data: {
          type: editingType,
          name:
            editingType === 'decision'
              ? 'Quyết định mở lớp'
              : editingType === 'recognition'
              ? 'Quyết định công nhận'
              : 'DS Đề nghị cấp GCN',
          content: values,
          publishedAt: new Date().toISOString(),
        },
      };

      if (found) {
        const docId = found.documentId || found.id;
        await api(`/${COLLECTIONS.PRINT_TEMPLATES}/${docId}`, {
          method: 'PUT',
          body: payload,
        });
      } else {
        await api(`/${COLLECTIONS.PRINT_TEMPLATES}`, {
          method: 'POST',
          body: payload,
        });
      }

      message.success('Đã lưu mẫu in thành công lên máy chủ!');
      await loadTemplates();
    } catch (err: any) {
      message.error('Lỗi khi lưu mẫu in: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  // Editor View
  if (editingType) {
    const isCertList = editingType === 'certificate_list';

    return (
      <div style={{ padding: '0 0 24px 0' }}>
        <Card style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space align="center">
                <Button icon={<ArrowLeftOutlined />} onClick={() => setEditingType(null)}>
                  Quay lại
                </Button>
                <Title level={4} style={{ margin: 0 }}>
                  Chỉnh sửa mẫu:{' '}
                  {editingType === 'decision'
                    ? 'Quyết định mở lớp'
                    : editingType === 'recognition'
                    ? 'Quyết định công nhận tốt nghiệp'
                    : 'Danh sách đề nghị cấp GCN'}
                </Title>
              </Space>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSave}
              >
                Lưu mẫu in
              </Button>
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]}>
          {/* Form Settings Left Panel */}
          <Col xs={24} lg={10}>
            <Card
              title="Cấu hình nội dung mẫu"
              styles={{ body: { maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' } }}
            >
              <Form
                form={templateForm}
                layout="vertical"
                onValuesChange={handleValuesChange}
              >
                <Title level={5}>1. Quốc hiệu & Đơn vị ban hành</Title>
                <Form.Item name="headerLine1" label="Cơ quan cấp trên">
                  <Input placeholder="BỘ GIAO THÔNG VẬN TẢI" />
                </Form.Item>
                <Form.Item name="headerLine2" label="Tên đơn vị ban hành">
                  <Input placeholder="TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM" />
                </Form.Item>
                <Form.Item name="headerLine3" label="Khoa / Trung tâm đào tạo (nếu có)">
                  <Input placeholder="VIỆN ĐÀO TẠO..." />
                </Form.Item>
                <Form.Item name="nation" label="Quốc hiệu">
                  <Input placeholder="CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" />
                </Form.Item>
                <Form.Item name="motto" label="Tiêu ngữ">
                  <Input placeholder="Độc lập - Tự do - Hạnh phúc" />
                </Form.Item>

                <Title level={5} style={{ marginTop: 16 }}>
                  2. Tiêu đề & Căn cứ pháp lý
                </Title>
                <Form.Item name="title" label="Tiêu đề văn bản">
                  <Input placeholder="QUYẾT ĐỊNH" />
                </Form.Item>
                <Form.Item name="subtitle" label="Trích yếu nội dung">
                  <Input placeholder="Về việc mở lớp..." />
                </Form.Item>
                <Form.Item name="authority" label="Thẩm quyền ban hành">
                  <Input placeholder="HIỆU TRƯỞNG TRƯỜNG..." />
                </Form.Item>
                <Form.Item name="preamble" label="Căn cứ ban hành (Mỗi căn cứ xuống dòng)">
                  <TextArea rows={4} placeholder="Căn cứ Luật Giáo dục..." />
                </Form.Item>

                {!isCertList && (
                  <>
                    <Title level={5} style={{ marginTop: 16 }}>
                      3. Nội dung các Điều khoản
                    </Title>
                    <Form.Item name="article1" label="Điều 1">
                      <TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="article2" label="Điều 2">
                      <TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="article3" label="Điều 3">
                      <TextArea rows={2} />
                    </Form.Item>
                  </>
                )}

                <Title level={5} style={{ marginTop: 16 }}>
                  4. Chữ ký & Nơi nhận
                </Title>
                {isCertList && (
                  <>
                    <Form.Item name="signerTitle2" label="Chức vụ người ký bên trái">
                      <Input placeholder="NGƯỜI LẬP BIỂU" />
                    </Form.Item>
                    <Form.Item name="signerName2" label="Họ tên người ký bên trái">
                      <Input placeholder="Nguyễn Văn A" />
                    </Form.Item>
                  </>
                )}
                <Form.Item name="signerTitle" label="Chức vụ người ký chính">
                  <Input placeholder="HIỆU TRƯỞNG" />
                </Form.Item>
                <Form.Item name="signerName" label="Họ tên người ký chính">
                  <Input placeholder="PGS. TS. Phạm Xuân Dương" />
                </Form.Item>
                {!isCertList && (
                  <Form.Item name="recipients" label="Nơi nhận">
                    <TextArea rows={3} placeholder="- Như Điều 3;..." />
                  </Form.Item>
                )}
              </Form>
            </Card>
          </Col>

          {/* Right Live Preview Panel */}
          <Col xs={24} lg={14}>
            <Card
              title="Xem trước văn bản in (A4 Tiêu chuẩn)"
              extra={<Tag color="blue">Khổ A4 (210mm x 297mm)</Tag>}
              styles={{
                body: {
                  background: '#e9ecef',
                  padding: 24,
                  display: 'flex',
                  justifyContent: 'center',
                  maxHeight: 'calc(100vh - 220px)',
                  overflowY: 'auto',
                },
              }}
            >
              <div
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  background: '#fff',
                  padding: '25mm 20mm 20mm 25mm',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontFamily: '"Times New Roman", Times, serif',
                  fontSize: '13pt',
                  lineHeight: 1.5,
                  color: '#000',
                }}
              >
                {/* Header */}
                <Row justify="space-between" style={{ marginBottom: 20 }}>
                  <Col span={11} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11pt', textTransform: 'uppercase' }}>
                      {previewData.headerLine1}
                    </div>
                    <div style={{ fontSize: '11pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {previewData.headerLine2}
                    </div>
                    {previewData.headerLine3 && (
                      <div
                        style={{
                          fontSize: '11pt',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid #000',
                          display: 'inline-block',
                          paddingBottom: 2,
                        }}
                      >
                        {previewData.headerLine3}
                      </div>
                    )}
                    <div style={{ fontSize: '11pt', marginTop: 4 }}>Số: .../QĐ-ĐHHHVN</div>
                  </Col>

                  <Col span={13} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {previewData.nation}
                    </div>
                    <div
                      style={{
                        fontSize: '12pt',
                        fontWeight: 'bold',
                        borderBottom: '1px solid #000',
                        display: 'inline-block',
                        paddingBottom: 2,
                      }}
                    >
                      {previewData.motto}
                    </div>
                    <div style={{ fontSize: '11pt', fontStyle: 'italic', marginTop: 4 }}>
                      Hải Phòng, ngày ... tháng ... năm ...
                    </div>
                  </Col>
                </Row>

                {/* Title */}
                <div style={{ textAlign: 'center', margin: '24px 0 16px 0' }}>
                  <div style={{ fontSize: '15pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {previewData.title}
                  </div>
                  <div style={{ fontSize: '12pt', fontWeight: 'bold' }}>
                    {previewData.subtitle}
                  </div>
                </div>

                {/* Authority */}
                {previewData.authority && (
                  <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 16 }}>
                    {previewData.authority}
                  </div>
                )}

                {/* Preamble */}
                <div style={{ textAlign: 'justify', marginBottom: 16 }}>
                  {(previewData.preamble || '').split('\n').map((line: string, i: number) => (
                    <p key={i} style={{ margin: '3px 0', textIndent: '1.2cm', fontStyle: 'italic' }}>
                      {line}
                    </p>
                  ))}
                </div>

                {/* Articles or Table */}
                {!isCertList ? (
                  <div>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '14px 0 10px 0' }}>
                      QUYẾT ĐỊNH:
                    </div>
                    <p style={{ textAlign: 'justify', textIndent: '1.2cm', margin: '6px 0' }}>
                      <span style={{ fontWeight: 'bold' }}>Điều 1.</span> {previewData.article1}
                    </p>
                    <p style={{ textAlign: 'justify', textIndent: '1.2cm', margin: '6px 0' }}>
                      <span style={{ fontWeight: 'bold' }}>Điều 2.</span> {previewData.article2}
                    </p>
                    <p style={{ textAlign: 'justify', textIndent: '1.2cm', margin: '6px 0' }}>
                      <span style={{ fontWeight: 'bold' }}>Điều 3.</span> {previewData.article3}
                    </p>
                  </div>
                ) : (
                  <div style={{ margin: '16px 0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }} border={1}>
                      <thead>
                        <tr style={{ textAlign: 'center', background: '#f5f5f5' }}>
                          <th style={{ padding: 4, width: 35 }}>STT</th>
                          <th style={{ padding: 4 }}>HỌ VÀ TÊN</th>
                          <th style={{ padding: 4, width: 85 }}>NGÀY SINH</th>
                          <th style={{ padding: 4, width: 100 }}>SỐ CCCD</th>
                          <th style={{ padding: 4 }}>NƠI SINH</th>
                          <th style={{ padding: 4, width: 60 }}>KẾT QUẢ</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ textAlign: 'center', padding: 4 }}>1</td>
                          <td style={{ padding: 4 }}>Nguyễn Văn An</td>
                          <td style={{ textAlign: 'center', padding: 4 }}>15/08/1995</td>
                          <td style={{ textAlign: 'center', padding: 4 }}>031095001234</td>
                          <td style={{ padding: 4 }}>Hải Phòng</td>
                          <td style={{ textAlign: 'center', padding: 4 }}>Đạt</td>
                        </tr>
                        <tr>
                          <td style={{ textAlign: 'center', padding: 4 }}>2</td>
                          <td style={{ padding: 4 }}>Trần Thị Bình</td>
                          <td style={{ textAlign: 'center', padding: 4 }}>20/11/1998</td>
                          <td style={{ textAlign: 'center', padding: 4 }}>031098005678</td>
                          <td style={{ padding: 4 }}>Quảng Ninh</td>
                          <td style={{ textAlign: 'center', padding: 4 }}>Đạt</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer Signatures */}
                <Row justify="space-between" style={{ marginTop: 36, alignItems: 'flex-start' }}>
                  <Col span={11}>
                    {isCertList ? (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 'bold' }}>{previewData.signerTitle2}</div>
                        <div style={{ height: 60 }} />
                        <div style={{ fontWeight: 'bold' }}>{previewData.signerName2}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '11pt', fontStyle: 'italic' }}>
                        <div style={{ fontWeight: 'bold' }}>Nơi nhận:</div>
                        <div style={{ whiteSpace: 'pre-line' }}>{previewData.recipients}</div>
                      </div>
                    )}
                  </Col>

                  <Col span={11} style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {previewData.signerTitle}
                    </div>
                    <div style={{ height: 60 }} />
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {previewData.signerName}
                    </div>
                  </Col>
                </Row>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  // Dashboard list view
  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space align="center" size="middle">
              <PrinterOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Quản lý Mẫu in & Biểu mẫu Văn bản
                </Title>
                <Text type="secondary">
                  Tùy chỉnh nội dung tiêu đề, căn cứ pháp lý, các điều khoản và thông tin người ký
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={loadTemplates}>
              Làm mới
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        {TEMPLATE_CARDS.map((card) => {
          const hasDb = templates.some((t) => t.type === card.type);
          return (
            <Col xs={24} md={8} key={card.type}>
              <Card
                hoverable
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
              >
                <div style={{ flex: 1 }}>
                  <Space align="center" style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: `${card.iconColor}15`,
                        display: 'grid',
                        placeItems: 'center',
                        color: card.iconColor,
                        fontSize: 20,
                      }}
                    >
                      <FileDoneOutlined />
                    </div>
                    <div>
                      <Title level={5} style={{ margin: 0 }}>
                        {card.title}
                      </Title>
                      <Tag color={hasDb ? 'green' : 'orange'}>
                        {hasDb ? 'Đã lưu cấu hình' : 'Mặc định hệ thống'}
                      </Tag>
                    </div>
                  </Space>
                  <p style={{ color: '#8c8c8c', fontSize: 13, minHeight: 40 }}>
                    {card.description}
                  </p>
                </div>

                <Button
                  type="primary"
                  block
                  icon={<EditOutlined />}
                  onClick={() => handleStartEdit(card.type)}
                >
                  Chỉnh sửa mẫu in
                </Button>
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}

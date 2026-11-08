import { useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  GlobalOutlined,
  RobotOutlined,
  SaveOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { tokenStore } from '../api';

const { Title, Text, Paragraph } = Typography;

type ProviderType = 'gemini' | 'nano_banana';

export default function AiConfig() {
  const [form] = Form.useForm();
  const [provider, setProvider] = useState<ProviderType>('gemini');

  // Masked keys from server
  const [geminiMaskedKey, setGeminiMaskedKey] = useState('');
  const [nanoBananaMaskedKey, setNanoBananaMaskedKey] = useState('');
  const [nanoBananaBaseUrl, setNanoBananaBaseUrl] = useState('https://api.nanobananaapi.ai/api/v1');
  const [nanoBananaModel, setNanoBananaModel] = useState('NanoBanana 2');

  const [showKey, setShowKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const token = tokenStore.get() || '';
      const res = await fetch('/api/system-config/ai-config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProvider(data.provider || 'gemini');
        setIsConfigured(data.isConfigured || false);
        setGeminiMaskedKey(data.geminiMaskedKey || '');
        setNanoBananaMaskedKey(data.nanoBananaMaskedKey || '');
        if (data.nanoBananaBaseUrl) setNanoBananaBaseUrl(data.nanoBananaBaseUrl);
        if (data.nanoBananaModel) setNanoBananaModel(data.nanoBananaModel);
      }
    } catch (err) {
      console.error('Failed to fetch AI config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (values: any) => {
    if (provider === 'gemini' && !values.geminiApiKey && !geminiMaskedKey) {
      form.setFields([{ name: 'geminiApiKey', errors: ['Vui lòng nhập Google Gemini API Key!'] }]);
      return;
    }
    if (provider === 'nano_banana' && !values.nanoBananaApiKey && !nanoBananaMaskedKey) {
      form.setFields([{ name: 'nanoBananaApiKey', errors: ['Vui lòng nhập Nano Banana API Key!'] }]);
      return;
    }

    setSaving(true);
    setTestResult(null);
    try {
      const token = tokenStore.get() || '';
      const res = await fetch('/api/system-config/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          geminiApiKey: values.geminiApiKey?.trim() || undefined,
          nanoBananaApiKey: values.nanoBananaApiKey?.trim() || undefined,
          nanoBananaBaseUrl: (values.nanoBananaBaseUrl || nanoBananaBaseUrl).trim(),
          nanoBananaModel: (values.nanoBananaModel || nanoBananaModel).trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsConfigured(data.isConfigured);
        setGeminiMaskedKey(data.geminiMaskedKey || '');
        setNanoBananaMaskedKey(data.nanoBananaMaskedKey || '');
        form.setFieldsValue({ geminiApiKey: '', nanoBananaApiKey: '' });
        setTestResult({
          success: true,
          message: `Đã lưu cấu hình ${provider === 'gemini' ? 'Google Gemini' : 'Nano Banana API'} thành công!`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error?.message || data.message || 'Lỗi khi lưu cấu hình AI',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Lỗi kết nối máy chủ: ' + (err.message || String(err)),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestKey = async () => {
    const values = form.getFieldsValue();
    setTesting(true);
    setTestResult(null);
    try {
      const token = tokenStore.get() || '';
      const res = await fetch('/api/system-config/test-ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          geminiApiKey: values.geminiApiKey?.trim() || undefined,
          nanoBananaApiKey: values.nanoBananaApiKey?.trim() || undefined,
          nanoBananaBaseUrl: (values.nanoBananaBaseUrl || nanoBananaBaseUrl).trim(),
          nanoBananaModel: (values.nanoBananaModel || nanoBananaModel).trim(),
        }),
      });

      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success
          ? data.message + (data.reply ? ` (${data.reply})` : '')
          : data.message || 'Kết nối thất bại',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Lỗi kết nối kiểm tra: ' + (err.message || String(err)),
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
        <Spin size="large" tip="Đang tải cấu hình AI..." />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e3a8a 100%)',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 24,
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Space align="start" size={16}>
            <div
              style={{
                width: 56,
                height: 56,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 14,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <RobotOutlined style={{ fontSize: 28, color: '#fbbf24' }} />
            </div>
            <div>
              <Title level={4} style={{ color: '#fff', margin: 0 }}>
                Quản lý Cấu hình Nhà cung cấp AI
              </Title>
              <Text style={{ color: '#93c5fd', fontSize: 13 }}>
                Kết nối linh hoạt giữa Google Gemini AI và Nano Banana API để xử lý ảnh thẻ, tách nền và chuẩn hóa hồ sơ học viên tự động.
              </Text>
            </div>
          </Space>
        </div>
      </div>

      {/* Provider Selection */}
      <Card style={{ marginBottom: 20 }}>
        <Title level={5} style={{ marginBottom: 16 }}>
          1. Chọn nhà cung cấp AI
        </Title>
        <Row gutter={16}>
          {/* Google Gemini */}
          <Col xs={24} md={12}>
            <div
              onClick={() => setProvider('gemini')}
              style={{
                cursor: 'pointer',
                border: `2px solid ${provider === 'gemini' ? '#1677ff' : '#e2e8f0'}`,
                borderRadius: 12,
                padding: 20,
                background: provider === 'gemini' ? '#eff6ff' : '#fff',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: provider === 'gemini' ? '#1677ff' : '#f1f5f9',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <ApiOutlined style={{ fontSize: 22, color: provider === 'gemini' ? '#fff' : '#64748b' }} />
              </div>
              <div style={{ flex: 1 }}>
                <Text strong>Google Gemini AI</Text>
                <Paragraph style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                  Mô hình gemini-2.5-flash-image, tốc độ cao, xử lý ảnh sắc nét.
                </Paragraph>
                {geminiMaskedKey ? (
                  <Tag color="green" style={{ marginTop: 6 }}>Key: {geminiMaskedKey}</Tag>
                ) : (
                  <Tag color="orange" style={{ marginTop: 6 }}>Chưa cài Key</Tag>
                )}
              </div>
              {provider === 'gemini' && (
                <CheckCircleOutlined style={{ color: '#1677ff', fontSize: 20 }} />
              )}
            </div>
          </Col>

          {/* Nano Banana */}
          <Col xs={24} md={12}>
            <div
              onClick={() => setProvider('nano_banana')}
              style={{
                cursor: 'pointer',
                border: `2px solid ${provider === 'nano_banana' ? '#6366f1' : '#e2e8f0'}`,
                borderRadius: 12,
                padding: 20,
                background: provider === 'nano_banana' ? '#eef2ff' : '#fff',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: provider === 'nano_banana' ? '#6366f1' : '#f1f5f9',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <GlobalOutlined style={{ fontSize: 22, color: provider === 'nano_banana' ? '#fff' : '#64748b' }} />
              </div>
              <div style={{ flex: 1 }}>
                <Text strong>Nano Banana API 🍌</Text>
                <Paragraph style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                  Dịch vụ NanoBananaAPI.ai - Tiết kiệm chi phí & chất lượng cao.
                </Paragraph>
                {nanoBananaMaskedKey ? (
                  <Tag color="green" style={{ marginTop: 6 }}>Key: {nanoBananaMaskedKey}</Tag>
                ) : (
                  <Tag color="orange" style={{ marginTop: 6 }}>Chưa cài Key</Tag>
                )}
              </div>
              {provider === 'nano_banana' && (
                <CheckCircleOutlined style={{ color: '#6366f1', fontSize: 20 }} />
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* Status */}
      <Card style={{ marginBottom: 20 }}>
        <Title level={5} style={{ marginBottom: 16 }}>Trạng thái cấu hình hiện tại</Title>
        {isConfigured ? (
          <Alert
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            message={
              <span>
                Đang kích hoạt: <strong>{provider === 'gemini' ? 'Google Gemini AI' : 'Nano Banana API'}</strong>
                {' — Mã Key: '}
                <code style={{ background: '#d1fae5', padding: '2px 6px', borderRadius: 4 }}>
                  {provider === 'gemini' ? geminiMaskedKey : nanoBananaMaskedKey}
                </code>
              </span>
            }
          />
        ) : (
          <Alert
            type="warning"
            icon={<WarningOutlined />}
            showIcon
            message="Chưa cấu hình API Key cho nhà cung cấp hiện tại. Vui lòng nhập API Key bên dưới để sử dụng tính năng xử lý ảnh AI."
          />
        )}
      </Card>

      {/* Config Form */}
      <Card>
        <Title level={5} style={{ marginBottom: 20 }}>
          2. Điền thông số API cho {provider === 'gemini' ? 'Google Gemini' : 'Nano Banana API'}
        </Title>

        <Form form={form} layout="vertical" onFinish={handleSave}>
          {provider === 'gemini' ? (
            <Form.Item
              name="geminiApiKey"
              label="Google Gemini API Key"
              extra={
                geminiMaskedKey
                  ? `Key hiện tại: ${geminiMaskedKey} — Để trống nếu không muốn thay đổi`
                  : 'Lấy key tại aistudio.google.com/app/apikey'
              }
            >
              <Input.Password
                placeholder={
                  geminiMaskedKey
                    ? `${geminiMaskedKey} (để trống nếu không đổi)`
                    : 'Dán Gemini API Key vào đây (VD: AIzaSyD...)'
                }
                iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
                visibilityToggle={{ visible: showKey, onVisibleChange: setShowKey }}
              />
            </Form.Item>
          ) : (
            <>
              <Form.Item
                name="nanoBananaApiKey"
                label="Nano Banana API Key"
                extra={
                  nanoBananaMaskedKey
                    ? `Key hiện tại: ${nanoBananaMaskedKey} — Để trống nếu không muốn thay đổi`
                    : 'Lấy key tại nanobananaapi.ai/api-key'
                }
              >
                <Input.Password
                  placeholder={
                    nanoBananaMaskedKey
                      ? `${nanoBananaMaskedKey} (để trống nếu không đổi)`
                      : 'Dán Nano Banana API Key vào đây...'
                  }
                  iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
                  visibilityToggle={{ visible: showKey, onVisibleChange: setShowKey }}
                />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} md={14}>
                  <Form.Item
                    name="nanoBananaBaseUrl"
                    label="Base Endpoint URL"
                    initialValue={nanoBananaBaseUrl}
                  >
                    <Input placeholder="https://api.nanobananaapi.ai/api/v1" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={10}>
                  <Form.Item
                    name="nanoBananaModel"
                    label="Tên mô hình (Model Name)"
                    initialValue={nanoBananaModel}
                  >
                    <Input placeholder="NanoBanana 2" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {testResult && (
            <Alert
              type={testResult.success ? 'success' : 'error'}
              message={testResult.message}
              showIcon
              style={{ marginBottom: 20 }}
              closable
              onClose={() => setTestResult(null)}
            />
          )}

          <Divider />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button
              icon={<ExperimentOutlined />}
              loading={testing}
              onClick={handleTestKey}
            >
              Kiểm tra kết nối AI
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              htmlType="submit"
            >
              Lưu cấu hình ({provider === 'gemini' ? 'Gemini' : 'Nano Banana'})
            </Button>
          </div>
        </Form>
      </Card>

      {/* Guide */}
      <Card style={{ marginTop: 20, background: '#f8fafc' }}>
        <Title level={5}>Hướng dẫn tích hợp</Title>
        <ul style={{ paddingLeft: 20, fontSize: 13, color: '#475569', lineHeight: 2 }}>
          <li>
            <strong>Google Gemini:</strong> Lấy key tại{' '}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
              aistudio.google.com
            </a>
            . Thích hợp cho xử lý ảnh thẻ mặc định.
          </li>
          <li>
            <strong>Nano Banana API:</strong> Lấy API Key tại{' '}
            <a href="https://nanobananaapi.ai/api-key" target="_blank" rel="noopener noreferrer">
              nanobananaapi.ai/api-key
            </a>
            . Base URL mặc định là <code>https://api.nanobananaapi.ai/api/v1</code>.
          </li>
        </ul>
      </Card>
    </div>
  );
}


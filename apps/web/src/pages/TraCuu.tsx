import { useEffect, useRef, useState } from 'react';
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  Upload,
} from 'antd';
import {
  AuditOutlined,
  BookOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  IdcardOutlined,
  PlusCircleOutlined,
  SearchOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, COLLECTIONS, normalizeStrapiList, uploadFile } from '../api';
import { fmtNgay, PROVINCES_LIST, toIso } from '../constants';

const { Title, Text } = Typography;

function downloadFile(url: string, fileName: string) {
  if (!url) return;
  const fullUrl =
    url.startsWith('data:') || url.startsWith('http')
      ? url
      : `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`;
  const a = document.createElement('a');
  a.href = fullUrl;
  a.download = fileName || 'tai-lieu';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

interface StudentLookupItem {
  id: string;
  studentCode: string;
  idNumber: string;
  fullName: string;
  dob: string;
  pob: string;
  gender: string;
  phone: string;
  email: string;
  ethnicity: string;
  nationality: string;
  address: string;
  company: string;
  className: string;
  trainingCourse: string;
  photo?: string;
  documents?: any[];
  isRecognized?: boolean;
  recognitionDecisions?: any[];
  openingDecisions?: any[];
}

export default function TraCuu() {
  const { message } = App.useApp();
  const nav = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const [searchResults, setSearchResults] = useState<StudentLookupItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentLookupItem | null>(null);

  // State Chỉnh sửa hồ sơ & Chụp ảnh 3x4
  const [editForm] = Form.useForm();
  const [moEditModal, setMoEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const moSuaHoSo = () => {
    if (!selectedStudent) return;
    setEditPhoto(selectedStudent.photo || null);
    editForm.setFieldsValue({
      fullName: selectedStudent.fullName,
      idNumber: selectedStudent.idNumber || selectedStudent.studentCode,
      dob: selectedStudent.dob ? dayjs(selectedStudent.dob) : null,
      gender: selectedStudent.gender || 'Nam',
      pob: selectedStudent.pob || undefined,
      ethnicity: selectedStudent.ethnicity || 'Kinh',
      nationality: selectedStudent.nationality || 'Việt Nam',
      phone: selectedStudent.phone || '',
      company: selectedStudent.company || '',
      address: selectedStudent.address || '',
    });
    setMoEditModal(true);
  };

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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 80);
    } catch {
      message.error('Không thể truy cập Camera. Vui lòng kiểm tra quyền trình duyệt.');
    }
  };

  const dongCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
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
    setEditPhoto(canvas.toDataURL('image/jpeg', 0.9));
    dongCamera();
    message.success('Đã chụp ảnh 3x4 thành công!');
  };

  const xuLyAnhAI = async () => {
    if (!editPhoto) return;
    setIsProcessingAI(true);
    try {
      const gender = editForm.getFieldValue('gender') || selectedStudent?.gender || 'Nam';
      const res = await api<any>('/students/process-photo', {
        method: 'POST',
        body: { originalImage: editPhoto, gender },
      });
      if (res?.processedImage) {
        setEditPhoto(res.processedImage);
        message.success('Đã xử lý ảnh AI thành công!');
      } else {
        throw new Error('Không nhận được ảnh kết quả từ AI');
      }
    } catch (err: any) {
      message.error('Không thể xử lý ảnh bằng AI: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setIsProcessingAI(false);
    }
  };

  const luuHoSo = async () => {
    if (!selectedStudent) return;
    try {
      const values = await editForm.validateFields();
      setSavingEdit(true);

      let finalPhotoUrl = editPhoto;
      const cccd = (values.idNumber || selectedStudent.idNumber || selectedStudent.studentCode || '').trim();
      if (editPhoto && editPhoto.startsWith('data:image/')) {
        const up = await uploadFile(editPhoto, `avatar_${cccd}_${Date.now()}.jpg`);
        if (up && up.length > 0) finalPhotoUrl = up[0].url;
      }

      const fullNameUpper = (values.fullName || '').toUpperCase().trim();
      const nameParts = fullNameUpper.split(/\s+/);
      const firstName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : fullNameUpper;
      const lastName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
      const dobIso = values.dob ? toIso(values.dob) : selectedStudent.dob;

      const payload = {
        full_name: fullNameUpper,
        first_name: firstName,
        last_name: lastName,
        id_number: cccd,
        dob: dobIso,
        gender: values.gender || 'Nam',
        pob: values.pob || '',
        ethnicity: values.ethnicity || 'Kinh',
        nationality: values.nationality || 'Việt Nam',
        phone: values.phone || '',
        company: values.company || '',
        address: values.address || '',
        photo: finalPhotoUrl,
      };

      await api(`/${COLLECTIONS.STUDENTS}/${selectedStudent.id}`, {
        method: 'PUT',
        body: { data: payload },
      });

      const updatedItem: StudentLookupItem = {
        ...selectedStudent,
        fullName: fullNameUpper,
        idNumber: cccd,
        dob: dobIso || '',
        gender: values.gender || 'Nam',
        pob: values.pob || '',
        ethnicity: values.ethnicity || 'Kinh',
        nationality: values.nationality || 'Việt Nam',
        phone: values.phone || '',
        company: values.company || '',
        address: values.address || '',
        photo: finalPhotoUrl || undefined,
      };
      setSelectedStudent(updatedItem);
      setSearchResults((prev) => prev.map((it) => (it.id === updatedItem.id ? updatedItem : it)));
      setMoEditModal(false);
      message.success('Đã cập nhật hồ sơ học viên thành công!');
    } catch (err: any) {
      if (!err?.errorFields) {
        message.error(err?.message || 'Lỗi khi lưu hồ sơ học viên');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  // Khi chọn học viên, tự động bổ sung hồ sơ dùng chung theo CCCD (nếu có)
  useEffect(() => {
    const cccd = selectedStudent?.idNumber?.trim();
    if (!cccd) return;
    let cancelled = false;
    api<any>(`/student-documents/by-id-number?id_number=${encodeURIComponent(cccd)}`)
      .then((res) => {
        if (cancelled) return;
        const sharedDocs = res?.data || [];
        if (Array.isArray(sharedDocs) && sharedDocs.length > 0) {
          setSelectedStudent((prev) => {
            if (!prev || prev.idNumber !== cccd) return prev;
            const existing = prev.documents || [];
            const map = new Map<string, any>();
            [...existing, ...sharedDocs].forEach((d: any) => {
              const key = String(d.url || d.documentId || d.id || d.name);
              if (key && !map.has(key)) map.set(key, d);
            });
            return { ...prev, documents: Array.from(map.values()) };
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedStudent?.id, selectedStudent?.idNumber]);

  const inTheHocVien = (student: any) => {
    const printWin = window.open('', '_blank', 'width=400,height=250');
    if (!printWin) {
      message.error('Vui lòng cho phép Pop-up trên trình duyệt để in thẻ.');
      return;
    }

    const rawPhoto = student.photo || '';
    const photoSrc = rawPhoto
      ? rawPhoto.startsWith('data:') || rawPhoto.startsWith('http')
        ? rawPhoto
        : window.location.origin + (rawPhoto.startsWith('/') ? rawPhoto : `/${rawPhoto}`)
      : '';

    const photoHtml = photoSrc
      ? '<img class="anh" src="' + photoSrc + '" />'
      : '<div class="anh-placeholder">Chưa có ảnh</div>';
    const html = '<!DOCTYPE html><html><head><title>Thẻ học viên</title>'
      + '<style>'
      + 'body{font-family:Arial,sans-serif;margin:0;padding:10px;}'
      + '.the-hv{border:2px solid #1677ff;border-radius:8px;padding:12px;width:320px;display:flex;gap:12px;background:linear-gradient(135deg,#f0f7ff 0%,#fff 100%);}'
      + '.anh{width:80px;height:100px;object-fit:cover;border:1px solid #ddd;border-radius:4px;}'
      + '.anh-placeholder{width:80px;height:100px;background:#e8e8e8;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#999;font-size:11px;}'
      + '.info{flex:1;}.ten{font-size:14px;font-weight:bold;color:#1677ff;margin-bottom:4px;}'
      + '.row{font-size:11px;margin-bottom:2px;}.label{color:#666;}'
      + '.title{text-align:center;font-size:13px;font-weight:bold;color:#1677ff;margin-bottom:10px;}'
      + '@media print{body{margin:0;}}'
      + '</style></head><body>'
      + '<div class="title">THẺ HỌC VIÊN</div>'
      + '<div class="the-hv">' + photoHtml
      + '<div class="info">'
      + '<div class="ten">' + (student.fullName || student.full_name || '') + '</div>'
      + '<div class="row"><span class="label">Mã HV: </span>' + (student.studentCode || '') + '</div>'
      + '<div class="row"><span class="label">Ngày sinh: </span>' + fmtNgay(student.dob || '') + '</div>'
      + '<div class="row"><span class="label">CCCD: </span>' + (student.idNumber || student.id_number || '') + '</div>'
      + '<div class="row"><span class="label">Lớp: </span>' + (student.className || '') + '</div>'
      + '<div class="row"><span class="label">SĐT: </span>' + (student.phone || '') + '</div>'
      + '</div></div>'
      + '<script>window.onload=function(){window.print();window.close();}<\/script>'
      + '</body></html>';
    printWin.document.write(html);
    printWin.document.close();
  };

  const handleSearch = async () => {
    const rawTerm = searchTerm.trim();
    if (!rawTerm) {
      setSearchResults([]);
      setSelectedStudent(null);
      return;
    }

    setLoading(true);
    try {
      const upperTerm = rawTerm.toUpperCase();
      const lowerTerm = rawTerm.toLowerCase();

      // 1. Tìm trực tiếp học viên trên server (hỗ trợ cả chữ thường, chữ hoa, CCCD, Mã HV, SĐT)
      const studentQuery =
        `/${COLLECTIONS.STUDENTS}?` +
        `filters[$or][0][full_name][$containsi]=${encodeURIComponent(rawTerm)}&` +
        `filters[$or][1][full_name][$containsi]=${encodeURIComponent(upperTerm)}&` +
        `filters[$or][2][full_name][$containsi]=${encodeURIComponent(lowerTerm)}&` +
        `filters[$or][3][id_number][$containsi]=${encodeURIComponent(rawTerm)}&` +
        `filters[$or][4][student_code][$containsi]=${encodeURIComponent(upperTerm)}&` +
        `filters[$or][5][card_number][$containsi]=${encodeURIComponent(rawTerm)}&` +
        `filters[$or][6][phone][$containsi]=${encodeURIComponent(rawTerm)}&` +
        `populate[school_class]=true&populate[documents]=true&pagination[pageSize]=100&publicationState=preview`;

      const sRes = await api<any>(studentQuery);
      const matchedStudents = normalizeStrapiList(sRes);

      // Thu thập danh sách mã CCCD / Mã HV để truy vấn toàn bộ Quyết định Mở lớp & Công nhận TN
      const codesSet = new Set<string>();
      matchedStudents.forEach((s: any) => {
        const c1 = (s.id_number || '').trim();
        const c2 = (s.student_code || s.code || '').trim();
        const c3 = (s.card_number || '').trim();
        if (c1) codesSet.add(c1);
        if (c2) codesSet.add(c2);
        if (c3) codesSet.add(c3);
      });

      const codes = Array.from(codesSet).slice(0, 40);
      let decisionList: any[] = [];

      const populateParams =
        'populate[school_class]=true' +
        '&populate[students][fields][0]=id_number' +
        '&populate[students][fields][1]=student_code' +
        '&populate[students][fields][2]=card_number' +
        '&populate[students][fields][3]=full_name' +
        '&populate[students][fields][4]=dob' +
        '&populate[students][fields][5]=pob' +
        '&populate[students][fields][6]=gender' +
        '&populate[students][fields][7]=phone' +
        '&populate[students][fields][8]=ethnicity' +
        '&populate[students][fields][9]=nationality' +
        '&populate[students][fields][10]=address' +
        '&populate[students][fields][11]=company' +
        '&populate[students][populate][documents]=true' +
        '&pagination[pageSize]=200&publicationState=preview';

      if (codes.length > 0) {
        const orFilters: string[] = [];
        codes.forEach((code) => {
          const idx = orFilters.length;
          orFilters.push(`filters[$or][${idx}][students][id_number][$eq]=${encodeURIComponent(code)}`);
          orFilters.push(`filters[$or][${idx + 1}][students][student_code][$eq]=${encodeURIComponent(code)}`);
        });
        const dRes = await api<any>(`/${COLLECTIONS.CLASS_DECISIONS}?${orFilters.join('&')}&${populateParams}`);
        decisionList = normalizeStrapiList(dRes);
      } else {
        // Fallback: tìm trực tiếp trong các quyết định nếu học viên không nằm ở bảng students
        const dRes = await api<any>(
          `/${COLLECTIONS.CLASS_DECISIONS}?` +
            `filters[$or][0][students][full_name][$containsi]=${encodeURIComponent(upperTerm)}&` +
            `filters[$or][1][students][id_number][$containsi]=${encodeURIComponent(rawTerm)}&` +
            `filters[$or][2][students][student_code][$containsi]=${encodeURIComponent(upperTerm)}&` +
            populateParams,
        );
        decisionList = normalizeStrapiList(dRes);
      }

      // 2. Gom nhóm quyết định theo mã học viên / CCCD
      const recognizedCodeMap = new Map<string, any[]>();
      const openingCodeMap = new Map<string, any[]>();

      const addDecisionToMap = (map: Map<string, any[]>, key: string, item: any) => {
        if (!key) return;
        const arr = map.get(key) || [];
        if (!arr.some((x) => x.decisionNumber === item.decisionNumber && x.trainingCourse === item.trainingCourse)) {
          arr.push(item);
          map.set(key, arr);
        }
      };

      decisionList.forEach((d: any) => {
        const sData = d.students?.data || d.students || [];
        const decInfo = {
          decisionNumber: d.decision_number,
          signedDate: d.signed_date,
          className: d.school_class?.data?.name || d.school_class?.name || d.class_name || '---',
          trainingCourse: d.training_course || '---',
        };
        const targetMap = d.type === 'RECOGNITION' ? recognizedCodeMap : openingCodeMap;

        sData.forEach((st: any) => {
          const k1 = (st.id_number || '').trim();
          const k2 = (st.student_code || st.code || '').trim();
          const k3 = (st.card_number || '').trim();
          addDecisionToMap(targetMap, k1, decInfo);
          addDecisionToMap(targetMap, k2, decInfo);
          addDecisionToMap(targetMap, k3, decInfo);
        });
      });

      // 3. Gộp hồ sơ học viên theo CCCD / Mã HV để hiển thị toàn bộ các lớp & quyết định của học viên đó
      const groupedMap = new Map<string, StudentLookupItem>();

      const mergeStudentRecord = (s: any, defaultClassName?: string, defaultCourse?: string) => {
        const cccd = (s.id_number || s.card_number || '').trim();
        const code = (s.student_code || s.code || cccd || '').trim();
        const groupKey = cccd || code || String(s.documentId || s.id);

        const recList = [
          ...(recognizedCodeMap.get(cccd) || []),
          ...(code && code !== cccd ? recognizedCodeMap.get(code) || [] : []),
        ];
        const openList = [
          ...(openingCodeMap.get(cccd) || []),
          ...(code && code !== cccd ? openingCodeMap.get(code) || [] : []),
        ];

        const uniqueRec = Array.from(
          new Map(recList.map((r) => [`${r.decisionNumber}_${r.trainingCourse}`, r])).values(),
        );
        const uniqueOpen = Array.from(
          new Map(openList.map((o) => [`${o.decisionNumber}_${o.trainingCourse}`, o])).values(),
        );

        const cls = s.school_class?.data || s.school_class || {};
        const clsName = cls.name || s.class_name || defaultClassName || '';
        const rawDocs = s.documents?.data || s.documents || [];
        const photoVal = typeof s.photo === 'string' ? s.photo : s.photo?.url || '';

        const existing = groupedMap.get(groupKey);
        if (!existing) {
          groupedMap.set(groupKey, {
            id: String(s.documentId || s.id),
            studentCode: code,
            idNumber: cccd,
            fullName: s.full_name || s.name || '',
            dob: s.dob || '',
            pob: s.pob || '',
            gender: s.gender || 'Nam',
            phone: s.phone || '',
            email: s.email || '',
            ethnicity: s.ethnicity || 'Kinh',
            nationality: s.nationality || 'Việt Nam',
            address: s.address || '',
            company: s.company || '',
            className: clsName || '---',
            trainingCourse: s.training_course || defaultCourse || '',
            photo: photoVal,
            documents: Array.isArray(rawDocs) ? rawDocs : [],
            isRecognized: uniqueRec.length > 0,
            recognitionDecisions: uniqueRec,
            openingDecisions: uniqueOpen,
          });
        } else {
          // Bổ sung tên lớp nếu học viên học nhiều lớp
          if (clsName && !existing.className.includes(clsName)) {
            existing.className = existing.className === '---' ? clsName : `${existing.className} • ${clsName}`;
          }
          if (!existing.photo && photoVal) existing.photo = photoVal;
          if (!existing.phone && s.phone) existing.phone = s.phone;
          if (!existing.address && s.address) existing.address = s.address;
          if (!existing.pob && s.pob) existing.pob = s.pob;
          if (!existing.company && s.company) existing.company = s.company;

          if (Array.isArray(rawDocs) && rawDocs.length > 0) {
            const docMap = new Map<string, any>();
            [...(existing.documents || []), ...rawDocs].forEach((d: any) => {
              const dk = String(d.url || d.documentId || d.id || d.name);
              if (dk && !docMap.has(dk)) docMap.set(dk, d);
            });
            existing.documents = Array.from(docMap.values());
          }

          const allRec = [...(existing.recognitionDecisions || []), ...uniqueRec];
          existing.recognitionDecisions = Array.from(
            new Map(allRec.map((r) => [`${r.decisionNumber}_${r.trainingCourse}`, r])).values(),
          );
          existing.isRecognized = existing.recognitionDecisions.length > 0;

          const allOpen = [...(existing.openingDecisions || []), ...uniqueOpen];
          existing.openingDecisions = Array.from(
            new Map(allOpen.map((o) => [`${o.decisionNumber}_${o.trainingCourse}`, o])).values(),
          );
        }
      };

      matchedStudents.forEach((s: any) => mergeStudentRecord(s));

      // Nếu tìm qua quyết định mà học viên chưa có trong matchedStudents
      if (matchedStudents.length === 0 && decisionList.length > 0) {
        decisionList.forEach((d: any) => {
          const sData = d.students?.data || d.students || [];
          const dClassName = d.school_class?.data?.name || d.school_class?.name || '';
          sData.forEach((st: any) => {
            const name = (st.full_name || '').toLowerCase();
            const code = (st.student_code || st.code || '').toLowerCase();
            const cccd = (st.id_number || st.card_number || '').toLowerCase();
            const phone = (st.phone || '').toLowerCase();
            if (
              name.includes(lowerTerm) ||
              code.includes(lowerTerm) ||
              cccd.includes(lowerTerm) ||
              phone.includes(lowerTerm)
            ) {
              mergeStudentRecord(st, dClassName, d.training_course);
            }
          });
        });
      }

      const matches = Array.from(groupedMap.values());
      setSearchResults(matches);
      setSelectedStudent(matches.length > 0 ? matches[0] : null);
    } catch (err: any) {
      console.error('Lỗi tra cứu học viên:', err);
      message.error('Không thể tải dữ liệu tra cứu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space align="center" size="middle">
              <SearchOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Tra cứu Hồ sơ Học viên & Quá trình Đào tạo
                </Title>
                <Text type="secondary">
                  Tìm kiếm theo Số CCCD, Họ tên, Mã học viên hoặc Số điện thoại
                </Text>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Search Input Box */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col flex="auto">
            <Input
              size="large"
              placeholder="Nhập số CCCD, Mã học viên, Họ và tên hoặc Số điện thoại..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col>
            <Button
              type="primary"
              size="large"
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={loading}
              style={{ paddingLeft: 24, paddingRight: 24 }}
            >
              Tra cứu
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Main Content: Results List + Dossier Details */}
      <Row gutter={[16, 16]}>
        {/* Left Column: Results List */}
        <Col xs={24} md={8}>
          <Card
            title={`Kết quả tìm kiếm (${searchResults.length})`}
            styles={{ body: { padding: '8px 12px', maxHeight: 600, overflowY: 'auto' } }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : searchResults.length === 0 ? (
              <Empty
                description={
                  searchTerm ? 'Không tìm thấy học viên phù hợp.' : 'Nhập từ khóa và ấn Tra cứu.'
                }
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {searchResults.map((st) => {
                  const isSelected = selectedStudent?.id === st.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => setSelectedStudent(st)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: isSelected ? '2px solid #1677ff' : '1px solid #f0f0f0',
                        background: isSelected ? '#e6f4ff' : '#fff',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Row align="middle" gutter={12}>
                        <Col>
                          {st.photo ? (
                            <Avatar
                              shape="square"
                              size={48}
                              src={st.photo}
                              style={{ objectFit: 'cover' }}
                            />
                          ) : (
                            <Avatar shape="square" size={48} icon={<UserOutlined />} />
                          )}
                        </Col>
                        <Col flex="auto">
                          <Row justify="space-between" align="middle">
                            <Text strong style={{ textTransform: 'uppercase' }}>
                              {st.fullName}
                            </Text>
                            {st.isRecognized ? (
                              <Tag color="success">Đã TN</Tag>
                            ) : (
                              <Tag color="processing">Đang học</Tag>
                            )}
                          </Row>
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              CCCD: {st.idNumber || st.studentCode}
                            </Text>
                          </div>
                          <div>
                            <Text style={{ fontSize: 11, color: '#1677ff' }}>
                              {st.className}
                            </Text>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* Right Column: Student Dossier */}
        <Col xs={24} md={16}>
          {!selectedStudent ? (
            <Card style={{ textAlign: 'center', padding: '60px 0' }}>
              <UserOutlined style={{ fontSize: 48, color: '#bfbfbf', marginBottom: 16 }} />
              <Title level={5} type="secondary">
                Chọn một học viên từ danh sách kết quả để xem toàn bộ hồ sơ
              </Title>
            </Card>
          ) : (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {/* Profile Card */}
              <Card
                title={
                  <Space>
                    <IdcardOutlined style={{ color: '#1677ff' }} />
                    <span>Hồ sơ Học viên</span>
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      icon={<EditOutlined />}
                      onClick={moSuaHoSo}
                      size="small"
                    >
                      Chỉnh sửa hồ sơ
                    </Button>
                    <Button
                      icon={<IdcardOutlined />}
                      onClick={() => inTheHocVien(selectedStudent)}
                      size="small"
                    >
                      In thẻ
                    </Button>
                    <Button
                      type="primary"
                      icon={<PlusCircleOutlined />}
                      onClick={() => nav(`/dang-ky?cccd=${selectedStudent.idNumber}`)}
                    >
                      Đăng ký thêm lớp
                    </Button>
                  </Space>
                }
              >
                <Row gutter={[24, 16]}>
                  <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
                    {selectedStudent.photo ? (
                      <Image
                        src={selectedStudent.photo}
                        width={120}
                        height={160}
                        style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #d9d9d9' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 120,
                          height: 160,
                          background: '#f5f5f5',
                          borderRadius: 8,
                          display: 'grid',
                          placeItems: 'center',
                          margin: '0 auto',
                          border: '1px dashed #d9d9d9',
                        }}
                      >
                        <UserOutlined style={{ fontSize: 40, color: '#bfbfbf' }} />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Chưa có ảnh 3x4
                        </Text>
                      </div>
                    )}
                    <div style={{ marginTop: 12 }}>
                      <Tag color={selectedStudent.isRecognized ? 'success' : 'processing'}>
                        {selectedStudent.isRecognized ? 'ĐÃ TỐT NGHIỆP' : 'ĐANG ĐÀO TẠO'}
                      </Tag>
                    </div>
                  </Col>

                  <Col xs={24} sm={18}>
                    <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
                      <Descriptions.Item label="Họ và tên">
                        <Text strong style={{ textTransform: 'uppercase' }}>
                          {selectedStudent.fullName}
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Số CCCD/CMND">
                        <Text copyable strong>{selectedStudent.idNumber || selectedStudent.studentCode}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Ngày sinh">
                        {fmtNgay(selectedStudent.dob)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Giới tính">
                        {selectedStudent.gender}
                      </Descriptions.Item>
                      <Descriptions.Item label="Nơi sinh">
                        {selectedStudent.pob || '---'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Dân tộc / Quốc tịch">
                        {selectedStudent.ethnicity} / {selectedStudent.nationality}
                      </Descriptions.Item>
                      <Descriptions.Item label="Số điện thoại">
                        {selectedStudent.phone || '---'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Cơ quan / Đơn vị">
                        {selectedStudent.company || '---'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Địa chỉ thường trú" span={2}>
                        {selectedStudent.address || '---'}
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                </Row>
              </Card>

              {/* Training History */}
              <Card
                title={
                  <Space>
                    <AuditOutlined style={{ color: '#52c41a' }} />
                    <span>Lịch sử Đào tạo & Văn bằng chứng chỉ</span>
                  </Space>
                }
              >
                <Title level={5} style={{ marginTop: 0 }}>
                  1. Quyết định công nhận tốt nghiệp & Cấp chứng chỉ
                </Title>
                {selectedStudent.recognitionDecisions && selectedStudent.recognitionDecisions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {selectedStudent.recognitionDecisions.map((rd, i) => (
                      <div
                        key={i}
                        style={{
                          background: '#f6ffed',
                          border: '1px solid #b7eb8f',
                          padding: '10px 14px',
                          borderRadius: 8,
                        }}
                      >
                        <Row justify="space-between" align="middle">
                          <Col>
                            <Text strong style={{ color: '#389e0d' }}>
                              <CheckCircleOutlined /> QĐ Công nhận: {rd.decisionNumber}
                            </Text>
                            <div>
                              <Text>Lớp: {rd.className} - Khóa: {rd.trainingCourse}</Text>
                            </div>
                          </Col>
                          <Col>
                            <Tag color="green">Ký ngày: {fmtNgay(rd.signedDate)}</Tag>
                          </Col>
                        </Row>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary" style={{ fontStyle: 'italic', display: 'block', marginBottom: 16 }}>
                    Học viên chưa có quyết định công nhận tốt nghiệp nào.
                  </Text>
                )}

                <Divider style={{ margin: '12px 0' }} />

                <Title level={5}>2. Quyết định mở lớp nhập học</Title>
                {selectedStudent.openingDecisions && selectedStudent.openingDecisions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedStudent.openingDecisions.map((od, i) => (
                      <div
                        key={i}
                        style={{
                          background: '#f0f5ff',
                          border: '1px solid #adc6ff',
                          padding: '10px 14px',
                          borderRadius: 8,
                        }}
                      >
                        <Row justify="space-between" align="middle">
                          <Col>
                            <Text strong style={{ color: '#1d39c4' }}>
                              <BookOutlined /> QĐ Mở lớp: {od.decisionNumber}
                            </Text>
                            <div>
                              <Text>Lớp: {od.className} - Khóa: {od.trainingCourse}</Text>
                            </div>
                          </Col>
                          <Col>
                            <Tag color="blue">Ký ngày: {fmtNgay(od.signedDate)}</Tag>
                          </Col>
                        </Row>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary" style={{ fontStyle: 'italic' }}>
                    Chưa có thông tin quyết định mở lớp trực tiếp. Lớp đăng ký hiện tại:{' '}
                    <Text strong>{selectedStudent.className}</Text>
                  </Text>
                )}

                <Divider style={{ margin: '12px 0' }} />

                <Title level={5}>3. Hồ sơ minh chứng & Tài liệu đính kèm</Title>
                {selectedStudent.documents && selectedStudent.documents.length > 0 ? (
                  <Space wrap>
                    {selectedStudent.documents.map((doc: any, i: number) => (
                      <Button
                        key={doc.id || doc.documentId || i}
                        icon={<DownloadOutlined />}
                        size="small"
                        onClick={() => downloadFile(doc.url, doc.name || `tai_lieu_${i + 1}`)}
                      >
                        <FileTextOutlined /> {doc.name || `Tài liệu #${i + 1}`}
                      </Button>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary" style={{ fontStyle: 'italic' }}>
                    Chưa có tài liệu đính kèm.
                  </Text>
                )}
              </Card>
            </Space>
          )}
        </Col>
      </Row>

      {/* Modal Chỉnh sửa hồ sơ học viên */}
      <Modal
        title="Chỉnh sửa hồ sơ học viên"
        open={moEditModal}
        onCancel={() => {
          dongCamera();
          setMoEditModal(false);
        }}
        onOk={luuHoSo}
        confirmLoading={savingEdit}
        okText="Lưu lại"
        cancelText="Đóng"
        width={860}
        forceRender
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={24}>
            <Col xs={24} md={16}>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="fullName"
                    label="Họ và tên"
                    rules={[{ required: true, message: 'Nhập họ và tên' }]}
                  >
                    <Input style={{ textTransform: 'uppercase', fontWeight: 600 }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="idNumber"
                    label="Số CCCD / CMND"
                    rules={[{ required: true, message: 'Nhập số CCCD' }]}
                  >
                    <Input maxLength={12} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Form.Item name="dob" label="Ngày sinh">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="gender" label="Giới tính">
                    <Radio.Group>
                      <Radio value="Nam">Nam</Radio>
                      <Radio value="Nữ">Nữ</Radio>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="pob" label="Nơi sinh">
                    <Select
                      showSearch
                      allowClear
                      options={PROVINCES_LIST.map((p) => ({ value: p, label: p }))}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Form.Item name="ethnicity" label="Dân tộc">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="nationality" label="Quốc tịch">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="phone" label="Số điện thoại">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item name="address" label="Địa chỉ thường trú">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="company" label="Cơ quan / Đơn vị">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </Col>

            <Col xs={24} md={8}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Ảnh thẻ 3x4</div>
                <div
                  onClick={moCamera}
                  style={{
                    width: 140,
                    height: 186,
                    border: '2px solid #cbd5e1',
                    borderRadius: 6,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f8fafc',
                    cursor: 'pointer',
                  }}
                >
                  {editPhoto ? (
                    <img src={editPhoto} alt="3x4" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                      <UserOutlined style={{ fontSize: 40 }} />
                      <div style={{ fontSize: 11, marginTop: 4 }}>Chưa có ảnh</div>
                    </div>
                  )}
                </div>

                <Space direction="vertical" style={{ width: '100%', maxWidth: 165, marginTop: 12 }} size={8}>
                  <Button type="primary" ghost size="small" icon={<CameraOutlined />} onClick={moCamera} block>
                    Chụp ảnh 3x4
                  </Button>
                  <Upload
                    showUploadList={false}
                    accept="image/*"
                    beforeUpload={(f) => {
                      const r = new FileReader();
                      r.onload = (e) => setEditPhoto(e.target?.result as string);
                      r.readAsDataURL(f);
                      return false;
                    }}
                  >
                    <Button size="small" icon={<UploadOutlined />} block style={{ width: '100%' }}>
                      Tải ảnh lên
                    </Button>
                  </Upload>
                  {editPhoto && (
                    <Button
                      size="small"
                      loading={isProcessingAI}
                      onClick={xuLyAnhAI}
                      block
                      style={{
                        background: 'linear-gradient(90deg, #faf5ff 0%, #fdf4ff 100%)',
                        borderColor: '#e9d5ff',
                        color: '#9333ea',
                        fontWeight: 600,
                      }}
                    >
                      ✨ {isProcessingAI ? 'Đang xử lý AI...' : 'Xử lý AI (Thay đồ)'}
                    </Button>
                  )}
                  {editPhoto && (
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => downloadFile(editPhoto, `Anh_3x4_${selectedStudent?.idNumber || 'HV'}.jpg`)}
                      block
                      style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a', fontWeight: 600 }}
                    >
                      Tải ảnh xuống
                    </Button>
                  )}
                  {editPhoto && (
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setEditPhoto(null)} block>
                      Xóa ảnh
                    </Button>
                  )}
                </Space>
              </div>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal Camera 3x4 */}
      <Modal
        title="Chụp ảnh thẻ 3x4"
        open={isCameraOpen}
        onCancel={dongCamera}
        footer={null}
        width={480}
        centered
        destroyOnClose
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '3 / 4',
              background: '#0f172a',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <svg style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
                <ellipse
                  cx="50%"
                  cy="42%"
                  rx="28%"
                  ry="33%"
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="2"
                  strokeDasharray="8 8"
                />
              </svg>
            </div>
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <Space style={{ marginTop: 16 }} size={12}>
            <Button type="primary" icon={<CameraOutlined />} onClick={chupAnh} size="large">
              Chụp ảnh 3x4
            </Button>
            <Button size="large" onClick={dongCamera}>
              Hủy bỏ
            </Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
}

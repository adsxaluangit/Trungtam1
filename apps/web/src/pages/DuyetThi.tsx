import { useEffect, useState } from 'react';
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Image,
  Input,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  FileExcelOutlined,
  FileDoneOutlined,
  PrinterOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, COLLECTIONS, normalizeStrapiList } from '../api';
import { fmtNgay } from '../constants';

const { Title, Text } = Typography;

interface StudentItem {
  id: string;
  studentCode: string;
  fullName: string;
  dob: string;
  gender: string;
  photo?: string;
}

interface SubjectItem {
  id: string;
  strapiId?: number;
  code: string;
  name: string;
  hasTheory?: boolean;
  hasPractice?: boolean;
}

interface ApprovalRecord {
  practicePass: boolean;
  theoryApproved: boolean;
}

export default function DuyetThi() {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [searchDecisionText, setSearchDecisionText] = useState('');

  // Selected decision & detail view
  const [selectedDecision, setSelectedDecision] = useState<any | null>(null);
  const [decisionStudents, setDecisionStudents] = useState<StudentItem[]>([]);
  const [decisionSubjects, setDecisionSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [studentSearchText, setStudentSearchText] = useState('');

  // Approvals map: subId -> studentCode -> ApprovalRecord
  const [approvals, setApprovals] = useState<Record<string, Record<string, ApprovalRecord>>>({});
  const [currentApprovalDocId, setCurrentApprovalDocId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Print modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    loadDecisionsAndSubjects();
  }, []);

  const loadDecisionsAndSubjects = async () => {
    setLoading(true);
    try {
      const [decsRes, subsRes] = await Promise.all([
        api<any>(
          `/${COLLECTIONS.CLASS_DECISIONS}?populate[school_class]=true&populate[related_decision]=true&populate[students][count]=true&publicationState=preview&pagination[limit]=500`,
        ),
        api<any>(`/${COLLECTIONS.SUBJECTS}?populate=*&publicationState=preview&pagination[limit]=500`),
      ]);

      const allDecs = normalizeStrapiList(decsRes);
      const allSubs: SubjectItem[] = normalizeStrapiList(subsRes).map((s: any) => ({
        id: String(s.documentId || s.id),
        strapiId: s.strapiId || s.id,
        code: s.code,
        name: s.name,
        hasTheory: s.has_theory !== false,
        hasPractice: s.has_practice === true,
      }));

      setSubjects(allSubs);

      // Filter opening decisions that are active
      const finalizedOpeningIds = new Set(
        allDecs
          .filter((d: any) => d.type === 'RECOGNITION')
          .map((d: any) => {
            const rel = d.related_decision;
            return String(rel?.documentId || rel?.id || '');
          })
          .filter((id: string) => id !== ''),
      );

      const validDecs = allDecs
        .filter((d: any) => {
          const isOpening = d.type === 'OPENING';
          const classData = d.school_class;
          const isNotFinalized = !finalizedOpeningIds.has(String(d.documentId || d.id));
          return isOpening && !!classData && isNotFinalized;
        })
        .map((d: any) => {
          const cls = d.school_class || {};
          return {
            ...d,
            className: cls.name || '---',
            classCode: cls.code || '',
            classId: cls.documentId || cls.id,
            trainingCourse: d.training_course || 'K.01',
            studentCount: d.students?.count ?? (Array.isArray(d.students) ? d.students.length : 0),
          };
        });

      setDecisions(validDecs);
    } catch (err: any) {
      message.error('Lỗi khi tải dữ liệu duyệt thi: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDecision = async (decision: any) => {
    setSelectedDecision(decision);
    setLoading(true);
    try {
      const decId = decision.documentId || decision.id;

      // Fetch deep populated decision with students
      const fullDecRes = await api<any>(
        `/${COLLECTIONS.CLASS_DECISIONS}?filters[documentId][$eq]=${decId}&populate[students][populate]=*&publicationState=preview`,
      );
      const fullDecList = normalizeStrapiList(fullDecRes);
      const fullDec = fullDecList[0] || decision;

      let rawStudents: any[] = [];
      if (Array.isArray(fullDec.students)) rawStudents = fullDec.students;
      else if (fullDec.students?.data) rawStudents = fullDec.students.data;

      const mappedStudents: StudentItem[] = rawStudents
        .map((s: any) => ({
          id: String(s.documentId || s.id),
          studentCode: s.student_code || s.code || '',
          fullName: s.full_name || s.name || '',
          dob: s.dob || '',
          gender: s.gender || 'Nam',
          photo: s.photo?.url || s.photo || '',
        }))
        .sort((a, b) => {
          const lastA = (a.fullName || '').trim().split(/\s+/).pop() || '';
          const lastB = (b.fullName || '').trim().split(/\s+/).pop() || '';
          return lastA.localeCompare(lastB, 'vi', { sensitivity: 'base' });
        });

      setDecisionStudents(mappedStudents);

      // Fetch class subjects
      let classSubs: SubjectItem[] = [];
      if (decision.classId) {
        try {
          const classDetail = await api<any>(`/${COLLECTIONS.CLASSES}/${decision.classId}?populate=*`);
          const rawClass = classDetail?.data || classDetail;
          const normSubs = normalizeStrapiList(rawClass?.subjects || { data: rawClass?.subjects || [] });
          classSubs = normSubs.map((s: any) => ({
            id: String(s.documentId || s.id),
            strapiId: s.strapiId || s.id,
            code: s.code,
            name: s.name,
            hasTheory: s.has_theory !== false,
            hasPractice: s.has_practice === true,
          }));
        } catch {
          // ignore
        }
      }
      if (classSubs.length === 0) classSubs = subjects;
      setDecisionSubjects(classSubs);

      // Default select first subject
      if (classSubs.length > 0) {
        setSelectedSubjectId(classSubs[0].id);
      }

      // Load existing exam-approvals
      await loadExistingApprovals(decId);
    } catch (err: any) {
      message.error('Lỗi khi mở chi tiết quyết định: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const loadExistingApprovals = async (decId: string) => {
    setApprovals({});
    setCurrentApprovalDocId(null);
    try {
      const res = await api<any>(
        `/${COLLECTIONS.EXAM_APPROVALS}?filters[decision][documentId][$eq]=${decId}&publicationState=preview`,
      );
      const list = normalizeStrapiList(res);
      if (list.length > 0) {
        const record = list[0];
        setCurrentApprovalDocId(record.documentId || record.id);
        if (record.approvals && typeof record.approvals === 'object') {
          const rawAppr = record.approvals;
          const normalized: Record<string, Record<string, ApprovalRecord>> = {};
          Object.keys(rawAppr).forEach((subKey) => {
            normalized[subKey] = {};
            const val = rawAppr[subKey];
            if (Array.isArray(val)) {
              val.forEach((code: string) => {
                normalized[subKey][code] = { practicePass: true, theoryApproved: true };
              });
            } else if (typeof val === 'object') {
              normalized[subKey] = val;
            }
          });
          setApprovals(normalized);
        }
      }
    } catch (err) {
      console.warn('Chưa có bản ghi duyệt thi cũ:', err);
    }
  };

  const handleToggleTheory = (code: string, checked: boolean) => {
    if (!selectedSubjectId) return;
    const curSub = decisionSubjects.find((s) => s.id === selectedSubjectId);
    const subKey = String(curSub?.strapiId || selectedSubjectId);
    const subApprovals = { ...(approvals[subKey] || {}) };
    const curRecord = subApprovals[code] || {
      practicePass: !curSub?.hasPractice,
      theoryApproved: false,
    };

    subApprovals[code] = {
      ...curRecord,
      theoryApproved: checked,
    };

    setApprovals({
      ...approvals,
      [subKey]: subApprovals,
    });
  };

  const handleTogglePractice = (code: string, checked: boolean) => {
    if (!selectedSubjectId) return;
    const curSub = decisionSubjects.find((s) => s.id === selectedSubjectId);
    const subKey = String(curSub?.strapiId || selectedSubjectId);
    const subApprovals = { ...(approvals[subKey] || {}) };
    const curRecord = subApprovals[code] || {
      practicePass: false,
      theoryApproved: false,
    };

    subApprovals[code] = {
      ...curRecord,
      practicePass: checked,
      // If practice not pass, theory can't be approved
      theoryApproved: checked ? curRecord.theoryApproved : false,
    };

    setApprovals({
      ...approvals,
      [subKey]: subApprovals,
    });
  };

  const handleApproveAllTheory = () => {
    if (!selectedSubjectId) return;
    const curSub = decisionSubjects.find((s) => s.id === selectedSubjectId);
    const subKey = String(curSub?.strapiId || selectedSubjectId);
    const nextSubApprovals = { ...(approvals[subKey] || {}) };

    decisionStudents.forEach((s) => {
      const prev = nextSubApprovals[s.studentCode] || {
        practicePass: !curSub?.hasPractice,
        theoryApproved: false,
      };
      // Only approve theory if practice passed (or has no practice)
      const canApprove = !curSub?.hasPractice || prev.practicePass;
      nextSubApprovals[s.studentCode] = {
        ...prev,
        theoryApproved: canApprove,
      };
    });

    setApprovals({
      ...approvals,
      [subKey]: nextSubApprovals,
    });
    message.success('Đã duyệt lý thuyết cho toàn bộ học viên đủ điều kiện.');
  };

  const handlePassAllPractice = () => {
    if (!selectedSubjectId) return;
    const curSub = decisionSubjects.find((s) => s.id === selectedSubjectId);
    const subKey = String(curSub?.strapiId || selectedSubjectId);
    const nextSubApprovals = { ...(approvals[subKey] || {}) };

    decisionStudents.forEach((s) => {
      const prev = nextSubApprovals[s.studentCode] || {
        practicePass: false,
        theoryApproved: false,
      };
      nextSubApprovals[s.studentCode] = {
        ...prev,
        practicePass: true,
      };
    });

    setApprovals({
      ...approvals,
      [subKey]: nextSubApprovals,
    });
    message.success('Đã đánh dấu đạt thực hành cho toàn bộ học viên.');
  };

  const handleClearAll = () => {
    if (!selectedSubjectId) return;
    const curSub = decisionSubjects.find((s) => s.id === selectedSubjectId);
    const subKey = String(curSub?.strapiId || selectedSubjectId);
    const nextSubApprovals = { ...(approvals[subKey] || {}) };

    decisionStudents.forEach((s) => {
      nextSubApprovals[s.studentCode] = {
        practicePass: !curSub?.hasPractice,
        theoryApproved: false,
      };
    });

    setApprovals({
      ...approvals,
      [subKey]: nextSubApprovals,
    });
    message.info('Đã đặt lại trạng thái duyệt về ban đầu.');
  };

  const handleExportExcel = async () => {
    if (!selectedDecision || !curSub) return;

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Duyệt thi');

    ws.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'Mã HV', key: 'studentCode', width: 15 },
      { header: 'Họ và tên', key: 'fullName', width: 25 },
      { header: 'Môn học', key: 'subject', width: 20 },
      { header: 'Duyệt LT', key: 'theoryApproved', width: 12 },
      { header: 'Duyệt TH', key: 'practicePass', width: 12 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
    headerRow.alignment = { horizontal: 'center' };

    decisionStudents.forEach((s, idx) => {
      const app = curSubApprovals[s.studentCode] || { practicePass: false, theoryApproved: false };
      const row = ws.addRow({
        stt: idx + 1,
        studentCode: s.studentCode,
        fullName: s.fullName,
        subject: `${curSub.name} (${curSub.code})`,
        theoryApproved: app.theoryApproved ? 'Có' : 'Không',
        practicePass: app.practicePass ? 'Có' : 'Không',
      });
      if (idx % 2 === 1) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }
    });

    ws.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const { saveAs } = await import('file-saver');
    saveAs(
      new Blob([buf]),
      `DuyetThi_${curSub.code}_${selectedDecision.className}_${dayjs().format('DDMMYYYY')}.xlsx`,
    );
    message.success('Đã xuất file kết quả duyệt thi!');
  };

  const handleSaveApprovals = async () => {
    if (!selectedDecision) return;
    setSaving(true);
    try {
      const strapiDecId = Number(selectedDecision.strapiId || selectedDecision.id);
      const payload = {
        data: {
          decision: !isNaN(strapiDecId) && strapiDecId > 0 ? strapiDecId : undefined,
          approvals: approvals,
          publishedAt: new Date().toISOString(),
        },
      };

      if (currentApprovalDocId) {
        await api<any>(`/${COLLECTIONS.EXAM_APPROVALS}/${currentApprovalDocId}`, {
          method: 'PUT',
          body: payload,
        });
      } else {
        const newRecord = await api<any>(`/${COLLECTIONS.EXAM_APPROVALS}`, {
          method: 'POST',
          body: payload,
        });
        const nId = newRecord?.data?.documentId || newRecord?.documentId;
        if (nId) setCurrentApprovalDocId(nId);
      }

      message.success('Đã lưu kết quả duyệt thi thành công vào hệ thống!');
    } catch (err: any) {
      message.error('Lỗi khi lưu kết quả duyệt thi: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  // Nút "In danh sách" (Lưới ảnh 5 cột - từ edumaster-main ExamApprovalView)
  const handlePrintPhotoGrid = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Vui lòng cho phép Pop-up trên trình duyệt để in.');
      return;
    }
    const currentSub = decisionSubjects.find((s) => String(s.id) === String(selectedSubjectId));
    const subKey = String(currentSub?.strapiId || selectedSubjectId);
    const subApprovals = approvals[subKey] || {};
    const approvedList = decisionStudents.filter((s) => {
      const rec = subApprovals[s.studentCode];
      if (currentSub?.hasTheory) return rec?.theoryApproved;
      if (currentSub?.hasPractice) return rec?.practicePass;
      return true;
    });

    const getPhotoUrl = (url?: string) => {
      if (!url) return '';
      if (url.startsWith('http') || url.startsWith('data:')) return url;
      return `${window.location.origin}${url}`;
    };

    const html = `
      <html>
      <head>
        <title>Danh sách ảnh lớp - ${selectedDecision?.className || ''}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Times New Roman', serif; padding: 20px; margin: 0 auto; max-width: 210mm; }
          h1 { text-align: center; font-size: 18px; margin-bottom: 5px; font-weight: bold; }
          h2 { text-align: center; font-size: 16px; margin: 5px 0 25px 0; font-weight: normal; font-style: italic; }
          .grid-container { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px 10px; justify-items: center; }
          .student-item { display: flex; flex-direction: column; align-items: center; width: 130px; text-align: center; page-break-inside: avoid; }
          .photo-box { width: 110px; height: 145px; border: 1px solid black; margin-bottom: 5px; display: flex; justify-content: center; align-items: center; overflow: hidden; }
          .photo-img { width: 100%; height: 100%; object-fit: cover; }
          .student-name { font-size: 15px; margin: 0; line-height: 1.2; font-weight: bold; }
          .student-dob { font-size: 14px; margin: 4px 0 0 0; }
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 15mm; max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <h1>DANH SÁCH ẢNH</h1>
        <h2>Lớp: ${selectedDecision?.className || ''} - Khóa: ${selectedDecision?.trainingCourse || ''}</h2>
        <div class="grid-container">
          ${approvedList
            .map(
              (s) => `
            <div class="student-item">
              <div class="photo-box">
                ${s.photo ? `<img src="${getPhotoUrl(s.photo)}" class="photo-img" />` : ''}
              </div>
              <p class="student-name">${s.fullName}</p>
              <p class="student-dob">${fmtNgay(s.dob)}</p>
            </div>
          `,
            )
            .join('')}
        </div>
        <script>
          window.onload = function() { setTimeout(() => { window.print(); }, 500); };
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Nút "Phiếu điểm" (KẾT QUẢ THI HẾT MÔN - từ edumaster-main ExamApprovalView)
  const handlePrintScoreSheet = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Vui lòng cho phép Pop-up trên trình duyệt để in.');
      return;
    }
    const currentSub = decisionSubjects.find((s) => String(s.id) === String(selectedSubjectId));
    const currentSubjectName = currentSub?.name || '';
    const subKey = String(currentSub?.strapiId || selectedSubjectId);
    const subApprovals = approvals[subKey] || {};
    const approvedList = decisionStudents
      .filter((s) => {
        const rec = subApprovals[s.studentCode];
        if (currentSub?.hasTheory) return rec?.theoryApproved;
        if (currentSub?.hasPractice) return rec?.practicePass;
        return true;
      })
      .sort((a, b) => {
        const lastA = (a.fullName || '').trim().split(/\s+/).pop() || '';
        const lastB = (b.fullName || '').trim().split(/\s+/).pop() || '';
        const cmp = lastA.localeCompare(lastB, 'vi', { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        return (a.fullName || '').localeCompare(b.fullName || '', 'vi', { sensitivity: 'base' });
      });

    const splitName = (fullName: string) => {
      const parts = (fullName || '').trim().split(' ');
      if (parts.length <= 1) return { hoVaDem: fullName, ten: '' };
      const ten = parts.pop();
      const hoVaDem = parts.join(' ');
      return { hoVaDem, ten };
    };

    const classStr = `LỚP: ${selectedDecision?.classCode || selectedDecision?.className || ''} ${selectedDecision?.trainingCourse ? `- ${selectedDecision.trainingCourse}` : ''}`;

    const html = `
      <html>
      <head>
        <title>Phiếu điểm - ${selectedDecision?.className || ''}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Times New Roman', serif; padding: 20px; margin: 0; background: white; }
          .print-container { width: 100%; max-width: 210mm; margin: 0 auto; }
          .header-table { width: 100%; margin-bottom: 20px; border: none; }
          .header-table td { vertical-align: top; border: none; padding: 0; }
          .header-left { text-align: center; width: 45%; }
          .header-right { text-align: center; width: 55%; }
          .header-left p, .header-right p { margin: 0; font-size: 13pt; line-height: 1.2; }
          .header-left p:first-child { font-size: 12pt; }
          .header-left p.bold { font-weight: bold; font-size: 12pt; }
          .header-right p:first-child, .header-right p:nth-child(2) { font-weight: bold; }
          .title-box { text-align: center; margin-top: 25px; margin-bottom: 20px; }
          .title-box h1 { font-size: 18pt; font-weight: bold; margin: 0 0 5px 0; }
          .title-box p { font-size: 12pt; text-transform: uppercase; margin: 0; }
          .info-box { margin-bottom: 15px; font-size: 13pt; line-height: 1.5; padding-left: 15px; }
          .info-box p { margin: 4px 0; }
          .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .data-table th, .data-table td { border: 1px solid black; padding: 8px 5px; font-size: 12pt; vertical-align: middle; }
          .data-table th { font-weight: bold; text-align: center; padding: 10px 5px; }
          .col-stt { width: 45px; text-align: center; }
          .col-name { text-align: left; }
          .col-diem { width: 80px; text-align: center; }
          .col-sophieu { width: 100px; text-align: center; }
          .col-chuky { width: 110px; text-align: center; }
          .col-ghichu { width: 100px; text-align: center; }
          .name-container { display: flex; justify-content: space-between; width: 100%; }
          .name-last { display: inline-block; width: 70px; text-align: left; }
          .footer-table { width: 100%; margin-top: 15px; border: none; }
          .footer-table td { vertical-align: top; border: none; text-align: center; padding: 0; font-weight: bold; font-size: 12pt; width: 50%; }
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; }
            .print-container { width: 100%; max-width: none; }
          }
        </style>
      </head>
      <body>
        <table style="width: 100%; border: none; border-collapse: collapse;">
          <thead><tr><td style="height: 15mm; border: none; padding: 0;"></td></tr></thead>
          <tbody>
            <tr>
              <td style="border: none; padding: 0 15mm;">
                <div class="print-container">
                  <table class="header-table">
                    <tr>
                      <td class="header-left">
                        <p>TRƯỜNG CAO ĐẲNG HÀNG HẢI &amp; ĐT 1</p>
                        <p class="bold">TRUNG TÂM ĐÀO TẠO PT NGUỒN LỰC</p>
                      </td>
                      <td class="header-right">
                        <p>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                        <p>Độc lập - Tự do - Hạnh phúc</p>
                      </td>
                    </tr>
                  </table>
                  <div class="title-box">
                    <h1>KẾT QUẢ THI HẾT MÔN</h1>
                    <p>${classStr}</p>
                  </div>
                  <div class="info-box">
                    <p>Ngày thi kiểm tra: </p>
                    <p>Môn học: <span style="font-weight: bold;">${currentSubjectName}</span></p>
                    <table style="width:100%; border:none; border-collapse: collapse; font-size: 13pt; margin-top: 4px;">
                      <tr>
                        <td style="width: 230px; border:none; padding:0; vertical-align: top;">Họ và tên giáo viên coi thi:</td>
                        <td style="border:none; padding:0; vertical-align: top; line-height: 1.6;">1:<br>2:</td>
                      </tr>
                    </table>
                  </div>
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th class="col-stt">STT</th>
                        <th class="col-name">HỌ VÀ TÊN</th>
                        <th class="col-diem">ĐIỂM</th>
                        <th class="col-sophieu">SỐ PHIẾU</th>
                        <th class="col-chuky">CHỮ KÝ HV</th>
                        <th class="col-ghichu">GHI CHÚ</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${approvedList
                        .map((s, idx) => {
                          const { hoVaDem, ten } = splitName(s.fullName);
                          return `
                          <tr>
                            <td class="col-stt">${idx + 1}.</td>
                            <td class="col-name">
                              <div class="name-container">
                                <span>${hoVaDem}</span>
                                <span class="name-last">${ten}</span>
                              </div>
                            </td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                          </tr>`;
                        })
                        .join('')}
                    </tbody>
                  </table>
                  <table class="footer-table">
                    <tr>
                      <td>TRUNG TÂM ĐÀO TẠO PT NGUỒN LỰC</td>
                      <td>GIÁO VIÊN CHẤM THI</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot><tr><td style="height: 15mm; border: none; padding: 0;"></td></tr></tfoot>
        </table>
        <script>
          window.onload = function() { setTimeout(() => { window.print(); }, 500); };
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Filtered decisions list
  const filteredDecisions = decisions.filter(
    (d) =>
      (d.decision_number || '').toLowerCase().includes(searchDecisionText.toLowerCase()) ||
      (d.className || '').toLowerCase().includes(searchDecisionText.toLowerCase()) ||
      (d.classCode || '').toLowerCase().includes(searchDecisionText.toLowerCase()),
  );

  // Filtered students in detail view
  const curSub = decisionSubjects.find((s) => s.id === selectedSubjectId);
  const subKey = String(curSub?.strapiId || selectedSubjectId);
  const curSubApprovals = approvals[subKey] || {};

  const filteredStudents = decisionStudents.filter(
    (s) =>
      (s.fullName || '').toLowerCase().includes(studentSearchText.toLowerCase()) ||
      (s.studentCode || '').toLowerCase().includes(studentSearchText.toLowerCase()),
  );

  // Count approved in current subject
  const approvedCount = decisionStudents.filter((s) => {
    const rec = curSubApprovals[s.studentCode];
    if (curSub?.hasTheory) return rec?.theoryApproved;
    if (curSub?.hasPractice) return rec?.practicePass;
    return true;
  }).length;

  // View mode: decision list or approval detail
  if (!selectedDecision) {
    return (
      <div style={{ padding: '0 0 24px 0' }}>
        <Card style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col>
              <Space align="center" size="middle">
                <SafetyCertificateOutlined style={{ fontSize: 24, color: '#1677ff' }} />
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    Duyệt điều kiện dự thi
                  </Title>
                  <Text type="secondary">
                    Kiểm tra điều kiện dự thi lý thuyết và thực hành, in danh sách phòng thi có ảnh
                  </Text>
                </div>
              </Space>
            </Col>
            <Col>
              <Input
                placeholder="Tìm quyết định, mã lớp, tên lớp..."
                prefix={<SearchOutlined />}
                style={{ width: 280 }}
                value={searchDecisionText}
                onChange={(e) => setSearchDecisionText(e.target.value)}
                allowClear
              />
            </Col>
          </Row>
        </Card>

        <Card>
          {loading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : filteredDecisions.length === 0 ? (
            <Empty description="Không có lớp hoặc quyết định mở lớp nào." />
          ) : (
            <Table
              dataSource={filteredDecisions}
              rowKey={(r) => r.documentId || r.id}
              pagination={{ pageSize: 10, showTotal: (t) => `Tổng ${t} lớp` }}
              columns={[
                {
                  title: 'STT',
                  width: 60,
                  render: (_, __, idx) => idx + 1,
                },
                {
                  title: 'Số Quyết định',
                  dataIndex: 'decision_number',
                  render: (val) => <Text strong style={{ color: '#1677ff' }}>{val}</Text>,
                },
                {
                  title: 'Lớp đào tạo',
                  dataIndex: 'className',
                  render: (val, record: any) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{val}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Mã: {record.classCode || '---'} | Khóa: {record.trainingCourse}
                      </Text>
                    </div>
                  ),
                },
                {
                  title: 'Ngày ký QĐ',
                  dataIndex: 'signed_date',
                  width: 130,
                  render: (val) => fmtNgay(val),
                },
                {
                  title: 'Sĩ số',
                  dataIndex: 'studentCount',
                  width: 100,
                  align: 'center',
                  render: (c) => <Tag color="blue">{c || 0} học viên</Tag>,
                },
                {
                  title: 'Hành động',
                  width: 160,
                  render: (_, record) => (
                    <Button
                      type="primary"
                      icon={<SafetyCertificateOutlined />}
                      onClick={() => handleSelectDecision(record)}
                    >
                      Duyệt thi
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>
    );
  }

  // Detail Approval View
  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* Top Header Card */}
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space align="center" size="middle">
              <Button icon={<ArrowLeftOutlined />} onClick={() => setSelectedDecision(null)}>
                Quay lại danh sách
              </Button>
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Duyệt thi: {selectedDecision.className}
                </Title>
                <Text type="secondary">
                  Số QĐ: <Text strong>{selectedDecision.decision_number}</Text> | Khóa:{' '}
                  {selectedDecision.trainingCourse} | Tổng số: {decisionStudents.length} học viên
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <Button
                icon={<PrinterOutlined />}
                style={{ background: '#475569', borderColor: '#475569', color: '#fff' }}
                onClick={handlePrintPhotoGrid}
              >
                In danh sách
              </Button>
              <Button
                icon={<PrinterOutlined />}
                style={{ background: '#059669', borderColor: '#059669', color: '#fff' }}
                onClick={handlePrintScoreSheet}
              >
                Phiếu điểm
              </Button>
              <Button
                icon={<PrinterOutlined />}
                onClick={() => setIsPrintModalOpen(true)}
              >
                In DS phòng thi
              </Button>
              <Button
                icon={<FileExcelOutlined />}
                onClick={handleExportExcel}
              >
                Xuất Excel
              </Button>
              <Button
                type="primary"
                icon={<FileDoneOutlined />}
                loading={saving}
                style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 600 }}
                onClick={handleSaveApprovals}
              >
                Lưu duyệt thi ({approvedCount})
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Subject Tabs & Actions */}
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }} gutter={[16, 16]}>
          <Col xs={24} md={14}>
            <Space wrap align="center">
              <Text strong>Chọn môn học:</Text>
              <Select
                value={selectedSubjectId}
                onChange={(val) => setSelectedSubjectId(val)}
                style={{ width: 280 }}
              >
                {decisionSubjects.map((s) => (
                  <Select.Option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </Select.Option>
                ))}
              </Select>
              {curSub && (
                <Space>
                  {curSub.hasTheory && <Tag color="blue">Có thi Lý thuyết</Tag>}
                  {curSub.hasPractice && <Tag color="orange">Có thi Thực hành</Tag>}
                  <Tag color="green">
                    Đủ ĐK: {approvedCount}/{decisionStudents.length}
                  </Tag>
                </Space>
              )}
            </Space>
          </Col>

          <Col xs={24} md={10} style={{ textAlign: 'right' }}>
            <Space wrap>
              {curSub?.hasPractice && (
                <Button size="small" onClick={handlePassAllPractice}>
                  Tất cả đạt TH
                </Button>
              )}
              {curSub?.hasTheory && (
                <Button size="small" type="primary" onClick={handleApproveAllTheory}>
                  Duyệt tất cả LT
                </Button>
              )}
              <Button size="small" icon={<ClearOutlined />} onClick={handleClearAll}>
                Đặt lại
              </Button>
              <Input
                placeholder="Tìm học viên..."
                prefix={<SearchOutlined />}
                style={{ width: 180 }}
                value={studentSearchText}
                onChange={(e) => setStudentSearchText(e.target.value)}
                allowClear
              />
            </Space>
          </Col>
        </Row>

        <Table
          dataSource={filteredStudents}
          rowKey="studentCode"
          pagination={{ pageSize: 20, showTotal: (t) => `Tổng số ${t} học viên` }}
          columns={[
            {
              title: 'STT',
              width: 50,
              align: 'center',
              render: (_, __, idx) => idx + 1,
            },
            {
              title: 'Ảnh 3x4',
              width: 80,
              align: 'center',
              render: (_, record) =>
                record.photo ? (
                  <Image
                    src={record.photo}
                    width={40}
                    height={52}
                    style={{ objectFit: 'cover', borderRadius: 4 }}
                  />
                ) : (
                  <Avatar shape="square" size={44} icon={<UserOutlined />} />
                ),
            },
            {
              title: 'Mã HV (CCCD)',
              dataIndex: 'studentCode',
              width: 140,
              render: (code) => <Text code strong>{code}</Text>,
            },
            {
              title: 'Họ và tên',
              dataIndex: 'fullName',
              render: (name) => <Text strong style={{ textTransform: 'uppercase' }}>{name}</Text>,
            },
            {
              title: 'Ngày sinh',
              dataIndex: 'dob',
              width: 110,
              render: (dob) => fmtNgay(dob),
            },
            {
              title: 'Giới tính',
              dataIndex: 'gender',
              width: 90,
              align: 'center',
            },
            ...(curSub?.hasPractice
              ? [
                  {
                    title: 'Thực hành',
                    width: 140,
                    align: 'center' as const,
                    render: (_: any, record: StudentItem) => {
                      const appRecord = curSubApprovals[record.studentCode] || {
                        practicePass: false,
                        theoryApproved: false,
                      };
                      return (
                        <Button
                          size="small"
                          type={appRecord.practicePass ? 'primary' : 'default'}
                          danger={!appRecord.practicePass}
                          style={
                            appRecord.practicePass
                              ? { background: '#16a34a', borderColor: '#16a34a', fontWeight: 600 }
                              : { fontWeight: 600 }
                          }
                          onClick={() => handleTogglePractice(record.studentCode, !appRecord.practicePass)}
                        >
                          {appRecord.practicePass ? '✓ Đạt' : '✕ K.Đạt'}
                        </Button>
                      );
                    },
                  },
                ]
              : []),
            ...(curSub?.hasTheory
              ? [
                  {
                    title: 'Duyệt Lý thuyết',
                    width: 140,
                    align: 'center' as const,
                    render: (_: any, record: StudentItem) => {
                      const appRecord = curSubApprovals[record.studentCode] || {
                        practicePass: !curSub?.hasPractice,
                        theoryApproved: false,
                      };
                      const disabled = curSub?.hasPractice && !appRecord.practicePass;
                      return (
                        <Switch
                          checkedChildren="Duyệt"
                          unCheckedChildren="Chưa"
                          checked={appRecord.theoryApproved}
                          disabled={disabled}
                          onChange={(c) => handleToggleTheory(record.studentCode, c)}
                        />
                      );
                    },
                  },
                ]
              : []),
            {
              title: 'Kết luận điều kiện',
              width: 160,
              align: 'center',
              render: (_, record) => {
                const appRecord = curSubApprovals[record.studentCode] || {
                  practicePass: !curSub?.hasPractice,
                  theoryApproved: false,
                };

                let isPassed = false;
                if (curSub?.hasTheory) {
                  isPassed = appRecord.theoryApproved;
                } else if (curSub?.hasPractice) {
                  isPassed = appRecord.practicePass;
                } else {
                  isPassed = true;
                }

                return isPassed ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    ĐỦ ĐIỀU KIỆN
                  </Tag>
                ) : (
                  <Tag color="default">CHƯA DUYỆT</Tag>
                );
              },
            },
          ]}
        />
      </Card>

      {/* Print Admission Card Modal */}
      <Modal
        title="In danh sách dự thi có ảnh"
        open={isPrintModalOpen}
        onCancel={() => setIsPrintModalOpen(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setIsPrintModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => window.print()}
          >
            In danh sách
          </Button>,
        ]}
      >
        <div style={{ padding: '16px', fontFamily: '"Times New Roman", serif', fontSize: '13pt', lineHeight: 1.5 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h3 style={{ textTransform: 'uppercase', margin: 0, fontSize: '14pt', fontWeight: 'bold' }}>
              DANH SÁCH THÍ SINH ĐỦ ĐIỀU KIỆN DỰ THI
            </h3>
            <p style={{ margin: '4px 0', fontWeight: 'bold' }}>
              Môn thi: {curSub?.name} ({curSub?.code})
            </p>
            <p style={{ margin: '2px 0' }}>
              Lớp: {selectedDecision.className} - Khóa: {selectedDecision.trainingCourse}
            </p>
            <p style={{ margin: 0, fontStyle: 'italic', fontSize: '11pt' }}>
              (Kèm theo Quyết định số: {selectedDecision.decision_number})
            </p>
          </div>

          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt', marginBottom: 24 }}
            border={1}
          >
            <thead>
              <tr style={{ background: '#fafafa', textAlign: 'center' }}>
                <th style={{ padding: '6px', width: 40 }}>STT</th>
                <th style={{ padding: '6px', width: 70 }}>Ảnh 3x4</th>
                <th style={{ padding: '6px', width: 110 }}>Số CCCD</th>
                <th style={{ padding: '6px' }}>Họ và tên</th>
                <th style={{ padding: '6px', width: 90 }}>Ngày sinh</th>
                <th style={{ padding: '6px', width: 80 }}>Chữ ký thí sinh</th>
                <th style={{ padding: '6px', width: 70 }}>Điểm thi</th>
              </tr>
            </thead>
            <tbody>
              {decisionStudents
                .filter((s) => {
                  const rec = curSubApprovals[s.studentCode];
                  if (curSub?.hasTheory) return rec?.theoryApproved;
                  if (curSub?.hasPractice) return rec?.practicePass;
                  return true;
                })
                .map((s, idx) => (
                  <tr key={s.studentCode}>
                    <td style={{ padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>
                      {s.photo ? (
                        <img
                          src={s.photo}
                          alt=""
                          style={{ width: 36, height: 48, objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 36,
                            height: 48,
                            border: '1px dashed #ccc',
                            margin: '0 auto',
                            fontSize: 9,
                            lineHeight: '48px',
                          }}
                        >
                          Ảnh
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace' }}>
                      {s.studentCode}
                    </td>
                    <td style={{ padding: '6px', fontWeight: 'bold' }}>{s.fullName}</td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>{fmtNgay(s.dob)}</td>
                    <td style={{ padding: '6px' }}></td>
                    <td style={{ padding: '6px' }}></td>
                  </tr>
                ))}
            </tbody>
          </table>

          <Row justify="space-between" style={{ marginTop: 32 }}>
            <Col span={10} style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 'bold', margin: 0 }}>HỘI ĐỒNG THI</p>
              <div style={{ height: 60 }} />
              <p style={{ fontStyle: 'italic' }}>(Ký và ghi rõ họ tên)</p>
            </Col>
            <Col span={10} style={{ textAlign: 'center' }}>
              <p style={{ fontStyle: 'italic', margin: 0 }}>
                Hải Phòng, ngày {dayjs().format('DD')} tháng {dayjs().format('MM')} năm {dayjs().format('YYYY')}
              </p>
              <p style={{ fontWeight: 'bold', margin: '4px 0' }}>PHÒNG ĐÀO TẠO</p>
              <div style={{ height: 60 }} />
              <p style={{ fontStyle: 'italic' }}>(Ký và ghi rõ họ tên)</p>
            </Col>
          </Row>
        </div>
      </Modal>
    </div>
  );
}

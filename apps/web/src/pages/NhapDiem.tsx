import { useEffect, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileExcelOutlined,
  FormOutlined,
  PrinterOutlined,
  SaveOutlined,
  SearchOutlined,
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
}

interface SubjectItem {
  id: string;
  strapiId?: number;
  code: string;
  name: string;
  hasTheory?: boolean;
  hasPractice?: boolean;
}

interface GradeData {
  theory: string;
  practice: string;
}

export default function NhapDiem() {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected decision & modal/detail states
  const [selectedDecision, setSelectedDecision] = useState<any | null>(null);
  const [decisionStudents, setDecisionStudents] = useState<StudentItem[]>([]);
  const [decisionSubjects, setDecisionSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // Approvals: subKey -> studentCode -> { practicePass, theoryApproved }
  const [approvals, setApprovals] = useState<Record<string, Record<string, any>>>({});

  // Grades: subKey -> studentCode -> { theory, practice }
  const [inputGrades, setInputGrades] = useState<Record<string, Record<string, GradeData>>>({});
  const [currentGradeDocId, setCurrentGradeDocId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [batchLT, setBatchLT] = useState<string>('');
  const [batchTH, setBatchTH] = useState<string>('');

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
      const allSubs = normalizeStrapiList(subsRes).map((s: any) => ({
        id: String(s.documentId || s.id),
        strapiId: s.strapiId || s.id,
        code: s.code,
        name: s.name,
        hasTheory: s.has_theory !== false,
        hasPractice: s.has_practice === true,
      }));

      setSubjects(allSubs);

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
      message.error('Lỗi khi tải dữ liệu: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDecision = async (decision: any) => {
    setSelectedDecision(decision);
    setLoading(true);
    try {
      const decId = decision.documentId || decision.id;

      // 1. Fetch class subjects
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
      if (classSubs.length > 0) setSelectedSubjectId(classSubs[0].id);

      // 2. Fetch all recognized student IDs to filter them out
      const recDecsRes = await api<any>(
        `/${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=RECOGNITION&populate[students][fields][0]=id&populate[students][fields][1]=documentId&publicationState=preview&pagination[limit]=1000`,
      );
      const recDecs = normalizeStrapiList(recDecsRes);
      const recognizedIds = new Set<string>();
      recDecs.forEach((d: any) => {
        const sData = d.students?.data || d.students || [];
        sData.forEach((s: any) => recognizedIds.add(String(s.documentId || s.id)));
      });

      // 3. Fetch full decision students
      const fullDecRes = await api<any>(
        `/${COLLECTIONS.CLASS_DECISIONS}?filters[documentId][$eq]=${decId}&populate[students][populate]=*&publicationState=preview`,
      );
      const fullList = normalizeStrapiList(fullDecRes);
      const fullDec = fullList[0] || decision;

      let rawStudents: any[] = [];
      if (Array.isArray(fullDec.students)) rawStudents = fullDec.students;
      else if (fullDec.students?.data) rawStudents = fullDec.students.data;

      const mappedStudents: StudentItem[] = rawStudents
        .map((s: any) => ({
          id: String(s.documentId || s.id),
          studentCode: s.student_code || s.code || '',
          fullName: s.full_name || s.name || '',
          dob: s.dob || '',
          gender: s.gender || '',
        }))
        .filter((s) => !recognizedIds.has(s.id))
        .sort((a, b) => {
          const nameA = (a.fullName || '').split(' ').pop() || '';
          const nameB = (b.fullName || '').split(' ').pop() || '';
          return nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
        });

      setDecisionStudents(mappedStudents);

      // 4. Load Approvals
      await loadExistingApprovals(decId);

      // 5. Load Grades
      await loadExistingGrades(decId);
    } catch (err: any) {
      message.error('Lỗi khi mở nhập điểm lớp: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const loadExistingApprovals = async (decId: string) => {
    setApprovals({});
    try {
      const res = await api<any>(
        `/${COLLECTIONS.EXAM_APPROVALS}?filters[decision][documentId][$eq]=${decId}&publicationState=preview`,
      );
      const list = normalizeStrapiList(res);
      if (list.length > 0 && list[0].approvals) {
        setApprovals(list[0].approvals);
      }
    } catch (err) {
      console.warn('Lỗi tải duyệt thi:', err);
    }
  };

  const loadExistingGrades = async (decId: string) => {
    setInputGrades({});
    setCurrentGradeDocId(null);
    try {
      const res = await api<any>(
        `/${COLLECTIONS.EXAM_GRADES}?filters[decision][documentId][$eq]=${decId}&publicationState=preview`,
      );
      const list = normalizeStrapiList(res);
      if (list.length > 0) {
        const record = list[0];
        setCurrentGradeDocId(record.documentId || record.id);
        if (record.grades) setInputGrades(record.grades);
      }
    } catch (err) {
      console.warn('Lỗi tải bảng điểm:', err);
    }
  };

  const handleGradeChange = (studentCode: string, type: 'theory' | 'practice', value: string) => {
    if (!selectedSubjectId) return;
    const curSub = decisionSubjects.find((s) => s.id === selectedSubjectId);
    const subKey = String(curSub?.strapiId || selectedSubjectId);
    const curSubGrades = inputGrades[subKey] || {};
    const studentGrade = curSubGrades[studentCode] || { theory: '', practice: '' };

    setInputGrades({
      ...inputGrades,
      [subKey]: {
        ...curSubGrades,
        [studentCode]: {
          ...studentGrade,
          [type]: value,
        },
      },
    });
  };

  const handleSaveGrades = async () => {
    if (!selectedDecision) return;
    setSaving(true);
    try {
      const strapiDecId = Number(selectedDecision.strapiId || selectedDecision.id);
      const payload = {
        data: {
          decision: !isNaN(strapiDecId) && strapiDecId > 0 ? strapiDecId : undefined,
          grades: inputGrades,
          publishedAt: new Date().toISOString(),
        },
      };

      if (currentGradeDocId) {
        await api<any>(`/${COLLECTIONS.EXAM_GRADES}/${currentGradeDocId}`, {
          method: 'PUT',
          body: payload,
        });
      } else {
        const newRecord = await api<any>(`/${COLLECTIONS.EXAM_GRADES}`, {
          method: 'POST',
          body: payload,
        });
        const nId = newRecord?.data?.documentId || newRecord?.documentId;
        if (nId) setCurrentGradeDocId(nId);
      }

      message.success('Đã lưu bảng điểm thành công vào hệ thống!');
    } catch (err: any) {
      message.error('Lỗi khi lưu bảng điểm: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleBatchApplyLT = () => {
    const val = parseFloat(batchLT);
    if (isNaN(val) || val < 0 || val > 10) { message.warning('Nhập điểm LT hợp lệ (0-10)'); return; }
    if (!selectedSubjectId) return;
    const curSub = decisionSubjects.find((s) => s.id === selectedSubjectId);
    const subKey = String(curSub?.strapiId || selectedSubjectId);
    const curSubGrades = { ...(inputGrades[subKey] || {}) };
    decisionStudents.forEach((s) => {
      const current = curSubGrades[s.studentCode] || { theory: '', practice: '' };
      curSubGrades[s.studentCode] = { ...current, theory: String(val) };
    });
    setInputGrades({ ...inputGrades, [subKey]: curSubGrades });
    message.success(`Đã áp dụng điểm LT ${val} cho tất cả học viên`);
  };

  const handleBatchApplyTH = () => {
    const val = parseFloat(batchTH);
    if (isNaN(val) || val < 0 || val > 10) { message.warning('Nhập điểm TH hợp lệ (0-10)'); return; }
    if (!selectedSubjectId) return;
    const curSub = decisionSubjects.find((s) => s.id === selectedSubjectId);
    const subKey = String(curSub?.strapiId || selectedSubjectId);
    const curSubGrades = { ...(inputGrades[subKey] || {}) };
    decisionStudents.forEach((s) => {
      const current = curSubGrades[s.studentCode] || { theory: '', practice: '' };
      curSubGrades[s.studentCode] = { ...current, practice: String(val) };
    });
    setInputGrades({ ...inputGrades, [subKey]: curSubGrades });
    message.success(`Đã áp dụng điểm TH ${val} cho tất cả học viên`);
  };

  const handleQuickFillScores = (score: number) => {
    if (!selectedSubjectId) return;
    const curSub = decisionSubjects.find((s) => s.id === selectedSubjectId);
    const subKey = String(curSub?.strapiId || selectedSubjectId);
    const subApprs = approvals[subKey] || {};
    const curSubGrades = { ...(inputGrades[subKey] || {}) };

    decisionStudents.forEach((s) => {
      const app = subApprs[s.studentCode] || { practicePass: !curSub?.hasPractice, theoryApproved: true };
      const current = curSubGrades[s.studentCode] || { theory: '', practice: '' };

      curSubGrades[s.studentCode] = {
        theory: curSub?.hasTheory && app.theoryApproved ? String(score) : current.theory,
        practice: curSub?.hasPractice && app.practicePass ? String(score) : current.practice,
      };
    });

    setInputGrades({
      ...inputGrades,
      [subKey]: curSubGrades,
    });
    message.success(`Đã điền nhanh điểm ${score} cho các học viên đủ điều kiện!`);
  };

  const handleExportExcel = async () => {
    if (!selectedDecision || !curSub) return;
    const subKey = String(curSub?.strapiId || selectedSubjectId);
    const curSubGrades = inputGrades[subKey] || {};

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Bảng điểm');

    ws.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'Mã HV', key: 'studentCode', width: 15 },
      { header: 'Họ và tên', key: 'fullName', width: 25 },
      { header: 'Ngày sinh', key: 'dob', width: 12 },
      { header: 'Lý thuyết', key: 'theory', width: 12 },
      { header: 'Thực hành', key: 'practice', width: 12 },
      { header: 'Tổng kết', key: 'summary', width: 10 },
      { header: 'Kết quả', key: 'result', width: 10 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
    headerRow.alignment = { horizontal: 'center' };

    decisionStudents.forEach((s, idx) => {
      const g = curSubGrades[s.studentCode] || { theory: '', practice: '' };
      const t = parseFloat(g.theory);
      const p = parseFloat(g.practice);

      let summary = '';
      let isPass = false;
      if (curSub.hasTheory && curSub.hasPractice) {
        if (!isNaN(t) && !isNaN(p)) {
          const avg = (t + p) / 2;
          summary = avg.toFixed(1);
          isPass = t >= 5 && p >= 5;
        }
      } else if (curSub.hasTheory) {
        if (!isNaN(t)) { summary = t.toFixed(1); isPass = t >= 5; }
      } else if (curSub.hasPractice) {
        if (!isNaN(p)) { summary = p.toFixed(1); isPass = p >= 5; }
      }

      const row = ws.addRow({
        stt: idx + 1,
        studentCode: s.studentCode,
        fullName: s.fullName,
        dob: fmtNgay(s.dob),
        theory: g.theory || '',
        practice: g.practice || '',
        summary,
        result: summary ? (isPass ? 'Đạt' : 'Chưa đạt') : '',
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
      `Bang_Diem_${curSub.code}_${selectedDecision.className}_${dayjs().format('DDMMYYYY')}.xlsx`,
    );
    message.success('Đã xuất file điểm Excel thành công!');
  };

  const handlePrintGradeSheet = () => {
    if (!selectedDecision || !curSub) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Vui lòng cho phép Pop-up trên trình duyệt để in.');
      return;
    }
    const subKey = String(curSub?.strapiId || selectedSubjectId);
    const curSubGrades = inputGrades[subKey] || {};
    const curSubAppr = approvals[subKey] || {};

    const rowsHtml = decisionStudents
      .map((s, idx) => {
        const g = curSubGrades[s.studentCode] || { theory: '', practice: '' };
        const app = curSubAppr[s.studentCode] || { practicePass: !curSub?.hasPractice, theoryApproved: true };
        const t = parseFloat(g.theory);
        const p = parseFloat(g.practice);
        let summary = '';
        let isPass = false;
        if (curSub.hasTheory && curSub.hasPractice) {
          if (!isNaN(t)) {
            const pPass = !isNaN(p) ? p >= 5 : app.practicePass;
            summary = !isNaN(p) ? ((t + p) / 2).toFixed(1) : t.toFixed(1);
            isPass = t >= 5 && pPass;
          }
        } else if (curSub.hasTheory) {
          if (!isNaN(t)) {
            summary = t.toFixed(1);
            isPass = t >= 5;
          }
        } else if (curSub.hasPractice) {
          if (!isNaN(p)) {
            summary = p.toFixed(1);
            isPass = p >= 5;
          } else {
            summary = app.practicePass ? 'Đạt' : 'K.Đạt';
            isPass = !!app.practicePass;
          }
        }
        return `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td style="text-align:center;">${s.studentCode}</td>
            <td><b>${s.fullName}</b></td>
            <td style="text-align:center;">${fmtNgay(s.dob)}</td>
            <td style="text-align:center;">${g.theory || ''}</td>
            <td style="text-align:center;">${g.practice || (curSub.hasPractice ? (app.practicePass ? 'Đạt' : 'K.Đạt') : '')}</td>
            <td style="text-align:center;"><b>${summary}</b></td>
            <td style="text-align:center;">${summary ? (isPass ? 'Đạt' : 'Chưa đạt') : ''}</td>
          </tr>
        `;
      })
      .join('');

    const html = `
      <html>
      <head>
        <title>Bảng điểm - ${curSub.name}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; }
          h2, h3 { text-align: center; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11pt; }
          th, td { border: 1px solid #000; padding: 6px 8px; }
          th { background: #f2f2f2; text-align: center; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>BẢNG ĐIỂM THI KẾT THÚC MÔN</h2>
        <h3>Lớp: ${selectedDecision.className} - Khóa: ${selectedDecision.trainingCourse || ''}</h3>
        <div style="text-align:center; margin-bottom:10px;">Môn học: <b>${curSub.name} (${curSub.code})</b></div>
        <table>
          <thead>
            <tr>
              <th style="width:45px;">STT</th>
              <th style="width:110px;">Mã HV</th>
              <th>Họ và tên</th>
              <th style="width:95px;">Ngày sinh</th>
              <th style="width:80px;">Lý thuyết</th>
              <th style="width:80px;">Thực hành</th>
              <th style="width:80px;">Tổng kết</th>
              <th style="width:90px;">Kết quả</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>window.onload = function() { setTimeout(() => { window.print(); }, 400); };</script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const curSub = decisionSubjects.find((s) => s.id === selectedSubjectId);
  const subKey = String(curSub?.strapiId || selectedSubjectId);
  const curSubGrades = inputGrades[subKey] || {};
  const curSubApprovals = approvals[subKey] || {};

  const filteredDecisions = decisions.filter(
    (d) =>
      (d.decision_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.className || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.classCode || '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!selectedDecision) {
    return (
      <div style={{ padding: '0 0 24px 0' }}>
        <Card style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col>
              <Space align="center" size="middle">
                <FormOutlined style={{ fontSize: 24, color: '#1677ff' }} />
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    Nhập điểm thi kết thúc môn
                  </Title>
                  <Text type="secondary">
                    Nhập điểm thi lý thuyết & thực hành, tính điểm tổng kết và kết quả đạt môn
                  </Text>
                </div>
              </Space>
            </Col>
            <Col>
              <Input
                placeholder="Tìm quyết định, tên lớp..."
                prefix={<SearchOutlined />}
                style={{ width: 280 }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                allowClear
              />
            </Col>
          </Row>
        </Card>

        <Card>
          {loading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : filteredDecisions.length === 0 ? (
            <Empty description="Không có lớp học nào đang mở để nhập điểm." />
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
                  render: (c) => <Tag color="blue">{c || 0} HV</Tag>,
                },
                {
                  title: 'Hành động',
                  width: 160,
                  render: (_, record) => (
                    <Button
                      type="primary"
                      icon={<FormOutlined />}
                      onClick={() => handleSelectDecision(record)}
                    >
                      Nhập điểm
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

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space align="center" size="middle">
              <Button icon={<ArrowLeftOutlined />} onClick={() => setSelectedDecision(null)}>
                Quay lại
              </Button>
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Bảng điểm: {selectedDecision.className}
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
              <Button icon={<PrinterOutlined />} onClick={handlePrintGradeSheet}>
                In bảng điểm
              </Button>
              <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>
                Xuất Excel
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 600 }}
                onClick={handleSaveGrades}
              >
                Lưu bảng điểm
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }} gutter={[16, 16]}>
          <Col xs={24} md={12}>
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
            </Space>
          </Col>
          <Col xs={24} md={12} style={{ textAlign: 'right' }}>
            <Space wrap>
              <Text type="secondary" style={{ fontSize: 13 }}>Điền nhanh:</Text>
              <Button size="small" onClick={() => handleQuickFillScores(7)}>7.0</Button>
              <Button size="small" onClick={() => handleQuickFillScores(8)}>8.0</Button>
              <Button size="small" onClick={() => handleQuickFillScores(9)}>9.0</Button>
              <Input
                size="small"
                placeholder="LT"
                style={{ width: 60 }}
                value={batchLT}
                onChange={(e) => setBatchLT(e.target.value)}
              />
              <Button size="small" onClick={handleBatchApplyLT}>Áp dụng LT</Button>
              <Input
                size="small"
                placeholder="TH"
                style={{ width: 60 }}
                value={batchTH}
                onChange={(e) => setBatchTH(e.target.value)}
              />
              <Button size="small" onClick={handleBatchApplyTH}>Áp dụng TH</Button>
            </Space>
          </Col>
        </Row>

        <Table
          dataSource={decisionStudents}
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
              title: 'Điều kiện dự thi',
              width: 150,
              align: 'center',
              render: (_, record) => {
                const app = curSubApprovals[record.studentCode] || {
                  practicePass: !curSub?.hasPractice,
                  theoryApproved: false,
                };
                const eligible = !curSub?.hasTheory || app.theoryApproved;
                return eligible ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>Đủ ĐK thi</Tag>
                ) : (
                  <Tag color="error" icon={<CloseCircleOutlined />}>Chưa duyệt</Tag>
                );
              },
            },
            ...(curSub?.hasTheory
              ? [
                  {
                    title: 'Lý thuyết (0-10)',
                    width: 150,
                    align: 'center' as const,
                    render: (_: any, record: StudentItem) => {
                      const app = curSubApprovals[record.studentCode] || {
                        practicePass: !curSub?.hasPractice,
                        theoryApproved: false,
                      };
                      const g = curSubGrades[record.studentCode] || { theory: '', practice: '' };
                      const disabled = !app.theoryApproved;
                      return (
                        <InputNumber
                          min={0}
                          max={10}
                          step={0.5}
                          precision={1}
                          disabled={disabled}
                          placeholder={disabled ? 'Khóa' : 'Nhập điểm'}
                          value={g.theory ? parseFloat(g.theory) : null}
                          onChange={(val) =>
                            handleGradeChange(record.studentCode, 'theory', val !== null ? String(val) : '')
                          }
                          style={{ width: 110, textAlign: 'center' }}
                        />
                      );
                    },
                  },
                ]
              : []),
            ...(curSub?.hasPractice
              ? [
                  {
                    title: 'Thực hành',
                    width: 190,
                    align: 'center' as const,
                    render: (_: any, record: StudentItem) => {
                      const app = curSubApprovals[record.studentCode];
                      const g = curSubGrades[record.studentCode] || { theory: '', practice: '' };
                      return (
                        <Space size={6}>
                          {app && (
                            <Tag color={app.practicePass ? 'success' : 'error'} style={{ margin: 0 }}>
                              {app.practicePass ? 'Đạt' : 'K.Đạt'}
                            </Tag>
                          )}
                          <InputNumber
                            min={0}
                            max={10}
                            step={0.5}
                            precision={1}
                            placeholder="Điểm"
                            value={g.practice ? parseFloat(g.practice) : null}
                            onChange={(val) =>
                              handleGradeChange(record.studentCode, 'practice', val !== null ? String(val) : '')
                            }
                            style={{ width: 85, textAlign: 'center' }}
                          />
                        </Space>
                      );
                    },
                  },
                ]
              : []),
            {
              title: 'Tổng kết môn',
              width: 140,
              align: 'center',
              render: (_, record) => {
                const g = curSubGrades[record.studentCode] || { theory: '', practice: '' };
                const t = parseFloat(g.theory);
                const p = parseFloat(g.practice);

                let summary = '';
                let isPass = false;
                if (curSub?.hasTheory && curSub?.hasPractice) {
                  if (!isNaN(t) && !isNaN(p)) {
                    const avg = (t + p) / 2;
                    summary = avg.toFixed(1);
                    isPass = t >= 5 && p >= 5;
                  }
                } else if (curSub?.hasTheory) {
                  if (!isNaN(t)) {
                    summary = t.toFixed(1);
                    isPass = t >= 5;
                  }
                } else if (curSub?.hasPractice) {
                  if (!isNaN(p)) {
                    summary = p.toFixed(1);
                    isPass = p >= 5;
                  }
                }

                if (!summary) return <Text type="secondary">---</Text>;

                return (
                  <Space direction="vertical" size={2}>
                    <Text strong style={{ fontSize: 15, color: isPass ? '#52c41a' : '#ff4d4f' }}>
                      {summary}
                    </Text>
                    <Tag color={isPass ? 'success' : 'error'}>
                      {isPass ? 'ĐẠT' : 'CHƯA ĐẠT'}
                    </Tag>
                  </Space>
                );
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}

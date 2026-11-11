import { useEffect, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileDoneOutlined,
  FileExcelOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { api, COLLECTIONS, normalizeStrapiList } from '../api';
import { fmtNgay } from '../constants';

const { Title, Text } = Typography;

export interface DetailedAssignmentRow {
  subjectId: string;
  subjectName: string;
  date: string;
  shift: 'Sáng' | 'Chiều' | 'Tối';
  teacherId: string;
  teacherName: string;
  notes: string;
  isAutoFilled?: boolean;
}

export default function PhanCong() {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, any>>({});
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>();
  const [searchDecisionText, setSearchDecisionText] = useState('');

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<any>(null);
  const [assignmentRows, setAssignmentRows] = useState<DetailedAssignmentRow[]>([]);
  const [existingAssignmentId, setExistingAssignmentId] = useState<string | null>(null);
  const [autoStartDate, setAutoStartDate] = useState<Dayjs>(dayjs());
  const [globalOccupancy, setGlobalOccupancy] = useState<Record<string, Record<string, Record<string, string>>>>({});

  const isSameTeacher = (t: any, teacherId?: string) => {
    if (!t || !teacherId) return false;
    const target = String(teacherId);
    return (
      String(t.documentId || '') === target ||
      String(t.id || '') === target ||
      String(t.strapiId || '') === target
    );
  };

  const matchSubject = (subObjOrId: any, targetId?: string, targetName?: string) => {
    if (!subObjOrId) return false;
    if (typeof subObjOrId === 'string' || typeof subObjOrId === 'number') {
      if (!targetId) return false;
      if (String(subObjOrId) === String(targetId)) return true;
      const sA = subjects.find(
        (ms) =>
          String(ms.documentId) === String(subObjOrId) ||
          String(ms.id) === String(subObjOrId) ||
          String(ms.strapiId) === String(subObjOrId),
      );
      const sB = subjects.find(
        (ms) =>
          String(ms.documentId) === String(targetId) ||
          String(ms.id) === String(targetId) ||
          String(ms.strapiId) === String(targetId),
      );
      return Boolean(sA && sB && String(sA.documentId || sA.id) === String(sB.documentId || sB.id));
    }
    const item = subObjOrId.attributes ? { ...subObjOrId.attributes, ...subObjOrId } : subObjOrId;
    if (targetId) {
      const sDocId = item.documentId ? String(item.documentId) : '';
      const sId = item.id !== undefined ? String(item.id) : '';
      const sStrapiId = item.strapiId !== undefined ? String(item.strapiId) : '';
      const tId = String(targetId);
      if (tId === sDocId || tId === sId || tId === sStrapiId) return true;

      const masterSub = subjects.find(
        (ms) =>
          String(ms.documentId) === tId ||
          String(ms.id) === tId ||
          String(ms.strapiId) === tId,
      );
      if (masterSub) {
        const mDoc = masterSub.documentId ? String(masterSub.documentId) : '';
        const mStrapi = masterSub.strapiId !== undefined ? String(masterSub.strapiId) : '';
        if (
          (mDoc && (mDoc === sDocId || mDoc === sId)) ||
          (mStrapi && (mStrapi === sId || mStrapi === sStrapiId)) ||
          (masterSub.code && item.code && String(masterSub.code) === String(item.code))
        ) {
          return true;
        }
      }
    }
    if (targetName && item.name) {
      return item.name.trim().toLowerCase() === targetName.trim().toLowerCase();
    }
    return false;
  };

  const teacherCanTeachSubject = (teacher: any, subjectId?: string, subjectName?: string) => {
    if (!subjectId && !subjectName) return true;
    const rawSubs = Array.isArray(teacher?.subjects)
      ? teacher.subjects
      : teacher?.subjects?.data || [];
    return rawSubs.some((ts: any) => matchSubject(ts, subjectId, subjectName));
  };

  const isTeacherBusyOtherDecision = (date: string, shift: string, teacherId: string) => {
    const occupiedByDec = globalOccupancy[date]?.[shift]?.[teacherId];
    if (!occupiedByDec) return false;
    const currentDecId = String(selectedDecision?.documentId || selectedDecision?.id || '');
    return occupiedByDec !== currentDecId;
  };

  // Print modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [decsRes, teachersRes, subsRes, assignsRes] = await Promise.all([
        api<any>(
          `/${COLLECTIONS.CLASS_DECISIONS}?populate[school_class]=true&populate[related_decision]=true&populate[students][count]=true&publicationState=preview&pagination[limit]=500`,
        ),
        api<any>(`/${COLLECTIONS.TEACHERS}?populate=*&publicationState=preview&pagination[limit]=500`),
        api<any>(`/${COLLECTIONS.SUBJECTS}?populate=*&publicationState=preview&pagination[limit]=500`),
        api<any>(
          `/${COLLECTIONS.TRAINING_ASSIGNMENTS}?populate[decision]=true&publicationState=preview&pagination[limit]=500`,
        ),
      ]);

      const allDecs = normalizeStrapiList(decsRes);
      const allTeachers = normalizeStrapiList(teachersRes);
      const allSubjects = normalizeStrapiList(subsRes);
      const allAssigns = normalizeStrapiList(assignsRes);

      // Build map of decisionId -> assignment
      const aMap: Record<string, any> = {};
      const occupancy: Record<string, Record<string, Record<string, string>>> = {};

      allAssigns.forEach((a: any) => {
        const decRel = a.decision?.data || a.decision;
        const decId = String(decRel?.documentId || decRel?.id || '');
        if (decId) aMap[decId] = a;

        if (Array.isArray(a.schedule)) {
          a.schedule.forEach((row: any) => {
            if (row.date && row.shift && row.teacherId) {
              const d = row.date;
              const s = row.shift;
              const matchedT = allTeachers.find(
                (t: any) =>
                  String(t.documentId) === String(row.teacherId) ||
                  String(t.id) === String(row.teacherId) ||
                  String(t.strapiId) === String(row.teacherId),
              );
              const tId = matchedT ? String(matchedT.documentId || matchedT.id) : String(row.teacherId);
              if (!occupancy[d]) occupancy[d] = {};
              if (!occupancy[d][s]) occupancy[d][s] = {};
              occupancy[d][s][tId] = decId || 'other';
            }
          });
        }
      });

      setAssignmentMap(aMap);
      setGlobalOccupancy(occupancy);
      setTeachers(allTeachers);
      setSubjects(allSubjects);

      // Identify finalized opening decisions
      const finalizedOpeningIds = new Set(
        allDecs
          .filter((d: any) => d.type === 'RECOGNITION')
          .map((d: any) => {
            const rel = d.related_decision;
            return String(rel?.documentId || rel?.id || '');
          })
          .filter((id: string) => id !== ''),
      );

      // Filter OPENING decisions that are active
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

      // Enrich decisions with class subjects
      const enriched = await Promise.all(
        validDecs.map(async (d: any) => {
          if (d.classId) {
            try {
              const classDetail = await api<any>(`/${COLLECTIONS.CLASSES}/${d.classId}?populate=*`);
              const rawClass = classDetail?.data || classDetail;
              const subs = normalizeStrapiList(rawClass?.subjects || { data: rawClass?.subjects || [] });
              return { ...d, classSubjects: subs };
            } catch {
              return { ...d, classSubjects: [] };
            }
          }
          return { ...d, classSubjects: [] };
        }),
      );

      setDecisions(enriched);
    } catch (err: any) {
      message.error('Lỗi khi tải dữ liệu phân công: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const openAssignmentModal = async (record: any) => {
    setSelectedDecision(record);
    const decId = String(record.documentId || record.id);
    const existingAssign = assignmentMap[decId];

    if (existingAssign && Array.isArray(existingAssign.schedule) && existingAssign.schedule.length > 0) {
      setExistingAssignmentId(existingAssign.documentId || existingAssign.id);
      const normalizedSchedule = existingAssign.schedule.map((r: any) => {
        const matchedSub = subjects.find((s) => matchSubject(s, r.subjectId, r.subjectName));
        const matchedTeacher = teachers.find((t) => isSameTeacher(t, r.teacherId));
        return {
          ...r,
          subjectId: matchedSub ? String(matchedSub.documentId || matchedSub.id) : r.subjectId,
          subjectName: matchedSub?.name || r.subjectName || '',
          teacherId: matchedTeacher ? String(matchedTeacher.documentId || matchedTeacher.id) : r.teacherId || '',
          teacherName: matchedTeacher ? matchedTeacher.full_name || matchedTeacher.name || '' : r.teacherName || '',
        };
      });
      setAssignmentRows(normalizedSchedule);
      const firstDate = normalizedSchedule[0]?.date;
      if (firstDate && dayjs(firstDate).isValid()) {
        setAutoStartDate(dayjs(firstDate));
      }
    } else {
      setExistingAssignmentId(null);
      const initialDate =
        record.startDate && dayjs(record.startDate).isValid() ? dayjs(record.startDate) : dayjs();
      setAutoStartDate(initialDate);
      // Generate initial blank sessions from subjects starting from initialDate
      generateEmptyRows(record.classSubjects || [], initialDate);
    }

    setIsModalOpen(true);
  };

  const generateEmptyRows = (classSubs: any[], baseDate: Dayjs = autoStartDate) => {
    const rows: DetailedAssignmentRow[] = [];

    classSubs.forEach((subRef: any) => {
      const subId = String(subRef.documentId || subRef.id);
      const sub = subjects.find((s) => String(s.documentId || s.id) === subId) || subRef;
      const subName = sub.name || 'Môn học';
      const totalHours = sub.total_hours || 5;
      const sessions = Math.max(1, Math.ceil(totalHours / 5));

      for (let i = 0; i < sessions; i++) {
        const sessionIdx = rows.length;
        rows.push({
          subjectId: subId,
          subjectName: subName,
          date: baseDate.add(Math.floor(sessionIdx / 2), 'day').format('YYYY-MM-DD'),
          shift: sessionIdx % 2 === 0 ? 'Sáng' : 'Chiều',
          teacherId: '',
          teacherName: '',
          notes: '',
          isAutoFilled: false,
        });
      }
    });

    if (rows.length === 0) {
      rows.push({
        subjectId: '',
        subjectName: '',
        date: baseDate.format('YYYY-MM-DD'),
        shift: 'Sáng',
        teacherId: '',
        teacherName: '',
        notes: '',
        isAutoFilled: false,
      });
    }

    setAssignmentRows(rows);
  };

  const handleStartDateChange = (newDate: Dayjs | null) => {
    if (!newDate) return;
    setAutoStartDate(newDate);
    setAssignmentRows((prevRows) =>
      prevRows.map((row, idx) => ({
        ...row,
        date: newDate.add(Math.floor(idx / 2), 'day').format('YYYY-MM-DD'),
        shift: idx % 2 === 0 ? 'Sáng' : 'Chiều',
      })),
    );
  };

  const handleResetFromSubjects = () => {
    if (!selectedDecision) return;
    generateEmptyRows(selectedDecision.classSubjects || [], autoStartDate);
    message.info('Đã tải lại danh sách buổi dạy từ chương trình đào tạo.');
  };

  const handleAddRow = () => {
    const lastRow = assignmentRows[assignmentRows.length - 1];
    const nextDate = lastRow?.date
      ? lastRow.shift === 'Sáng'
        ? lastRow.date
        : dayjs(lastRow.date).add(1, 'day').format('YYYY-MM-DD')
      : autoStartDate.format('YYYY-MM-DD');
    const nextShift: 'Sáng' | 'Chiều' = lastRow?.shift === 'Sáng' ? 'Chiều' : 'Sáng';

    setAssignmentRows([
      ...assignmentRows,
      {
        subjectId: lastRow?.subjectId || '',
        subjectName: lastRow?.subjectName || '',
        date: nextDate,
        shift: nextShift,
        teacherId: '',
        teacherName: '',
        notes: '',
        isAutoFilled: false,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    const next = [...assignmentRows];
    next.splice(index, 1);
    setAssignmentRows(next);
  };

  const handleFieldChange = (index: number, field: keyof DetailedAssignmentRow, value: any) => {
    const next = [...assignmentRows];
    next[index] = { ...next[index], [field]: value };

    if (field === 'subjectId') {
      const foundSub = subjects.find((s) => matchSubject(s, value));
      next[index].subjectName = foundSub?.name || '';
      if (next[index].teacherId) {
        const currentTeacher = teachers.find((t) => isSameTeacher(t, next[index].teacherId));
        if (currentTeacher && !teacherCanTeachSubject(currentTeacher, value, foundSub?.name)) {
          next[index].teacherId = '';
          next[index].teacherName = '';
          next[index].isAutoFilled = false;
        }
      }
    } else if (field === 'teacherId') {
      const foundTeacher = teachers.find((t) => isSameTeacher(t, value));
      next[index].teacherName = foundTeacher?.full_name || foundTeacher?.name || '';
      next[index].isAutoFilled = false;
    }

    setAssignmentRows(next);
  };

  // Auto assign teachers to unfilled rows
  const handleAutoAssign = () => {
    const unfilledCount = assignmentRows.filter((r) => !r.teacherId).length;
    if (unfilledCount === 0) {
      message.info('Tất cả buổi dạy đã được phân công giảng viên.');
      return;
    }

    // Build teacher occupancy from other assignments + current assigned rows
    const busyShift: Record<string, Record<string, Set<string>>> = {};
    const currentDecId = String(selectedDecision?.documentId || selectedDecision?.id || '');

    // Copy global occupancy from OTHER decisions
    Object.keys(globalOccupancy).forEach((d) => {
      if (!busyShift[d]) busyShift[d] = {};
      Object.keys(globalOccupancy[d]).forEach((s) => {
        if (!busyShift[d][s]) busyShift[d][s] = new Set();
        Object.keys(globalOccupancy[d][s]).forEach((tId) => {
          const occDecId = globalOccupancy[d][s][tId];
          if (occDecId && occDecId !== currentDecId) {
            busyShift[d][s].add(tId);
          }
        });
      });
    });

    // Add current form rows that have a teacher
    const allSameSlot =
      assignmentRows.length > 1 &&
      assignmentRows.every(
        (r) => r.date === assignmentRows[0].date && r.shift === assignmentRows[0].shift,
      );
    const currentRows = assignmentRows.map((r, idx) =>
      allSameSlot
        ? {
            ...r,
            date: autoStartDate.add(Math.floor(idx / 2), 'day').format('YYYY-MM-DD'),
            shift: (idx % 2 === 0 ? 'Sáng' : 'Chiều') as 'Sáng' | 'Chiều' | 'Tối',
          }
        : { ...r },
    );
    currentRows.forEach((r) => {
      if (r.teacherId && r.date && r.shift) {
        const d = r.date;
        const s = r.shift;
        const tId = String(r.teacherId);
        if (!busyShift[d]) busyShift[d] = {};
        if (!busyShift[d][s]) busyShift[d][s] = new Set();
        busyShift[d][s].add(tId);
      }
    });

    // Subject teacher cache (1 teacher = 1 subject in the same course)
    const courseTeacherSubject: Record<string, string> = {};
    currentRows.forEach((r) => {
      if (r.teacherId && r.subjectId) {
        courseTeacherSubject[String(r.teacherId)] = String(r.subjectId);
      }
    });

    let filled = 0;
    for (let i = 0; i < currentRows.length; i++) {
      const row = currentRows[i];
      if (row.teacherId) continue;

      const subId = row.subjectId;
      if (!subId && !row.subjectName) continue;

      const qualified = teachers.filter((t) => teacherCanTeachSubject(t, subId, row.subjectName));
      const available = qualified.filter((t) => {
        const tId = String(t.documentId || t.id);
        if (courseTeacherSubject[tId] && !matchSubject(courseTeacherSubject[tId], subId, row.subjectName)) {
          return false;
        }
        if (busyShift[row.date]?.[row.shift]?.has(tId)) return false;

        // Check sessions count in day (max 2)
        const dayOcc = busyShift[row.date] || {};
        let dayCount = 0;
        if (dayOcc['Sáng']?.has(tId)) dayCount++;
        if (dayOcc['Chiều']?.has(tId)) dayCount++;
        if (dayOcc['Tối']?.has(tId)) dayCount++;
        if (dayCount >= 2) return false;

        return true;
      });

      // Sort: prefer teacher already assigned to this subject
      available.sort((a, b) => {
        const aId = String(a.documentId || a.id);
        const bId = String(b.documentId || b.id);
        const aMatch =
          courseTeacherSubject[aId] && matchSubject(courseTeacherSubject[aId], subId, row.subjectName)
            ? 1
            : 0;
        const bMatch =
          courseTeacherSubject[bId] && matchSubject(courseTeacherSubject[bId], subId, row.subjectName)
            ? 1
            : 0;
        return bMatch - aMatch;
      });

      if (available.length > 0) {
        const picked = available[0];
        const tId = String(picked.documentId || picked.id);
        currentRows[i] = {
          ...row,
          teacherId: tId,
          teacherName: picked.full_name || picked.name || '',
          isAutoFilled: true,
        };
        courseTeacherSubject[tId] = subId;
        if (!busyShift[row.date]) busyShift[row.date] = {};
        if (!busyShift[row.date][row.shift]) busyShift[row.date][row.shift] = new Set();
        busyShift[row.date][row.shift].add(tId);
        filled++;
      }
    }

    setAssignmentRows(currentRows);
    const remaining = currentRows.filter((r) => !r.teacherId).length;
    if (remaining > 0) {
      message.warning(`Đã phân công tự động ${filled} buổi. Còn ${remaining} buổi chưa xếp được do trùng lịch hoặc thiếu giảng viên.`);
    } else {
      message.success(`Đã tự động phân công giảng viên cho ${filled} buổi học!`);
    }
  };

  const handleSave = async () => {
    if (!selectedDecision) return;
    setSaving(true);
    try {
      const strapiDecId = Number(selectedDecision.strapiId || selectedDecision.id);

      const payload = {
        data: {
          decision: !isNaN(strapiDecId) && strapiDecId > 0 ? strapiDecId : undefined,
          schedule: assignmentRows,
          publishedAt: new Date().toISOString(),
        },
      };

      if (existingAssignmentId) {
        await api<any>(`/${COLLECTIONS.TRAINING_ASSIGNMENTS}/${existingAssignmentId}`, {
          method: 'PUT',
          body: payload,
        });
        message.success('Đã cập nhật bảng phân công giảng dạy thành công!');
      } else {
        await api<any>(`/${COLLECTIONS.TRAINING_ASSIGNMENTS}`, {
          method: 'POST',
          body: payload,
        });
        message.success('Đã lưu bảng phân công giảng dạy mới thành công!');
      }

      setIsModalOpen(false);
      await loadInitialData();
    } catch (err: any) {
      message.error('Lỗi khi lưu phân công: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleExportAllAssignments = async () => {
    if (decisions.length === 0) {
      message.warning('Không có dữ liệu quyết định để xuất.');
      return;
    }
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Bảng Tổng Hợp Huấn Luyện');

      worksheet.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Số Quyết định', key: 'number', width: 20 },
        { header: 'Lớp Đào Tạo', key: 'className', width: 35 },
        { header: 'Khóa/Đợt', key: 'trainingCourse', width: 20 },
        { header: 'Ngày Ký QĐ', key: 'signedDate', width: 15 },
        { header: 'Số HV', key: 'studentCount', width: 10 },
        { header: 'Số Môn', key: 'subjectCount', width: 10 },
        { header: 'Trạng Thái Lập Lịch', key: 'status', width: 25 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      decisions.forEach((d, index) => {
        const decId = String(d.documentId || d.id);
        const assign = assignmentMap[decId];
        const count = assign?.schedule?.length || 0;
        const statusText = count > 0 ? `Đã lập lịch (${count} buổi)` : 'Chưa lập lịch';

        const row = worksheet.addRow({
          stt: index + 1,
          number: d.decision_number || '',
          className: d.className || '',
          trainingCourse: d.trainingCourse || '---',
          signedDate: d.signed_date ? fmtNgay(d.signed_date) : '--',
          studentCount: d.studentCount || 0,
          subjectCount: d.classSubjects?.length || 0,
          status: statusText,
        });

        row.eachCell((cell, colNumber) => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          if ([1, 2, 4, 5, 6, 7].includes(colNumber)) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const { saveAs } = await import('file-saver');
      saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `TongHop_HuanLuyen_${dayjs().format('YYYY-MM-DD')}.xlsx`,
      );
      message.success('Đã xuất Excel tổng hợp huấn luyện!');
    } catch {
      message.error('Lỗi khi xuất dữ liệu tổng hợp.');
    }
  };

  const handleExportSingleExcel = async () => {
    if (!selectedDecision) return;
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Phân công huấn luyện');

      worksheet.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Chương trình đào tạo', key: 'subjectName', width: 40 },
        { header: 'Ngày học', key: 'date', width: 15 },
        { header: 'Buổi', key: 'shift', width: 10 },
        { header: 'Giáo viên', key: 'teacherName', width: 25 },
        { header: 'Ghi chú', key: 'notes', width: 20 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      assignmentRows.forEach((row, i) => {
        const rowIndex = i + 2;
        worksheet.getCell(`A${rowIndex}`).value = i + 1;
        worksheet.getCell(`B${rowIndex}`).value = row.subjectName;
        worksheet.getCell(`C${rowIndex}`).value = fmtNgay(row.date);
        worksheet.getCell(`D${rowIndex}`).value = row.shift;
        worksheet.getCell(`E${rowIndex}`).value = row.teacherName;
        worksheet.getCell(`F${rowIndex}`).value = row.notes;

        ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col) => {
          const cell = worksheet.getCell(`${col}${rowIndex}`);
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment =
            col === 'A' || col === 'C' || col === 'D'
              ? { vertical: 'middle', horizontal: 'center' }
              : { vertical: 'middle', horizontal: 'left', wrapText: true };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const { saveAs } = await import('file-saver');
      saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `PhanCong_${(selectedDecision.className || 'Lop').replace(/[/\\?%*:|"<>]/g, '_')}_${dayjs().format('DDMMYYYY')}.xlsx`,
      );
      message.success('Đã xuất Excel lịch phân công lớp!');
    } catch {
      message.error('Có lỗi khi xuất Excel.');
    }
  };

  const handlePrintAttendance = async () => {
    if (!selectedDecision) return;
    let students: any[] = [];
    try {
      const decisionId = selectedDecision.documentId || selectedDecision.id;
      const res = await api<any>(
        `/${COLLECTIONS.CLASS_DECISIONS}?filters[documentId][$eq]=${decisionId}&populate[students][populate]=*&publicationState=preview`,
      );
      const list = normalizeStrapiList(res);
      const fd = list[0] || selectedDecision;
      const rawStudents = Array.isArray(fd.students) ? fd.students : fd.students?.data || [];
      students = rawStudents.map((s: any) => ({
        fullName: s.full_name || s.fullName || s.attributes?.full_name || '',
        studentCode: s.student_code || s.studentCode || s.attributes?.student_code || '',
        dob: s.dob || s.attributes?.dob || '',
      }));
    } catch {
      message.error('Không thể tải danh sách học viên.');
      return;
    }

    if (students.length === 0) {
      message.warning('Lớp chưa có học viên nào để điểm danh.');
      return;
    }

    students.sort((a: any, b: any) => {
      const lastA = (a.fullName || '').trim().split(/\s+/).pop() || '';
      const lastB = (b.fullName || '').trim().split(/\s+/).pop() || '';
      const cmp = lastA.localeCompare(lastB, 'vi', { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return (a.fullName || '').localeCompare(b.fullName || '', 'vi', { sensitivity: 'base' });
    });

    const subjectsMap: Record<string, DetailedAssignmentRow[]> = {};
    assignmentRows.forEach((row) => {
      const key = row.subjectName || 'Môn học';
      if (!subjectsMap[key]) subjectsMap[key] = [];
      subjectsMap[key].push(row);
    });

    const SESSIONS_PER_PAGE = 10;
    const STUDENTS_PER_PAGE = 20;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Vui lòng cho phép Pop-up trên trình duyệt để in.');
      return;
    }

    let allPagesHtml = '';
    Object.keys(subjectsMap).forEach((subjectName, subjIdx) => {
      const subjectRows = subjectsMap[subjectName];
      const sessions = subjectRows
        .map((r) => ({ date: r.date, shift: r.shift }))
        .filter((v, i, a) => a.findIndex((t) => t.date === v.date && t.shift === v.shift) === i)
        .sort((a, b) => {
          if (a.date !== b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
          const shiftOrder: Record<string, number> = { Sáng: 0, Chiều: 1, Tối: 2 };
          return (shiftOrder[a.shift] || 0) - (shiftOrder[b.shift] || 0);
        });

      if (sessions.length === 0) return;

      const sessionChunks: typeof sessions[] = [];
      for (let i = 0; i < sessions.length; i += SESSIONS_PER_PAGE) {
        sessionChunks.push(sessions.slice(i, i + SESSIONS_PER_PAGE));
      }

      const studentChunks: typeof students[] = [];
      for (let i = 0; i < students.length; i += STUDENTS_PER_PAGE) {
        studentChunks.push(students.slice(i, i + STUDENTS_PER_PAGE));
      }

      sessionChunks.forEach((sessionChunk, chunkIdx) => {
        studentChunks.forEach((studentChunk, sChunkIdx) => {
          const isFirstPage = subjIdx === 0 && chunkIdx === 0 && sChunkIdx === 0;
          const isLastStudentChunk = sChunkIdx === studentChunks.length - 1;
          const sessionDateCells = sessionChunk
            .map(() => `<th style="width:40px; font-size:10px; padding: 2px;"></th>`)
            .join('');

          const studentRows = studentChunk
            .map((s: any, idx: number) => {
              const globalIdx = sChunkIdx * STUDENTS_PER_PAGE + idx + 1;
              const attendanceCells = Array(sessionChunk.length)
                .fill(`<td style="background:#e8f5e9;"></td>`)
                .join('');
              return `
              <tr>
                <td style="text-align:center; font-size:11px;">${globalIdx}</td>
                <td colspan="2" style="text-align:left; padding-left:4px; font-size:11px; text-transform:uppercase; font-weight:bold;">${s.fullName}</td>
                ${attendanceCells}
                <td></td>
              </tr>`;
            })
            .join('');

          const signatureHtml = isLastStudentChunk
            ? `
            <tr>
              <td colspan="3" style="text-align:center; font-size:11px; font-style:italic; height:30px;">Giáo viên ký</td>
              ${Array(sessionChunk.length).fill(`<td style="background:#e8f5e9;"></td>`).join('')}
              <td></td>
            </tr>`
            : '';

          const pageFooterHtml = isLastStudentChunk
            ? `
            <div style="display:flex; justify-content:space-between; margin-top:4px; font-family:'Times New Roman',serif; page-break-before: avoid; break-before: avoid;">
              <div style="text-align:center; width:45%;">
                <p style="font-weight:bold; font-size:13px; text-transform:uppercase; margin:0;">TRUNG TÂM ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC</p>
                <p style="font-style:italic; font-size:11px; margin:4px 0 60px 0;">(Ký và ghi rõ họ tên)</p>
              </div>
              <div style="text-align:center; width:45%;">
                <p style="font-weight:bold; font-size:13px; text-transform:uppercase; margin:0;">GIÁO VIÊN BỘ MÔN</p>
                <p style="font-style:italic; font-size:11px; margin:4px 0 60px 0;">(Ký và ghi rõ họ tên)</p>
              </div>
            </div>`
            : '';

          const classCode = selectedDecision?.classCode || selectedDecision?.className || '';
          const trainingCourse =
            selectedDecision?.trainingCourse || selectedDecision?.training_course || '';
          allPagesHtml += `
          <div class="page" style="${!isFirstPage ? 'page-break-before: always;' : ''}">
            <table style="width:100%; border:none; border-collapse:collapse; margin-bottom:6px; font-family:'Times New Roman',serif;">
              <tr>
                <td style="width:50%; text-align:center; vertical-align:top; border:none !important;">
                  <p style="font-size:12px; font-weight:bold; text-transform:uppercase; margin:0;">TRƯỜNG CAO ĐẲNG HÀNG HẢI I</p>
                  <p style="font-size:11px; font-weight:bold; text-transform:uppercase; margin:0;">TT ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC</p>
                </td>
                <td style="width:50%; text-align:center; vertical-align:top; border:none !important;">
                  <p style="font-size:12px; font-weight:bold; text-transform:uppercase; margin:0;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                  <p style="font-size:11px; font-style:italic; margin:0;">Độc lập – Tự do – Hạnh phúc</p>
                  <p style="font-size:13px; font-weight:bold; text-transform:uppercase; margin:8px 0 0 0;">BẢNG THEO DÕI DANH SÁCH LỚP</p>
                </td>
              </tr>
            </table>
            <table style="width:100%; border:none; border-collapse:collapse; margin:4px 0 8px 0; font-family:'Times New Roman',serif; font-size:12px;">
              <tr>
                <td style="border:none !important; padding:2px 0; width:60%;"><b>Lớp:</b> ${classCode}</td>
                <td style="border:none !important; padding:2px 0;"><b>Khóa/Đợt đào tạo:</b> ${trainingCourse}</td>
              </tr>
              <tr>
                <td style="border:none !important; padding:2px 0; width:60%;"><b>Môn học:</b> ${subjectName}</td>
                <td style="border:none !important; padding:2px 0;">Từ ngày ................ đến ngày ................</td>
              </tr>
              <tr>
                <td colspan="2" style="border:none !important; padding:2px 0;"><b>GVBM:</b></td>
              </tr>
            </table>
            <table style="width:100%; border-collapse:collapse; font-family:'Times New Roman',serif; font-size:11px; table-layout:fixed;">
              <colgroup>
                <col style="width:32px"/>
                <col style="width:110px"/>
                <col style="width:58px"/>
                ${Array(sessionChunk.length).fill('<col style="width:38px"/>').join('')}
                <col style="width:52px"/>
              </colgroup>
              <thead>
                <tr>
                  <th rowspan="3" style="border:1px solid black; text-align:center; vertical-align:middle; font-size:11px;">STT</th>
                  <th colspan="2" style="border:1px solid black; text-align:center; font-size:11px;">NGÀY THÁNG</th>
                  <th colspan="${sessionChunk.length}" style="border:1px solid black; text-align:center; font-size:11px;">ĐIỂM DANH HÀNG NGÀY</th>
                  <th rowspan="3" style="border:1px solid black; text-align:center; vertical-align:middle; font-size:11px;">Ghi chú</th>
                </tr>
                <tr>
                  <th rowspan="2" style="border:1px solid black; text-align:left; padding-left:4px; font-size:11px; vertical-align:middle;">HỌ VÀ TÊN</th>
                  <th style="border:1px solid black; text-align:center; font-size:11px; vertical-align:middle;">NGÀY/BUỔI</th>
                  ${sessionDateCells}
                </tr>
                <tr>
                  <td style="border:1px solid black; text-align:center; font-size:12px; font-weight:bold; height:24px;">SỐ TIẾT</td>
                  ${Array(sessionChunk.length).fill(`<td style="border:1px solid black; background:#fff9c4;"></td>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${studentRows}
                ${signatureHtml}
              </tbody>
            </table>
            ${pageFooterHtml}
          </div>`;
        });
      });
    });

    const html = `
      <html>
      <head>
        <title>Điểm danh - ${selectedDecision.className || ''}</title>
        <style>
          * { box-sizing: border-box; }
          @page { size: A4 landscape; margin: 0; }
          body { font-family: 'Times New Roman', serif; margin: 0; padding: 0; font-size: 12px; }
          .page { padding: 10mm 12mm 10mm 12mm; }
          table { border-collapse: collapse; }
          th, td { border: 1px solid black; padding: 3px 4px; vertical-align: middle; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { width: 100%; }
          }
        </style>
      </head>
      <body>
        ${allPagesHtml}
        <script>window.print();</script>
      </body>
      </html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const columns = [
    {
      title: 'STT',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Số Quyết định',
      dataIndex: 'decision_number',
      key: 'decision_number',
      render: (text: string) => <Text strong style={{ color: '#1677ff' }}>{text || '---'}</Text>,
    },
    {
      title: 'Lớp đào tạo',
      dataIndex: 'className',
      key: 'className',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{text}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Mã: {record.classCode || '---'} | Khóa: {record.trainingCourse}
          </Text>
        </div>
      ),
    },
    {
      title: 'Ngày ký QĐ',
      dataIndex: 'signed_date',
      key: 'signed_date',
      width: 120,
      render: (val: string) => fmtNgay(val),
    },
    {
      title: 'Sĩ số',
      dataIndex: 'studentCount',
      key: 'studentCount',
      width: 90,
      align: 'center' as const,
      render: (c: number) => <Tag color="blue">{c || 0} HV</Tag>,
    },
    {
      title: 'Số môn học',
      width: 110,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Tag color="cyan">{(record.classSubjects || []).length} môn</Tag>
      ),
    },
    {
      title: 'Trạng thái lập lịch',
      key: 'status',
      width: 180,
      render: (_: any, record: any) => {
        const decId = String(record.documentId || record.id);
        const assign = assignmentMap[decId];
        const schedule = assign?.schedule || [];
        if (schedule.length > 0) {
          return (
            <Tag icon={<CheckCircleOutlined />} color="success">
              Đã lập lịch ({schedule.length} buổi)
            </Tag>
          );
        }
        return (
          <Tag icon={<ClockCircleOutlined />} color="warning">
            Chưa lập lịch
          </Tag>
        );
      },
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 220,
      render: (_: any, record: any) => {
        const decId = String(record.documentId || record.id);
        const assign = assignmentMap[decId];
        const hasSchedule = assign?.schedule?.length > 0;
        return (
          <Space>
            <Button
              type={hasSchedule ? 'default' : 'primary'}
              size="small"
              icon={<EditOutlined />}
              onClick={() => openAssignmentModal(record)}
            >
              {hasSchedule ? 'Sửa lịch' : 'Lập lịch'}
            </Button>
            {hasSchedule && (
              <Button
                size="small"
                icon={<PrinterOutlined />}
                onClick={() => {
                  setSelectedDecision(record);
                  setAssignmentRows(assign.schedule || []);
                  setIsPrintModalOpen(true);
                }}
              >
                In lịch
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const classFilterOptions = Array.from(
    new Map(
      decisions
        .filter((d) => d.classId || d.className)
        .map((d) => {
          const key = String(d.classId || d.className);
          return [
            key,
            {
              value: key,
              label: `${d.classCode ? `[${d.classCode}] ` : ''}${d.className}`,
            },
          ];
        }),
    ).values(),
  );

  const filteredDecisions = decisions.filter((d) => {
    const matchClass = !selectedClassFilter || String(d.classId || d.className) === String(selectedClassFilter);
    const kw = searchDecisionText.trim().toLowerCase();
    const matchText =
      !kw ||
      (d.decision_number || '').toLowerCase().includes(kw) ||
      (d.className || '').toLowerCase().includes(kw) ||
      (d.classCode || '').toLowerCase().includes(kw) ||
      (d.trainingCourse || '').toLowerCase().includes(kw);
    return matchClass && matchText;
  });

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space align="center" size="middle">
              <CalendarOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Phân công Giảng dạy
                </Title>
                <Text type="secondary">
                  Lập lịch đào tạo, phân bổ giảng viên và kiểm tra trùng lịch tự động
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <Select
                placeholder="Lọc theo lớp học"
                allowClear
                showSearch
                optionFilterProp="label"
                popupMatchSelectWidth={false}
                style={{ width: 320, maxWidth: '100%' }}
                value={selectedClassFilter}
                onChange={(v) => setSelectedClassFilter(v)}
                options={classFilterOptions}
              />
              <Input
                placeholder="Tìm quyết định, mã lớp, tên lớp..."
                prefix={<SearchOutlined />}
                style={{ width: 240 }}
                value={searchDecisionText}
                onChange={(e) => setSearchDecisionText(e.target.value)}
                allowClear
              />
              <Button
                type="primary"
                style={{ background: '#059669', borderColor: '#059669' }}
                icon={<FileExcelOutlined />}
                onClick={handleExportAllAssignments}
              >
                Xuất Excel tổng hợp
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadInitialData}>
                Làm mới
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        {loading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : filteredDecisions.length === 0 ? (
          <Empty description="Không có lớp học hoặc quyết định mở lớp nào cần phân công." />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredDecisions}
            rowKey={(r) => r.documentId || r.id}
            pagination={{ pageSize: 10, showTotal: (t) => `Tổng số ${t} lớp` }}
          />
        )}
      </Card>

      {/* Modal Lập lịch giảng dạy */}
      <Modal
        title={
          <Space>
            <CalendarOutlined style={{ color: '#1677ff' }} />
            <span>
              Bảng phân công huấn luyện:{' '}
              <span style={{ color: '#1677ff' }}>
                {selectedDecision?.className}
                {selectedDecision?.trainingCourse ? ` - Khóa/Đợt: ${selectedDecision.trainingCourse}` : ''}{' '}
                (QĐ: {selectedDecision?.decision_number})
              </span>
            </span>
          </Space>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        width={1120}
        footer={[
          <Button key="back" onClick={() => setIsModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<FileDoneOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            Lưu bảng
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
          <Row justify="space-between" align="middle" gutter={[12, 12]}>
            <Col>
              <Space wrap>
                <Text strong>Từ ngày:</Text>
                <DatePicker
                  value={autoStartDate}
                  onChange={handleStartDateChange}
                  format="DD/MM/YYYY"
                  allowClear={false}
                />
                <Button
                  icon={<RobotOutlined />}
                  type="primary"
                  style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                  onClick={handleAutoAssign}
                >
                  Tự động sắp xếp
                </Button>
                <Button icon={<PlusOutlined />} type="primary" ghost onClick={handleAddRow}>
                  + Thêm buổi
                </Button>
                <Popconfirm
                  title="Tải lại từ chương trình đào tạo?"
                  description="Các buổi dạy hiện tại sẽ được khởi tạo lại theo số tiết môn học."
                  onConfirm={handleResetFromSubjects}
                  okText="Đồng ý"
                  cancelText="Hủy"
                >
                  <Button icon={<ReloadOutlined />} style={{ color: '#d97706', borderColor: '#d97706' }}>
                    Tải lại CTĐT
                  </Button>
                </Popconfirm>
              </Space>
            </Col>
            <Col>
              <Space wrap>
                <Button
                  icon={<FileExcelOutlined />}
                  style={{ background: '#059669', borderColor: '#059669', color: '#fff' }}
                  onClick={handleExportSingleExcel}
                >
                  Excel
                </Button>
                <Button
                  icon={<TeamOutlined />}
                  style={{ background: '#0d9488', borderColor: '#0d9488', color: '#fff' }}
                  onClick={handlePrintAttendance}
                >
                  Điểm danh
                </Button>
                <Button
                  icon={<PrinterOutlined />}
                  onClick={() => setIsPrintModalOpen(true)}
                >
                  In
                </Button>
                <Button
                  type="primary"
                  icon={<FileDoneOutlined />}
                  loading={saving}
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                  onClick={handleSave}
                >
                  Lưu bảng
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        <Table
          dataSource={assignmentRows}
          rowKey={(_, idx) => String(idx)}
          pagination={false}
          size="small"
          scroll={{ y: 440 }}
          columns={[
            {
              title: 'STT',
              width: 50,
              align: 'center',
              render: (_, __, idx) => idx + 1,
            },
            {
              title: 'Môn học',
              width: 220,
              render: (_, record, idx) => (
                <Select
                  style={{ width: '100%' }}
                  value={record.subjectId || undefined}
                  placeholder="Chọn môn học"
                  showSearch
                  optionFilterProp="children"
                  onChange={(val) => handleFieldChange(idx, 'subjectId', val)}
                >
                  {(selectedDecision?.classSubjects?.length > 0
                    ? selectedDecision.classSubjects
                    : subjects
                  ).map((s: any) => (
                    <Select.Option key={s.documentId || s.id} value={String(s.documentId || s.id)}>
                      {s.name} ({s.code})
                    </Select.Option>
                  ))}
                </Select>
              ),
            },
            {
              title: 'Ngày dạy',
              width: 140,
              render: (_, record, idx) => (
                <DatePicker
                  style={{ width: '100%' }}
                  value={record.date ? dayjs(record.date) : null}
                  onChange={(d) => handleFieldChange(idx, 'date', d ? d.format('YYYY-MM-DD') : '')}
                  format="DD/MM/YYYY"
                  allowClear={false}
                />
              ),
            },
            {
              title: 'Ca dạy',
              width: 110,
              render: (_, record, idx) => (
                <Select
                  style={{ width: '100%' }}
                  value={record.shift}
                  onChange={(val) => handleFieldChange(idx, 'shift', val)}
                >
                  <Select.Option value="Sáng">Sáng</Select.Option>
                  <Select.Option value="Chiều">Chiều</Select.Option>
                  <Select.Option value="Tối">Tối</Select.Option>
                </Select>
              ),
            },
            {
              title: 'Giảng viên phụ trách',
              width: 240,
              render: (_, record, idx) => {
                // Chỉ lọc những giảng viên có chuyên môn dạy môn học này (hoặc đang được gán sẵn ở dòng này)
                const qualifiedTeachers = teachers.filter(
                  (t) =>
                    teacherCanTeachSubject(t, record.subjectId, record.subjectName) ||
                    isSameTeacher(t, record.teacherId),
                );

                const options = qualifiedTeachers
                  .map((t) => {
                    const tId = String(t.documentId || t.id);
                    const isCurrentSelected = isSameTeacher(t, record.teacherId);
                    const isBusyOtherClass = isTeacherBusyOtherDecision(
                      record.date,
                      record.shift,
                      tId,
                    );
                    const isBusySameSlot = assignmentRows.some(
                      (r, rIdx) =>
                        rIdx !== idx &&
                        r.date === record.date &&
                        r.shift === record.shift &&
                        isSameTeacher(t, r.teacherId),
                    );
                    const teachingOtherSubInCourse = assignmentRows.some(
                      (r, rIdx) =>
                        rIdx !== idx &&
                        isSameTeacher(t, r.teacherId) &&
                        r.subjectId &&
                        record.subjectId &&
                        !matchSubject(r.subjectId, record.subjectId, record.subjectName),
                    );

                    // Đếm số ca dạy trong ngày của giảng viên
                    const busyShiftsInDay = new Set<string>();
                    ['Sáng', 'Chiều', 'Tối'].forEach((sh) => {
                      if (isTeacherBusyOtherDecision(record.date, sh, tId)) {
                        busyShiftsInDay.add(sh);
                      }
                    });
                    assignmentRows.forEach((r, rIdx) => {
                      if (rIdx !== idx && r.date === record.date && isSameTeacher(t, r.teacherId)) {
                        busyShiftsInDay.add(r.shift);
                      }
                    });
                    const tooManyShifts =
                      !busyShiftsInDay.has(record.shift) && busyShiftsInDay.size >= 2;

                    const disabled =
                      !isCurrentSelected &&
                      (isBusyOtherClass ||
                        isBusySameSlot ||
                        teachingOtherSubInCourse ||
                        tooManyShifts);

                    let reason = '';
                    if (isBusyOtherClass) reason = ' (Bận lớp khác ca này)';
                    else if (isBusySameSlot) reason = ' (Trùng ca trong lớp)';
                    else if (teachingOtherSubInCourse) reason = ' (Đã dạy môn khác của lớp)';
                    else if (tooManyShifts) reason = ' (Đã đủ 2 ca/ngày)';

                    return {
                      value: tId,
                      label: `${t.full_name || t.name}${reason}`,
                      disabled,
                    };
                  })
                  .sort((a, b) => Number(a.disabled) - Number(b.disabled));

                return (
                  <Select
                    style={{ width: '100%' }}
                    value={record.teacherId || undefined}
                    placeholder="Chọn giảng viên đúng chuyên môn"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    popupMatchSelectWidth={false}
                    notFoundContent="Chưa có GV phân công chuyên môn môn này"
                    options={options}
                    onChange={(val) => handleFieldChange(idx, 'teacherId', val || '')}
                  />
                );
              },
            },
            {
              title: 'Ghi chú',
              render: (_, record, idx) => (
                <Input
                  value={record.notes}
                  placeholder="Ghi chú buổi dạy..."
                  onChange={(e) => handleFieldChange(idx, 'notes', e.target.value)}
                />
              ),
            },
            {
              title: '',
              width: 50,
              align: 'center',
              render: (_, __, idx) => (
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleRemoveRow(idx)}
                />
              ),
            },
          ]}
        />
      </Modal>

      {/* Modal In lịch giảng dạy */}
      <Modal
        title="Lịch giảng dạy & Huấn luyện"
        open={isPrintModalOpen}
        onCancel={() => setIsPrintModalOpen(false)}
        width={850}
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
            In ra giấy
          </Button>,
        ]}
      >
        <div id="print-area" style={{ padding: '16px', fontFamily: '"Times New Roman", serif', fontSize: '13pt', lineHeight: 1.6 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h3 style={{ textTransform: 'uppercase', margin: 0, fontSize: '14pt', fontWeight: 'bold' }}>
              LỊCH PHÂN CÔNG GIẢNG DẠY
            </h3>
            <p style={{ margin: '4px 0', fontWeight: 'bold' }}>
              Lớp: {selectedDecision?.className} - Khóa: {selectedDecision?.trainingCourse}
            </p>
            <p style={{ margin: 0, fontStyle: 'italic', fontSize: '11pt' }}>
              Theo Quyết định số: {selectedDecision?.decision_number} ký ngày{' '}
              {fmtNgay(selectedDecision?.signed_date)}
            </p>
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '11pt',
              marginBottom: 24,
            }}
            border={1}
          >
            <thead>
              <tr style={{ background: '#fafafa', textAlign: 'center' }}>
                <th style={{ padding: '6px', width: 40 }}>STT</th>
                <th style={{ padding: '6px', width: 100 }}>Ngày học</th>
                <th style={{ padding: '6px', width: 70 }}>Ca học</th>
                <th style={{ padding: '6px' }}>Môn học</th>
                <th style={{ padding: '6px', width: 160 }}>Giảng viên</th>
                <th style={{ padding: '6px', width: 120 }}>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {assignmentRows.map((r, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{fmtNgay(r.date)}</td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{r.shift}</td>
                  <td style={{ padding: '6px' }}>{r.subjectName}</td>
                  <td style={{ padding: '6px', fontWeight: 'bold' }}>{r.teacherName || '---'}</td>
                  <td style={{ padding: '6px' }}>{r.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Row justify="space-between" style={{ marginTop: 32 }}>
            <Col span={10} style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 'bold', margin: 0 }}>NGƯỜI LẬP BIỂU</p>
              <div style={{ height: 60 }} />
              <p style={{ fontStyle: 'italic' }}>(Ký và ghi rõ họ tên)</p>
            </Col>
            <Col span={10} style={{ textAlign: 'center' }}>
              <p style={{ fontStyle: 'italic', margin: 0 }}>
                Hải Phòng, ngày {dayjs().format('DD')} tháng {dayjs().format('MM')} năm {dayjs().format('YYYY')}
              </p>
              <p style={{ fontWeight: 'bold', margin: '4px 0' }}>PHÒNG ĐÀO TẠO</p>
              <div style={{ height: 60 }} />
              <p style={{ fontStyle: 'italic' }}>(Ký và đóng dấu)</p>
            </Col>
          </Row>
        </div>
      </Modal>
    </div>
  );
}

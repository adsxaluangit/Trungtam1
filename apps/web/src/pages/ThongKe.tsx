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
  CalendarOutlined,
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
  strapiId?: number;
  number: string;
  className: string;
  classCode: string;
  trainingCourse: string;
  signedDate: string;
  startDate: string;
  studentCount: number;
  openingStudentCount: number;
  recognitionId?: string;
  recognitionNumber?: string;
  recognitionDate?: string;
  recognitionStudentCount?: number;
  status: 'Ongoing' | 'Completed';
  month: number;
  year: number;
  quarter: number;
  classId?: string;
  students: any[];
  recognitionStudents: any[];
}

type DateFilterMode = 'any' | 'recognition' | 'opening';

export default function ThongKe() {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<StatDecision[]>([]);
  const [uniqueClasses, setUniqueClasses] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(6, 'month'),
    dayjs(),
  ]);
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('any');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api<any>(
        `/${COLLECTIONS.CLASS_DECISIONS}?populate[school_class]=true&populate[related_decision]=true&populate[students][fields][0]=full_name&populate[students][fields][1]=dob&populate[students][fields][2]=gender&populate[students][fields][3]=id_number&populate[students][fields][4]=student_code&populate[students][fields][5]=pob&populate[students][fields][6]=phone&populate[students][fields][7]=address&populate[students][fields][8]=ethnicity&populate[students][fields][9]=nationality&populate[students][fields][10]=company&populate[students][fields][11]=notes&populate[students][fields][12]=card_number&sort=signed_date:desc&publicationState=preview&pagination[pageSize]=1000`,
      );
      const allDecs = normalizeStrapiList(res);

      // Map Recognition decisions by their linked Opening decision ID (both documentId and strapiId)
      const recognitionDecisions = allDecs.filter((d: any) => d.type === 'RECOGNITION');
      const recByOpeningId = new Map<string, any>();
      const matchedRecIds = new Set<string>();

      recognitionDecisions.forEach((rec: any) => {
        const rel = rec.related_decision?.data || rec.related_decision;
        const relDocId = String(rel?.documentId || '');
        const relNumId = String(rel?.strapiId || rel?.id || '');
        if (relDocId) recByOpeningId.set(relDocId, rec);
        if (relNumId) recByOpeningId.set(relNumId, rec);
      });

      const openingDecs = allDecs.filter((d: any) => d.type === 'OPENING');
      const classesMap = new Map<string, string>();

      const processed: StatDecision[] = openingDecs.map((d: any) => {
        const docId = String(d.documentId || d.id);
        const numId = String(d.strapiId || d.id || '');
        const linkedRec = recByOpeningId.get(docId) || recByOpeningId.get(numId);
        if (linkedRec) {
          matchedRecIds.add(String(linkedRec.documentId || linkedRec.id));
        }

        const date = dayjs(d.signed_date || d.createdAt);
        const cls = d.school_class?.data || d.school_class || {};
        const clsId = String(cls.documentId || cls.id || '');
        const clsName = cls.name || 'Lớp chưa đặt tên';
        const clsCode = cls.code || '';

        if (clsId) {
          classesMap.set(clsId, `${clsCode ? `[${clsCode}] ` : ''}${clsName}`);
        }

        const openStudents = Array.isArray(d.students)
          ? d.students
          : d.students?.data || [];
        const openCount = d.students?.count ?? openStudents.length;

        const recStudents = linkedRec
          ? Array.isArray(linkedRec.students)
            ? linkedRec.students
            : linkedRec.students?.data || []
          : [];
        const recCount = linkedRec
          ? (linkedRec.students?.count ?? recStudents.length)
          : undefined;

        const isCompleted = Boolean(linkedRec);
        const effectiveCount =
          isCompleted && recCount && recCount > 0 ? recCount : openCount;

        return {
          id: docId,
          strapiId: Number(d.strapiId || d.id),
          number: d.decision_number || '---',
          className: clsName,
          classCode: clsCode,
          trainingCourse: d.training_course || linkedRec?.training_course || '---',
          signedDate: d.signed_date || date.format('YYYY-MM-DD'),
          startDate: d.start_date || d.signed_date || date.format('YYYY-MM-DD'),
          studentCount: effectiveCount,
          openingStudentCount: openCount,
          recognitionId: linkedRec ? String(linkedRec.documentId || linkedRec.id) : undefined,
          recognitionNumber: linkedRec?.decision_number || undefined,
          recognitionDate: linkedRec?.signed_date || undefined,
          recognitionStudentCount: recCount,
          status: isCompleted ? 'Completed' : 'Ongoing',
          month: date.month() + 1,
          year: date.year(),
          quarter: Math.ceil((date.month() + 1) / 3),
          classId: clsId,
          students: openStudents,
          recognitionStudents: recStudents,
        };
      });

      // Nếu có QĐ Công nhận độc lập chưa gắn related_decision thì vẫn đưa vào thống kê để không sót
      recognitionDecisions.forEach((rec: any) => {
        const recId = String(rec.documentId || rec.id);
        if (matchedRecIds.has(recId)) return;

        const date = dayjs(rec.signed_date || rec.createdAt);
        const cls = rec.school_class?.data || rec.school_class || {};
        const clsId = String(cls.documentId || cls.id || '');
        const clsName = cls.name || 'Lớp chưa đặt tên';
        const clsCode = cls.code || '';
        if (clsId) {
          classesMap.set(clsId, `${clsCode ? `[${clsCode}] ` : ''}${clsName}`);
        }
        const recStudents = Array.isArray(rec.students)
          ? rec.students
          : rec.students?.data || [];
        const recCount = rec.students?.count ?? recStudents.length;

        processed.push({
          id: recId,
          strapiId: Number(rec.strapiId || rec.id),
          number: '---',
          className: clsName,
          classCode: clsCode,
          trainingCourse: rec.training_course || '---',
          signedDate: rec.signed_date || date.format('YYYY-MM-DD'),
          startDate: rec.signed_date || date.format('YYYY-MM-DD'),
          studentCount: recCount,
          openingStudentCount: recCount,
          recognitionId: recId,
          recognitionNumber: rec.decision_number || '---',
          recognitionDate: rec.signed_date || date.format('YYYY-MM-DD'),
          recognitionStudentCount: recCount,
          status: 'Completed',
          month: date.month() + 1,
          year: date.year(),
          quarter: Math.ceil((date.month() + 1) / 3),
          classId: clsId,
          students: recStudents,
          recognitionStudents: recStudents,
        });
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

  const isDateInSelectedRange = (dateStr?: string) => {
    if (!dateStr) return false;
    if (!dateRange || !dateRange[0] || !dateRange[1]) return true;
    const d = dayjs(dateStr);
    if (!d.isValid()) return false;
    return !d.isBefore(dateRange[0], 'day') && !d.isAfter(dateRange[1], 'day');
  };

  // Filter logic
  const filteredData = useMemo(() => {
    return data
      .filter((item) => {
        // Class filter
        if (selectedClass !== 'all' && item.classId !== selectedClass) {
          return false;
        }

        // Status filter
        if (selectedStatus !== 'all' && item.status !== selectedStatus) {
          return false;
        }

        // Date filter
        if (dateRange && dateRange[0] && dateRange[1]) {
          const openInRange = isDateInSelectedRange(item.signedDate);
          const recInRange = isDateInSelectedRange(item.recognitionDate);

          if (dateFilterMode === 'opening') {
            if (!openInRange) return false;
          } else if (dateFilterMode === 'recognition') {
            if (!recInRange) return false;
          } else {
            // 'any': Mở lớp HOẶC Công nhận nằm trong khoảng thời gian
            if (selectedStatus === 'Completed') {
              if (!recInRange && !openInRange) return false;
            } else if (selectedStatus === 'Ongoing') {
              if (!openInRange) return false;
            } else {
              if (!openInRange && !recInRange) return false;
            }
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA =
          dateFilterMode === 'recognition'
            ? a.recognitionDate || a.signedDate
            : a.recognitionDate && isDateInSelectedRange(a.recognitionDate)
              ? a.recognitionDate
              : a.signedDate;
        const dateB =
          dateFilterMode === 'recognition'
            ? b.recognitionDate || b.signedDate
            : b.recognitionDate && isDateInSelectedRange(b.recognitionDate)
              ? b.recognitionDate
              : b.signedDate;
        return dayjs(dateB).valueOf() - dayjs(dateA).valueOf();
      });
  }, [data, dateRange, dateFilterMode, selectedClass, selectedStatus]);

  // Calculate aggregates
  const totalClasses = filteredData.length;
  const totalStudents = filteredData.reduce((acc, d) => acc + d.studentCount, 0);
  const completedList = filteredData.filter((d) => d.status === 'Completed');
  const completedClasses = completedList.length;
  const completedStudents = completedList.reduce(
    (acc, d) => acc + (d.recognitionStudentCount ?? d.studentCount),
    0,
  );
  const ongoingClasses = totalClasses - completedClasses;
  const ongoingStudents = filteredData
    .filter((d) => d.status === 'Ongoing')
    .reduce((acc, d) => acc + d.studentCount, 0);

  // Số lớp Mở mới trong đúng khoảng thời gian & Số lớp Công nhận trong đúng khoảng thời gian
  const openedInPeriodCount = filteredData.filter((d) =>
    isDateInSelectedRange(d.signedDate),
  ).length;
  const recognizedInPeriodCount = filteredData.filter(
    (d) => d.status === 'Completed' && isDateInSelectedRange(d.recognitionDate),
  ).length;

  const completionRate =
    totalClasses > 0 ? Math.round((completedClasses / totalClasses) * 100) : 0;

  // Data cho BarChart - nhóm học viên & lớp theo tháng trong kỳ
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; 'Mở lớp (HV)': number; 'Tốt nghiệp (HV)': number; sortKey: number }> = {};
    filteredData.forEach((d) => {
      const refDate =
        dateFilterMode === 'recognition' && d.recognitionDate
          ? d.recognitionDate
          : d.signedDate;
      const dj = dayjs(refDate);
      if (!dj.isValid()) return;
      const key = dj.format('MM/YYYY');
      if (!map[key]) {
        map[key] = {
          month: key,
          'Mở lớp (HV)': 0,
          'Tốt nghiệp (HV)': 0,
          sortKey: dj.startOf('month').valueOf(),
        };
      }
      map[key]['Mở lớp (HV)'] += d.openingStudentCount || d.studentCount || 0;
      if (d.status === 'Completed') {
        map[key]['Tốt nghiệp (HV)'] += d.recognitionStudentCount ?? d.studentCount ?? 0;
      }
    });
    return Object.values(map)
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(-12);
  }, [filteredData, dateFilterMode]);

  // Data cho PieChart - phân bổ theo trạng thái
  const statusData = useMemo(
    () => [
      { name: 'Đang đào tạo', value: ongoingClasses },
      { name: 'Đã tốt nghiệp', value: completedClasses },
    ],
    [ongoingClasses, completedClasses],
  );
  const COLORS = ['#fa8c16', '#52c41a'];

  // Breakdown by class
  const classBreakdown = useMemo(() => {
    return uniqueClasses
      .map((cls) => {
        const list = filteredData.filter((d) => d.classId === cls.id);
        const count = list.reduce((acc, d) => acc + d.studentCount, 0);
        const compCount = list.filter((d) => d.status === 'Completed').length;
        return {
          className: cls.name,
          classCount: list.length,
          completedCount: compCount,
          studentCount: count,
        };
      })
      .filter((c) => c.classCount > 0)
      .sort((a, b) => b.studentCount - a.studentCount);
  }, [uniqueClasses, filteredData]);

  // ─── 1. Xuất Excel Báo cáo Thống kê lớp học ───────────────────────────────
  const handleExportExcel = async () => {
    if (filteredData.length === 0) {
      message.warning('Không có dữ liệu trong khoảng thời gian đã chọn để xuất.');
      return;
    }

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();

    // Sheet 1: Tổng hợp các lớp
    const ws1 = wb.addWorksheet('Tổng hợp Lớp');
    ws1.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Tên lớp đào tạo', key: 'className', width: 32 },
      { header: 'Khóa / Đợt', key: 'trainingCourse', width: 18 },
      { header: 'Số QĐ Mở lớp', key: 'openNumber', width: 20 },
      { header: 'Ngày ký QĐ Mở lớp', key: 'openDate', width: 16 },
      { header: 'Sĩ số Mở lớp', key: 'openCount', width: 13 },
      { header: 'Số QĐ Công nhận', key: 'recNumber', width: 20 },
      { header: 'Ngày ký QĐ Công nhận', key: 'recDate', width: 18 },
      { header: 'Sĩ số Tốt nghiệp', key: 'recCount', width: 15 },
      { header: 'Trạng thái', key: 'status', width: 18 },
    ];

    const hdr1 = ws1.getRow(1);
    hdr1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
    hdr1.alignment = { horizontal: 'center', vertical: 'middle' };

    filteredData.forEach((d, idx) => {
      const row = ws1.addRow({
        stt: idx + 1,
        className: d.className,
        trainingCourse: d.trainingCourse,
        openNumber: d.number,
        openDate: fmtNgay(d.signedDate),
        openCount: d.openingStudentCount,
        recNumber: d.recognitionNumber || '---',
        recDate: d.recognitionDate ? fmtNgay(d.recognitionDate) : '---',
        recCount: d.status === 'Completed' ? (d.recognitionStudentCount ?? d.studentCount) : 0,
        status: d.status === 'Completed' ? 'Đã tốt nghiệp' : 'Đang đào tạo',
      });
      if (idx % 2 === 1) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }
    });

    ws1.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Sheet 2: Chi tiết theo chương trình
    const ws2 = wb.addWorksheet('Theo Chương Trình');
    ws2.columns = [
      { header: 'Chương trình / Lớp đào tạo', key: 'className', width: 35 },
      { header: 'Tổng số khóa/lớp', key: 'classCount', width: 16 },
      { header: 'Số lớp đã tốt nghiệp', key: 'completedCount', width: 18 },
      { header: 'Tổng học viên', key: 'studentCount', width: 16 },
      { header: 'Tỷ lệ HV (%)', key: 'pct', width: 14 },
    ];

    const hdr2 = ws2.getRow(1);
    hdr2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF52C41A' } };
    hdr2.alignment = { horizontal: 'center', vertical: 'middle' };

    classBreakdown.forEach((cb, idx) => {
      const pct = totalStudents > 0 ? Math.round((cb.studentCount / totalStudents) * 100) : 0;
      const row = ws2.addRow({
        className: cb.className,
        classCount: cb.classCount,
        completedCount: cb.completedCount,
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
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([buf]), `Bao_Cao_Thong_Ke_${dayjs().format('DDMMYYYY')}.xlsx`);
    message.success('Đã xuất file báo cáo thống kê Excel thành công!');
  };

  // ─── 2. Xuất Tổng hợp lịch giảng dạy của các lớp trong bộ lọc ─────────────
  const handleExportTeachingSummary = async () => {
    if (filteredData.length === 0) {
      message.warning('Không có lớp học nào trong bộ lọc hiện tại.');
      return;
    }
    setExporting(true);
    try {
      const res = await api<any>(
        `/${COLLECTIONS.TRAINING_ASSIGNMENTS}?populate[decision][populate][school_class]=true&publicationState=preview&pagination[pageSize]=1000`,
      );
      const assignments = normalizeStrapiList(res);
      const filteredDecisionIds = new Set(
        filteredData.flatMap((d) => [String(d.id), d.strapiId ? String(d.strapiId) : '']),
      );

      const relevant = assignments.filter((a: any) => {
        const dec = a.decision?.data || a.decision;
        if (!dec) return false;
        return (
          filteredDecisionIds.has(String(dec.documentId || '')) ||
          filteredDecisionIds.has(String(dec.id || ''))
        );
      });

      if (relevant.length === 0) {
        message.warning('Chưa có lịch phân công giảng dạy cho các lớp trong bộ lọc hiện tại.');
        return;
      }

      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Tổng hợp Giảng dạy');
      ws.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Lớp đào tạo', key: 'className', width: 30 },
        { header: 'Khóa / Đợt', key: 'course', width: 16 },
        { header: 'Số QĐ Mở lớp', key: 'decNum', width: 18 },
        { header: 'Môn học', key: 'subjectName', width: 32 },
        { header: 'Giảng viên', key: 'teacherName', width: 25 },
        { header: 'Ngày học', key: 'date', width: 14 },
        { header: 'Buổi', key: 'shift', width: 10 },
        { header: 'Ghi chú', key: 'notes', width: 22 },
      ];

      const hdr = ws.getRow(1);
      hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
      hdr.alignment = { horizontal: 'center', vertical: 'middle' };

      let stt = 1;
      relevant.forEach((a: any) => {
        const dec = a.decision?.data || a.decision || {};
        const cls = dec.school_class?.data || dec.school_class || {};
        const className = cls.name || '---';
        const course = dec.training_course || '---';
        const decNum = dec.decision_number || '---';
        const schedule = Array.isArray(a.schedule) ? a.schedule : [];

        schedule.forEach((r: any) => {
          ws.addRow({
            stt: stt++,
            className,
            course,
            decNum,
            subjectName: r.subjectName || '---',
            teacherName: r.teacherName || 'Chưa phân công',
            date: r.date ? fmtNgay(r.date) : '---',
            shift: r.shift || '---',
            notes: r.notes || '',
          });
        });
      });

      if (stt === 1) {
        message.warning('Các lớp trong kỳ chưa có chi tiết buổi học.');
        return;
      }

      ws.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      const { saveAs } = await import('file-saver');
      saveAs(new Blob([buf]), `TongHopGiangDay_${dayjs().format('YYYY-MM-DD')}.xlsx`);
      message.success('Đã xuất file Tổng hợp giảng dạy thành công!');
    } catch (err: any) {
      message.error('Lỗi khi xuất tổng hợp giảng dạy: ' + (err.message || ''));
    } finally {
      setExporting(false);
    }
  };

  // ─── 3. Xuất Danh sách Học viên (Tốt nghiệp HOẶC Toàn bộ có Quyết định) ──
  const handleExportStudentsList = async (onlyGraduated: boolean) => {
    const targetDecisions = onlyGraduated
      ? filteredData.filter((d) => d.status === 'Completed')
      : filteredData;

    if (targetDecisions.length === 0) {
      message.warning(
        onlyGraduated
          ? 'Không có lớp nào đã tốt nghiệp trong bộ lọc hiện tại.'
          : 'Không có lớp nào trong bộ lọc hiện tại.',
      );
      return;
    }

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(onlyGraduated ? 'HV Tốt nghiệp' : 'HV Có Quyết định');

    ws.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Mã học viên', key: 'studentCode', width: 16 },
      { header: 'Họ và Tên', key: 'fullName', width: 26 },
      { header: 'Giới tính', key: 'gender', width: 10 },
      { header: 'Ngày sinh', key: 'dob', width: 13 },
      { header: 'Nơi sinh', key: 'pob', width: 20 },
      { header: 'Dân tộc', key: 'ethnicity', width: 10 },
      { header: 'Quốc tịch', key: 'nationality', width: 12 },
      { header: 'Số CCCD/CMND', key: 'cccd', width: 16 },
      { header: 'Số điện thoại', key: 'phone', width: 14 },
      { header: 'Địa chỉ thường trú', key: 'address', width: 30 },
      { header: 'Đơn vị công tác', key: 'company', width: 24 },
      { header: 'Lớp học', key: 'className', width: 28 },
      { header: 'Đợt/Khóa', key: 'trainingCourse', width: 16 },
      { header: 'Số QĐ Mở lớp', key: 'openNum', width: 16 },
      { header: 'Ngày ký QĐ Mở', key: 'openDate', width: 14 },
      { header: 'Số QĐ Công nhận', key: 'recNum', width: 16 },
      { header: 'Ngày ký QĐ CN', key: 'recDate', width: 14 },
      { header: 'Trạng thái', key: 'status', width: 16 },
      { header: 'Ghi chú', key: 'notes', width: 20 },
    ];

    const hdr = ws.getRow(1);
    hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: onlyGraduated ? 'FF4F46E5' : 'FF7C3AED' },
    };
    hdr.alignment = { horizontal: 'center', vertical: 'middle' };

    let stt = 1;
    targetDecisions.forEach((d) => {
      const stuList =
        onlyGraduated && d.recognitionStudents.length > 0
          ? d.recognitionStudents
          : d.students.length > 0
            ? d.students
            : d.recognitionStudents;

      stuList.forEach((rawStu: any) => {
        const s = rawStu.attributes || rawStu;
        ws.addRow({
          stt: stt++,
          studentCode: s.student_code || s.studentCode || '',
          fullName: s.full_name || s.fullName || s.name || '',
          gender: s.gender || '',
          dob: s.dob ? fmtNgay(s.dob) : '',
          pob: s.pob || '',
          ethnicity: s.ethnicity || '',
          nationality: s.nationality || '',
          cccd: s.id_number || s.card_number || s.student_code || '',
          phone: s.phone || '',
          address: s.address || '',
          company: s.company || '',
          className: d.className,
          trainingCourse: d.trainingCourse,
          openNum: d.number,
          openDate: fmtNgay(d.signedDate),
          recNum: d.recognitionNumber || '---',
          recDate: d.recognitionDate ? fmtNgay(d.recognitionDate) : '---',
          status: d.status === 'Completed' ? 'Đã tốt nghiệp' : 'Đang đào tạo',
          notes: s.notes || '',
        });
      });
    });

    if (stt === 1) {
      message.warning('Không có dữ liệu học viên trong các lớp đã chọn.');
      return;
    }

    ws.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const { saveAs } = await import('file-saver');
    const fileName = onlyGraduated
      ? `TH_HocVien_TotNghiep_${dayjs().format('YYYY-MM-DD')}.xlsx`
      : `DS_HocVien_Co_QuyetDinh_${dayjs().format('YYYY-MM-DD')}.xlsx`;
    saveAs(new Blob([buf]), fileName);
    message.success('Đã xuất danh sách học viên ra Excel thành công!');
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
                  Tổng hợp số liệu học viên, quyết định mở lớp và quyết định công nhận tốt nghiệp theo giai đoạn
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <Button
                type="primary"
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                icon={<FileExcelOutlined />}
                onClick={handleExportExcel}
              >
                Xuất Excel Thống kê
              </Button>
              <Button
                type="primary"
                style={{ background: '#0d9488', borderColor: '#0d9488' }}
                icon={<CalendarOutlined />}
                loading={exporting}
                onClick={handleExportTeachingSummary}
              >
                Tổng hợp Giảng dạy
              </Button>
              <Button
                type="primary"
                style={{ background: '#4f46e5', borderColor: '#4f46e5' }}
                icon={<TeamOutlined />}
                onClick={() => handleExportStudentsList(true)}
              >
                TH Học viên (Tốt nghiệp)
              </Button>
              <Button
                type="primary"
                style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                icon={<TeamOutlined />}
                onClick={() => handleExportStudentsList(false)}
              >
                DS Học viên có QĐ
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
          <Col xs={24} lg={9}>
            <Space wrap>
              <Text strong>Khoảng thời gian:</Text>
              <RangePicker
                value={dateRange}
                onChange={(dates) => dates && setDateRange([dates[0]!, dates[1]!])}
                format="DD/MM/YYYY"
                allowClear={false}
              />
            </Space>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Space style={{ width: '100%' }}>
              <Text strong>Lọc ngày:</Text>
              <Select
                value={dateFilterMode}
                onChange={(val) => setDateFilterMode(val)}
                style={{ width: 220 }}
                popupMatchSelectWidth={false}
              >
                <Select.Option value="any">Mở lớp hoặc Công nhận trong kỳ</Select.Option>
                <Select.Option value="recognition">Theo ngày QĐ Công nhận</Select.Option>
                <Select.Option value="opening">Theo ngày QĐ Mở lớp</Select.Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <Space style={{ width: '100%' }}>
              <Text strong>Lớp học:</Text>
              <Select
                value={selectedClass}
                onChange={(val) => setSelectedClass(val)}
                showSearch
                optionFilterProp="children"
                popupMatchSelectWidth={false}
                style={{ width: 200 }}
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
          <Col xs={24} sm={12} lg={4}>
            <Space style={{ width: '100%' }}>
              <Text strong>Trạng thái:</Text>
              <Select
                value={selectedStatus}
                onChange={(val) => setSelectedStatus(val)}
                style={{ width: 150 }}
              >
                <Select.Option value="all">Tất cả ({filteredData.length})</Select.Option>
                <Select.Option value="Completed">Đã tốt nghiệp</Select.Option>
                <Select.Option value="Ongoing">Đang đào tạo</Select.Option>
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
              title="Tổng số lớp trong kỳ"
              value={totalClasses}
              suffix="lớp"
              prefix={<FileTextOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontWeight: 'bold' }}
            />
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Mở mới: <b>{openedInPeriodCount}</b> lớp • Công nhận trong kỳ: <b>{recognizedInPeriodCount}</b> lớp
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Tổng số học viên"
              value={totalStudents}
              suffix="học viên"
              prefix={<TeamOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff', fontWeight: 'bold' }}
            />
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Tổng số lượt học viên của {totalClasses} lớp
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Đã tốt nghiệp / Công nhận"
              value={completedStudents}
              suffix={`HV (${completedClasses} lớp)`}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
            />
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Đã có Quyết định công nhận tốt nghiệp
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Đang trong tiến trình"
              value={ongoingStudents}
              suffix={`HV (${ongoingClasses} lớp)`}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16', fontWeight: 'bold' }}
            />
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Đã có QĐ mở lớp, chưa có QĐ công nhận
            </div>
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="Thống kê Học viên Mở lớp & Tốt nghiệp theo tháng" size="small">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Mở lớp (HV)" fill="#1677ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Tốt nghiệp (HV)" fill="#52c41a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Tỷ lệ Trạng thái lớp trong kỳ" size="small">
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
          <Card title="Tỷ lệ hoàn thành khóa học" style={{ height: '100%' }}>
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
                  <b>{completedClasses}</b> / <b>{totalClasses}</b> lớp ({completedStudents} học viên) đã có Quyết định công nhận tốt nghiệp
                </Text>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card title="Phân bổ theo chương trình đào tạo" style={{ height: '100%' }}>
            {classBreakdown.length === 0 ? (
              <Empty description="Chưa có dữ liệu phân bổ." />
            ) : (
              <div style={{ maxHeight: 220, overflowY: 'auto', paddingRight: 8 }}>
                {classBreakdown.map((cb, idx) => {
                  const pct = totalStudents > 0 ? Math.round((cb.studentCount / totalStudents) * 100) : 0;
                  return (
                    <div key={idx} style={{ marginBottom: 14 }}>
                      <Row justify="space-between" style={{ marginBottom: 4 }}>
                        <Col>
                          <Text strong>{cb.className}</Text>{' '}
                          <Text type="secondary">
                            ({cb.classCount} lớp • {cb.completedCount} đã tốt nghiệp)
                          </Text>
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
      <Card
        title={
          <Space>
            <span>Danh sách các khóa & lớp đào tạo trong kỳ</span>
            <Tag color="blue">{filteredData.length} lớp</Tag>
            <Tag color="green">{completedClasses} lớp đã công nhận</Tag>
            <Tag color="orange">{ongoingClasses} lớp đang đào tạo</Tag>
          </Space>
        }
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : filteredData.length === 0 ? (
          <Empty description="Không có lớp nào phù hợp với bộ lọc." />
        ) : (
          <Table
            dataSource={filteredData}
            rowKey="id"
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              pageSizeOptions: ['15', '30', '50', '100'],
              showTotal: (t) => `Tổng số ${t} lớp`,
            }}
            columns={[
              {
                title: 'STT',
                width: 55,
                align: 'center',
                render: (_, __, idx) => idx + 1,
              },
              {
                title: 'Tên lớp & Khóa đào tạo',
                dataIndex: 'className',
                render: (val, record) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {record.classCode ? <Tag color="blue">{record.classCode}</Tag> : null}
                      {val}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Khóa/Đợt: <b>{record.trainingCourse}</b>
                    </Text>
                  </div>
                ),
              },
              {
                title: 'QĐ Mở lớp',
                key: 'opening',
                width: 190,
                render: (_, record) => (
                  <div>
                    <div>
                      <Text strong style={{ color: '#1677ff' }}>
                        {record.number}
                      </Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Ngày ký: {fmtNgay(record.signedDate)}
                    </Text>
                  </div>
                ),
              },
              {
                title: 'QĐ Công nhận tốt nghiệp',
                key: 'recognition',
                width: 200,
                render: (_, record) =>
                  record.recognitionNumber ? (
                    <div>
                      <div>
                        <Text strong style={{ color: '#16a34a' }}>
                          {record.recognitionNumber}
                        </Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Ngày ký: {fmtNgay(record.recognitionDate || '')}
                      </Text>
                    </div>
                  ) : (
                    <Text type="secondary" italic>
                      Chưa có QĐ công nhận
                    </Text>
                  ),
              },
              {
                title: 'Sĩ số',
                dataIndex: 'studentCount',
                width: 130,
                align: 'center',
                render: (_, record) => (
                  <div>
                    <Tag color="blue">{record.studentCount} học viên</Tag>
                    {record.status === 'Completed' &&
                      record.recognitionStudentCount !== undefined &&
                      record.recognitionStudentCount !== record.openingStudentCount && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          (Mở lớp: {record.openingStudentCount} HV)
                        </div>
                      )}
                  </div>
                ),
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

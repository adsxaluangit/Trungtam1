import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { TableProps } from 'antd';
import {
  CameraOutlined,
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  FileZipOutlined,
  HistoryOutlined,
  IdcardOutlined,
  LockOutlined,
  PaperClipOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SaveOutlined,
  UnlockOutlined,
  UserOutlined,
  DownloadOutlined,
  UploadOutlined,
  CalendarOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, COLLECTIONS, normalizeStrapiList, uploadFile } from '../api';
import { fmtNgay, PROVINCES_LIST, toIso } from '../constants';

const { Text } = Typography;

interface QuyetDinhProps {
  mode: 'OPENING' | 'RECOGNITION';
}

interface StudentDetail {
  id: string;
  strapiId?: number;
  fullName: string;
  gender: string;
  dob: string;
  cardNumber: string;
  studentCode: string;
  hometown: string;
  address: string;
  phone: string;
  notes: string;
  photo?: string | null;
  documents?: any[];
}

export default function QuyetDinh({ mode }: QuyetDinhProps) {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [editStudentForm] = Form.useForm();

  const isOpening = mode === 'OPENING';
  const tieuDeLoai = isOpening ? 'Quyết định mở lớp' : 'Quyết định công nhận tốt nghiệp';

  // Pagination & search
  const [trang, setTrang] = useState(1);
  const [kichThuocTrang, setKichThuocTrang] = useState(15);
  const [tuKhoa, setTuKhoa] = useState('');

  // Modal states
  const [moModal, setMoModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isLockedViewMode, setIsLockedViewMode] = useState(false);

  // Expanded row students (deep loaded per decision)
  const [expandedStudents, setExpandedStudents] = useState<Record<string, StudentDetail[]>>({});
  const [expandedLoading, setExpandedLoading] = useState<Record<string, boolean>>({});

  // Temp students in the edit modal
  const [tempStudents, setTempStudents] = useState<StudentDetail[]>([]);
  const [lopDuocChon, setLopDuocChon] = useState<string | null>(null);
  const [relatedOpeningId, setRelatedOpeningId] = useState<string>('');

  // Student picker modal
  const [moPickerModal, setMoPickerModal] = useState(false);
  const [pickerStudents, setPickerStudents] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());

  // Edit student modal
  const [moEditSvModal, setMoEditSvModal] = useState(false);
  const [editingSvIndex, setEditingSvIndex] = useState<number | null>(null);
  const [editingSvData, setEditingSvData] = useState<StudentDetail | null>(null);
  const [isCameraLive, setIsCameraLive] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Locked decisions set (opening decisions that have a recognition)
  const [lockedOpeningIds, setLockedOpeningIds] = useState<Set<string>>(new Set());

  // Locked action modal
  const [moLockedModal, setMoLockedModal] = useState(false);
  const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);
  const [lockedDecisionNumber, setLockedDecisionNumber] = useState('');

  // Import Excel modal
  const [moImportModal, setMoImportModal] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  // Audit logs, Xem điểm, Xem hồ sơ modals
  const [moAuditModal, setMoAuditModal] = useState(false);
  const [viewingGradeStudent, setViewingGradeStudent] = useState<StudentDetail | null>(null);
  const [viewingDocsStudent, setViewingDocsStudent] = useState<StudentDetail | null>(null);

  // ============================================================
  // 1. Fetch danh sách lớp học (kèm subjects)
  // ============================================================
  const { data: danhSachLop } = useQuery({
    queryKey: ['classes-for-decisions'],
    queryFn: async () => {
      const res = await api<any>(
        `/${COLLECTIONS.CLASSES}?populate[subjects]=true&pagination[pageSize]=1000&publicationState=preview`,
      );
      return normalizeStrapiList(res);
    },
  });

  // ============================================================
  // 1b. Fetch mẫu in, lịch phân công, bảng điểm, duyệt thi, lịch sử
  // ============================================================
  const { data: printTemplates } = useQuery({
    queryKey: ['print-templates-for-decisions'],
    queryFn: async () => {
      const res = await api<any>(`/${COLLECTIONS.PRINT_TEMPLATES}?pagination[pageSize]=50&publicationState=preview`);
      return normalizeStrapiList(res);
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ['assignments-for-decisions'],
    queryFn: async () => {
      const res = await api<any>(
        `/${COLLECTIONS.TRAINING_ASSIGNMENTS}?populate[decision]=true&pagination[pageSize]=1000&publicationState=preview`,
      );
      return normalizeStrapiList(res);
    },
  });

  const { data: examGrades } = useQuery({
    queryKey: ['exam-grades-for-decisions'],
    queryFn: async () => {
      const res = await api<any>(
        `/${COLLECTIONS.EXAM_GRADES}?populate[decision]=true&pagination[pageSize]=1000&publicationState=preview`,
      );
      return normalizeStrapiList(res);
    },
  });

  const { data: examApprovals } = useQuery({
    queryKey: ['exam-approvals-for-decisions'],
    queryFn: async () => {
      const res = await api<any>(
        `/${COLLECTIONS.EXAM_APPROVALS}?populate[decision]=true&pagination[pageSize]=1000&publicationState=preview`,
      );
      return normalizeStrapiList(res);
    },
  });

  const { data: auditLogs, isFetching: auditLoading } = useQuery({
    queryKey: ['audit-logs-for-decisions', moAuditModal],
    enabled: moAuditModal,
    queryFn: async () => {
      const res = await api<any>(
        `/${COLLECTIONS.AUDIT_LOGS}?sort=createdAt:desc&pagination[pageSize]=100&publicationState=preview`,
      );
      return normalizeStrapiList(res);
    },
  });

  // ============================================================
  // 2. Fetch danh sách Quyết định mở lớp (cho RECOGNITION dropdown)
  // ============================================================
  const { data: danhSachQdMoLop } = useQuery({
    queryKey: ['opening-decisions-for-recognition'],
    enabled: !isOpening,
    queryFn: async () => {
      const res = await api<any>(
        `/${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=OPENING&populate[school_class]=true&pagination[pageSize]=1000&publicationState=preview`,
      );
      return normalizeStrapiList(res);
    },
  });

  // ============================================================
  // 3. Fetch danh sách Quyết định (paginated)
  // ============================================================
  const queryQuyetDinh = useQuery({
    queryKey: ['decisions-list', mode, trang, kichThuocTrang, tuKhoa],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = `/${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=${mode}&populate[school_class]=true&populate[students]=true&populate[related_decision]=true&sort=signed_date:desc&pagination[page]=${trang}&pagination[pageSize]=${kichThuocTrang}&publicationState=preview`;
      if (tuKhoa) {
        q += `&filters[$or][0][decision_number][$containsi]=${encodeURIComponent(tuKhoa)}&filters[$or][1][training_course][$containsi]=${encodeURIComponent(tuKhoa)}`;
      }
      const res = await api<any>(q);
      const items = normalizeStrapiList(res);
      const total = res?.meta?.pagination?.total ?? 0;

      // For OPENING: determine which are locked (have a linked RECOGNITION)
      if (isOpening && items.length > 0) {
        try {
          const ids = items.map((d: any) => d.documentId || d.id);
          const idQueries = ids
            .map((id: string, idx: number) => `filters[related_decision][documentId][$in][${idx}]=${id}`)
            .join('&');
          const relData = await api<any>(
            `/${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=RECOGNITION&${idQueries}&populate[related_decision]=true&publicationState=preview`,
          );
          const relList = normalizeStrapiList(relData);
          const lockedSet = new Set<string>();
          relList.forEach((r: any) => {
            const rd = r.related_decision?.data || r.related_decision;
            if (rd) lockedSet.add(String(rd.documentId || rd.id));
          });
          setLockedOpeningIds(lockedSet);
        } catch {
          setLockedOpeningIds(new Set());
        }
      } else {
        setLockedOpeningIds(new Set());
      }

      return { items, total };
    },
  });

  // ============================================================
  // Helper: load full student details for a decision
  // ============================================================
  const loadDecisionStudents = async (docId: string): Promise<StudentDetail[]> => {
    const res = await api<any>(
      `/${COLLECTIONS.CLASS_DECISIONS}?filters[documentId][$eq]=${docId}&populate[school_class]=true&populate[related_decision]=true&populate[students][populate][documents]=true&populate[students][fields][0]=full_name&populate[students][fields][1]=dob&populate[students][fields][2]=gender&populate[students][fields][3]=id_number&populate[students][fields][4]=phone&populate[students][fields][5]=pob&populate[students][fields][6]=photo&populate[students][fields][7]=student_code&populate[students][fields][8]=address&populate[students][fields][9]=notes&publicationState=preview`,
    );
    const list = normalizeStrapiList(res);
    if (!list.length) return [];
    const d = list[0];
    const studentsData = d.students?.data || d.students || [];
    const mapped: StudentDetail[] = Array.isArray(studentsData)
      ? studentsData.map((s: any) => {
          const item = s.attributes || s;
          const rawDocs = item.documents?.data || item.documents || [];
          return {
            id: String(s.documentId || s.id),
            strapiId: s.strapiId || s.id,
            fullName: item.full_name || item.fullName || '',
            gender: item.gender || 'Nam',
            dob: item.dob || '',
            studentCode: item.student_code || item.studentCode || '',
            hometown: item.pob || '',
            address: item.address || '',
            phone: item.phone || '',
            cardNumber: item.id_number || item.card_number || '',
            notes: item.notes || '',
            photo: item.photo || null,
            documents: Array.isArray(rawDocs) ? rawDocs.map((doc: any) => doc.attributes || doc) : [],
          } as StudentDetail;
        })
      : [];

    // Bổ sung tài liệu dùng chung theo số CCCD (cho học viên học nhiều lớp/khóa)
    await Promise.all(
      mapped.map(async (st) => {
        const cccd = (st.cardNumber || st.studentCode || '').trim();
        if (!cccd || (st.documents && st.documents.length >= 2)) return;
        try {
          const sharedRes = await api<any>(
            `/student-documents/by-id-number?id_number=${encodeURIComponent(cccd)}`,
          );
          const sharedDocs = sharedRes?.data || [];
          if (Array.isArray(sharedDocs) && sharedDocs.length > 0) {
            const docMap = new Map<string, any>();
            [...(st.documents || []), ...sharedDocs].forEach((doc: any) => {
              const key = String(doc.url || doc.documentId || doc.id || doc.name);
              if (key && !docMap.has(key)) docMap.set(key, doc);
            });
            st.documents = Array.from(docMap.values());
          }
        } catch {
          // ignore
        }
      }),
    );

    return mapped;
  };

  // ============================================================
  // 4. Mutation Lưu Quyết định
  // ============================================================
  const luuMut = useMutation({
    mutationFn: async (values: any) => {
      const cls = danhSachLop?.find(
        (c: any) =>
          String(c.documentId) === String(values.classId) ||
          String(c.id) === String(values.classId) ||
          String(c.strapiId) === String(values.classId),
      );
      const classNumericId = cls?.strapiId
        ? Number(cls.strapiId)
        : !isNaN(Number(values.classId)) && Number(values.classId) > 0
          ? Number(values.classId)
          : null;

      const studentNumericIds = tempStudents
        .map((s: any) => {
          if (s.strapiId && !isNaN(Number(s.strapiId))) return Number(s.strapiId);
          if (s.id && !isNaN(Number(s.id))) return Number(s.id);
          return null;
        })
        .filter(Boolean);

      const payload: any = {
        decision_number: values.decision_number,
        type: mode,
        signed_date: values.signed_date ? toIso(values.signed_date) : null,
        signer_name: values.signer_name || 'HIỆU TRƯỞNG',
        training_course: values.training_course || '',
        notes: values.notes || '',
        school_class: classNumericId,
        students: studentNumericIds,
      };

      const relOpeningKey = values.relatedOpeningId || relatedOpeningId;
      if (!isOpening && relOpeningKey) {
        const relDec =
          danhSachQdMoLop?.find(
            (d: any) =>
              String(d.documentId) === String(relOpeningKey) ||
              String(d.id) === String(relOpeningKey) ||
              String(d.strapiId) === String(relOpeningKey),
          ) ||
          queryQuyetDinh.data?.items?.find(
            (d: any) =>
              String(d.documentId) === String(relOpeningKey) ||
              String(d.id) === String(relOpeningKey) ||
              String(d.strapiId) === String(relOpeningKey),
          );
        const relNumericId = relDec?.strapiId
          ? Number(relDec.strapiId)
          : !isNaN(Number(relOpeningKey)) && Number(relOpeningKey) > 0
            ? Number(relOpeningKey)
            : null;
        payload.related_decision = relNumericId;
      }

      if (editingItem) {
        // Check duplicate decision number in same year
        if (values.signed_date) {
          const year = dayjs(values.signed_date).year();
          const dupRes = await api<any>(
            `/${COLLECTIONS.CLASS_DECISIONS}?filters[decision_number][$eq]=${encodeURIComponent(values.decision_number)}&publicationState=preview`,
          );
          const dupList = normalizeStrapiList(dupRes);
          const isDup = dupList.some((d: any) => {
            if (String(d.documentId || d.id) === String(editingItem.documentId || editingItem.id)) return false;
            if (!d.signed_date) return false;
            return new Date(d.signed_date).getFullYear() === year;
          });
          if (isDup) throw new Error('Số quyết định này đã tồn tại trong năm ' + year + '. Vui lòng kiểm tra lại.');
        }
        return api(`/${COLLECTIONS.CLASS_DECISIONS}/${editingItem.documentId || editingItem.id}`, {
          method: 'PUT',
          body: { data: payload },
        });
      } else {
        // Check duplicate before create
        if (values.signed_date) {
          const year = dayjs(values.signed_date).year();
          const dupRes = await api<any>(
            `/${COLLECTIONS.CLASS_DECISIONS}?filters[decision_number][$eq]=${encodeURIComponent(values.decision_number)}&publicationState=preview`,
          );
          const dupList = normalizeStrapiList(dupRes);
          const isDup = dupList.some((d: any) => {
            if (!d.signed_date) return false;
            return new Date(d.signed_date).getFullYear() === year;
          });
          if (isDup) throw new Error('Số quyết định này đã tồn tại trong năm ' + year + '. Vui lòng kiểm tra lại.');
        }
        payload.publishedAt = new Date().toISOString();
        return api(`/${COLLECTIONS.CLASS_DECISIONS}`, {
          method: 'POST',
          body: { data: payload },
        });
      }
    },
    onSuccess: () => {
      message.success(editingItem ? 'Cập nhật quyết định thành công' : 'Tạo quyết định mới thành công');
      setMoModal(false);
      setEditingItem(null);
      form.resetFields();
      setTempStudents([]);
      setLopDuocChon(null);
      setRelatedOpeningId('');
      setIsLockedViewMode(false);
      qc.invalidateQueries({ queryKey: ['decisions-list'] });
      qc.invalidateQueries({ queryKey: ['students-list'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'Lỗi khi lưu quyết định');
    },
  });

  // ============================================================
  // 5. Mutation Xóa
  // ============================================================
  const xoaMut = useMutation({
    mutationFn: async (documentId: string) => {
      return api(`/${COLLECTIONS.CLASS_DECISIONS}/${documentId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      message.success('Đã xóa quyết định');
      qc.invalidateQueries({ queryKey: ['decisions-list'] });
      qc.invalidateQueries({ queryKey: ['students-list'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'Lỗi khi xóa quyết định');
    },
  });

  // ============================================================
  // Mở form thêm mới
  // ============================================================
  const moThemMoi = () => {
    setEditingItem(null);
    setIsLockedViewMode(false);
    form.resetFields();
    setTempStudents([]);
    setLopDuocChon(null);
    setRelatedOpeningId('');
    form.setFieldsValue({
      signed_date: dayjs(),
      signer_name: 'HIỆU TRƯỞNG',
    });
    setMoModal(true);
  };

  // ============================================================
  // Mở form sửa
  // ============================================================
  const moSua = async (item: any, lockedView = false) => {
    setEditingItem(item);
    setIsLockedViewMode(lockedView);
    setTempStudents([]);
    setLopDuocChon(null);
    setRelatedOpeningId('');
    form.resetFields();

    const cls = item.school_class;
    const classId = cls?.documentId || cls?.id;
    setLopDuocChon(classId || null);

    const relDecObj = item.related_decision?.data || item.related_decision;
    const relId = item.relatedOpeningId || relDecObj?.documentId || relDecObj?.id || '';
    if (relId) {
      setRelatedOpeningId(String(relId));
    }

    form.setFieldsValue({
      decision_number: item.decision_number,
      signed_date: item.signed_date ? dayjs(item.signed_date) : null,
      signer_name: item.signer_name || 'HIỆU TRƯỞNG',
      training_course: item.training_course,
      notes: item.notes,
      classId: classId || undefined,
      relatedOpeningId: relId ? String(relId) : undefined,
    });

    setMoModal(true);

    // Load full students
    try {
      const docId = item.documentId || item.id;
      const students = await loadDecisionStudents(docId);
      setTempStudents(students);
    } catch {
      setTempStudents(item.students || []);
    }
  };

  // ============================================================
  // Expand row: load students on first expand
  // ============================================================
  const handleExpand = async (expanded: boolean, record: any) => {
    if (!expanded) return;
    const docId = record.documentId || record.id;
    if (expandedStudents[docId]) return; // already loaded
    setExpandedLoading(prev => ({ ...prev, [docId]: true }));
    try {
      const students = await loadDecisionStudents(docId);
      setExpandedStudents(prev => ({ ...prev, [docId]: students }));
    } catch {
      setExpandedStudents(prev => ({ ...prev, [docId]: [] }));
    } finally {
      setExpandedLoading(prev => ({ ...prev, [docId]: false }));
    }
  };

  // ============================================================
  // Load students for picker (Thêm học viên) - chỉ lấy học viên đăng ký đúng lớp đó
  // ============================================================
  const moPickerHocVien = async (item?: any) => {
    const activeClassId = item
      ? (item.school_class?.documentId || item.school_class?.id)
      : (form.getFieldValue('classId') || lopDuocChon || editingItem?.school_class?.documentId || editingItem?.school_class?.id);
    const clsObj = danhSachLop?.find(
      (c: any) =>
        String(c.documentId || c.id) === String(activeClassId) ||
        String(c.strapiId) === String(activeClassId),
    );
    const activeClassName = (
      item?.school_class?.name ||
      clsObj?.name ||
      editingItem?.school_class?.name ||
      ''
    ).trim();

    if (isOpening && !activeClassId && !activeClassName) {
      message.warning('Vui lòng chọn Lớp học áp dụng trước khi thêm học viên!');
      return;
    }

    setPickerLoading(true);
    setPickerSearch('');
    setPickerSelected(new Set());
    setMoPickerModal(true);
    try {
      let students: any[] = [];
      if (isOpening) {
        // Chỉ lấy học viên đã duyệt, chưa có quyết định mở lớp và đăng ký học đúng ở lớp đó
        const res = await api<any>(
          `/${COLLECTIONS.STUDENTS}/unassigned?filters[school_class][name][$eq]=${encodeURIComponent(activeClassName)}&filters[is_approved][$eq]=true&populate[school_class]=true&pagination[pageSize]=500&publicationState=preview`,
        );
        const rawList = normalizeStrapiList(res);
        students = rawList.filter((s: any) => {
          const sCls = s.school_class?.data || s.school_class || {};
          const sClassDocId = String(sCls.documentId || sCls.id || '');
          const sClassName = String(sCls.name || s.class_name || s.group || '').trim();
          const matchClass =
            (activeClassId && sClassDocId === String(activeClassId)) ||
            (activeClassName && sClassName.toLowerCase() === activeClassName.toLowerCase());
          const matchApproved = s.is_approved === true || String(s.is_approved).toLowerCase() === 'true';
          return matchClass && matchApproved;
        });
      } else {
        // Đối với Quyết định công nhận: ưu tiên lấy học viên từ Quyết định mở lớp liên kết hoặc đúng lớp đó
        const relId =
          item?.related_decision?.documentId ||
          item?.related_decision?.id ||
          form.getFieldValue('relatedOpeningId') ||
          relatedOpeningId;
        if (relId) {
          const openStudents = await loadDecisionStudents(String(relId));
          students = openStudents.map((sv) => ({
            id: sv.id,
            documentId: sv.id,
            strapiId: sv.strapiId,
            full_name: sv.fullName,
            gender: sv.gender,
            dob: sv.dob,
            id_number: sv.cardNumber,
            student_code: sv.studentCode,
            pob: sv.hometown,
            address: sv.address,
            phone: sv.phone,
            notes: sv.notes,
            photo: sv.photo,
            school_class: { name: activeClassName },
          }));
        } else if (activeClassId) {
          const res = await api<any>(
            `/${COLLECTIONS.STUDENTS}?filters[school_class][documentId][$eq]=${activeClassId}&filters[is_approved][$eq]=true&populate[school_class]=true&pagination[pageSize]=500&publicationState=preview`,
          );
          students = normalizeStrapiList(res);
        }
      }

      // Filter out already in tempStudents
      const existingIds = new Set(
        tempStudents.flatMap((s) => [String(s.id), s.strapiId ? String(s.strapiId) : ''].filter(Boolean)),
      );
      setPickerStudents(
        students.filter(
          (s: any) =>
            !existingIds.has(String(s.documentId || s.id)) &&
            !(s.strapiId && existingIds.has(String(s.strapiId))),
        ),
      );
    } catch {
      setPickerStudents([]);
    } finally {
      setPickerLoading(false);
    }
  };

  // Thêm học viên từ picker vào tempStudents
  const themHocVienVaoTemp = async () => {
    const toAdd = pickerStudents.filter(s => pickerSelected.has(String(s.documentId || s.id)));
    const newDetails: StudentDetail[] = toAdd.map((s: any) => ({
      id: String(s.documentId || s.id),
      strapiId: s.strapiId || s.id,
      fullName: s.full_name || s.fullName || '',
      gender: s.gender || 'Nam',
      dob: s.dob || '',
      cardNumber: s.id_number || s.card_number || '',
      studentCode: s.student_code || '',
      hometown: s.pob || '',
      address: s.address || '',
      phone: s.phone || '',
      notes: s.notes || '',
      photo: s.photo || null,
    }));
    const updatedList = [...tempStudents, ...newDetails];
    setTempStudents(updatedList);
    setMoPickerModal(false);
    setPickerSelected(new Set());

    // Nếu thêm trực tiếp từ dòng mở rộng (ngoài bảng chính, khi modal sửa không mở) -> lưu luôn lên server
    if (!moModal && editingItem && newDetails.length > 0) {
      const docId = String(editingItem.documentId || editingItem.id);
      const studentNumericIds = updatedList
        .map((s) => {
          if (s.strapiId && !isNaN(Number(s.strapiId))) return Number(s.strapiId);
          if (s.id && !isNaN(Number(s.id))) return Number(s.id);
          return null;
        })
        .filter(Boolean);
      try {
        await api(`/${COLLECTIONS.CLASS_DECISIONS}/${docId}`, {
          method: 'PUT',
          body: { data: { students: studentNumericIds } },
        });
        setExpandedStudents((prev) => ({ ...prev, [docId]: updatedList }));
        message.success(`Đã thêm ${newDetails.length} học viên vào quyết định`);
        qc.invalidateQueries({ queryKey: ['decisions-list'] });
        qc.invalidateQueries({ queryKey: ['students-list'] });
      } catch (err: any) {
        message.error(err?.message || 'Lỗi khi lưu học viên vào quyết định');
      }
    }
  };

  // ============================================================
  // Edit student modal
  // ============================================================
  const moSuaHocVien = (sv: StudentDetail, idx: number) => {
    setEditingSvIndex(idx);
    setEditingSvData({ ...sv });
    setIsCameraLive(false);
    editStudentForm.setFieldsValue({
      fullName: sv.fullName,
      dob: sv.dob ? dayjs(sv.dob) : null,
      gender: sv.gender || 'Nam',
      cardNumber: sv.cardNumber,
      hometown: sv.hometown,
      phone: sv.phone,
      address: sv.address,
      notes: sv.notes,
    });
    setMoEditSvModal(true);
  };

  const startCamera = async () => {
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
      setIsCameraLive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 80);
    } catch {
      message.error('Không thể truy cập Camera. Vui lòng kiểm tra quyền trình duyệt.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraLive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && editingSvData) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 900;
        canvas.height = 1200;
        const v = videoRef.current;
        const vw = v.videoWidth || 640;
        const vh = v.videoHeight || 480;
        const ratio = 3 / 4;
        let sX = 0, sY = 0, sW = vw, sH = vh;
        if (vw / vh > ratio) { sW = vh * ratio; sX = (vw - sW) / 2; }
        else { sH = vw / ratio; sY = (vh - sH) / 2; }
        ctx.drawImage(v, sX, sY, sW, sH, 0, 0, 900, 1200);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setEditingSvData({ ...editingSvData, photo: dataUrl });
        stopCamera();
        message.success('Đã chụp ảnh 3x4 thành công!');
      }
    }
  };

  const xuLyAnhAI = async () => {
    if (!editingSvData?.photo) return;
    setIsProcessingAI(true);
    try {
      const gender = editStudentForm.getFieldValue('gender') || editingSvData.gender || 'Nam';
      const res = await api<any>('/students/process-photo', {
        method: 'POST',
        body: {
          originalImage: editingSvData.photo,
          gender,
        },
      });
      if (res?.processedImage) {
        setEditingSvData({ ...editingSvData, photo: res.processedImage });
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

  const taiAnhXuong = async () => {
    if (!editingSvData?.photo) return;
    try {
      const cccd = editStudentForm.getFieldValue('cardNumber') || editingSvData.cardNumber || editingSvData.studentCode || 'HV';
      const fullName = (editStudentForm.getFieldValue('fullName') || editingSvData.fullName || 'HocVien').replace(/\s+/g, '_');
      const rawUrl = editingSvData.photo;
      const fullUrl =
        rawUrl.startsWith('data:') || rawUrl.startsWith('http')
          ? rawUrl
          : `${window.location.origin}${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`;
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Anh_3x4_${cccd}_${fullName}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      const link = document.createElement('a');
      link.href = editingSvData.photo;
      link.download = 'Anh_3x4.jpg';
      link.target = '_blank';
      link.click();
    }
  };

  const luuSuaHocVien = async () => {
    if (editingSvIndex === null || !editingSvData) return;
    stopCamera();
    const values = editStudentForm.getFieldsValue();
    const updated: StudentDetail = {
      ...editingSvData,
      fullName: (values.fullName || editingSvData.fullName).toUpperCase(),
      dob: values.dob ? toIso(values.dob) || editingSvData.dob : editingSvData.dob,
      gender: values.gender || editingSvData.gender,
      cardNumber: values.cardNumber || editingSvData.cardNumber,
      hometown: values.hometown || editingSvData.hometown,
      phone: values.phone || editingSvData.phone,
      address: values.address || editingSvData.address,
      notes: values.notes || editingSvData.notes,
    };

    const newList = [...tempStudents];
    newList[editingSvIndex] = updated;
    setTempStudents(newList);
    setMoEditSvModal(false);

    // Update expanded row too if present
    const decId = editingItem?.documentId || editingItem?.id;
    if (decId && expandedStudents[decId]) {
      const expList = [...expandedStudents[decId]];
      const expIdx = expList.findIndex(s => s.id === updated.id);
      if (expIdx >= 0) {
        expList[expIdx] = updated;
        setExpandedStudents(prev => ({ ...prev, [decId]: expList }));
      }
    }

    // Ask to update original student record
    modal.confirm({
      title: 'Cập nhật hồ sơ gốc?',
      content: 'Bạn có muốn cập nhật thông tin vào Hồ sơ gốc (Quản lý học viên) không?',
      okText: 'Có, cập nhật',
      cancelText: 'Không',
      onOk: async () => {
        try {
          let finalPhoto = updated.photo;
          if (finalPhoto && finalPhoto.startsWith('data:image/')) {
            const uploaded = await uploadFile(finalPhoto, `avatar_${updated.studentCode || Date.now()}.jpg`);
            if (uploaded && uploaded.length > 0) finalPhoto = uploaded[0].url;
          }
          await api(`/${COLLECTIONS.STUDENTS}/${updated.id}`, {
            method: 'PUT',
            body: {
              data: {
                full_name: updated.fullName,
                dob: updated.dob,
                id_number: updated.cardNumber,
                pob: updated.hometown,
                phone: updated.phone,
                address: updated.address,
                notes: updated.notes,
                photo: finalPhoto || null,
              },
            },
          });
          message.success('Đã cập nhật hồ sơ gốc thành công');
        } catch {
          message.error('Không thể cập nhật hồ sơ gốc. Thông tin trong quyết định đã được lưu.');
        }
      },
    });

    setEditingSvIndex(null);
    setEditingSvData(null);
  };

  // ============================================================
  // Locked decision handling
  // ============================================================
  const checkIfLocked = (id: string) => isOpening && lockedOpeningIds.has(String(id));

  const handleClickEdit = async (item: any) => {
    const id = String(item.documentId || item.id);
    if (checkIfLocked(id)) {
      // Show action modal
      try {
        const blockRes = await api<any>(
          `/${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=RECOGNITION&filters[related_decision][documentId][$eq]=${id}&fields[0]=decision_number&publicationState=preview`,
        );
        const blockList = normalizeStrapiList(blockRes);
        const blockDec = blockList[0];
        setLockedDecisionNumber(blockDec?.decision_number || 'Không rõ');
        setLockedTargetId(id);
        setMoLockedModal(true);
      } catch {
        message.error('Không thể kiểm tra trạng thái khóa');
      }
    } else {
      moSua(item);
    }
  };

  const handleDeleteRecognitionToUnlock = async () => {
    if (!lockedTargetId) return;
    setMoLockedModal(false);
    try {
      const blockRes = await api<any>(
        `/${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=RECOGNITION&filters[related_decision][documentId][$eq]=${lockedTargetId}&publicationState=preview`,
      );
      const blockList = normalizeStrapiList(blockRes);
      if (blockList.length > 0) {
        const blockId = blockList[0].documentId || blockList[0].id;
        await api(`/${COLLECTIONS.CLASS_DECISIONS}/${blockId}`, { method: 'DELETE' });
        message.success('Đã xóa QĐ công nhận và mở khóa thành công');
        qc.invalidateQueries({ queryKey: ['decisions-list'] });
      }
    } catch {
      message.error('Mở khóa thất bại');
    }
  };

  // ============================================================
  // Tải ảnh 3x4 ZIP (expandable row & modal) - xếp theo vần A-Z
  // ============================================================
  const taiAnh3x4 = async (students: StudentDetail[], decisionNumber: string) => {
    const JSZip = (await import('jszip')).default;
    const { saveAs } = await import('file-saver');
    const zip = new JSZip();
    const withPhoto = [...students]
      .filter(s => s.photo)
      .sort((a, b) => {
        const getParts = (name: string) => {
          const parts = (name || '').trim().split(/\s+/);
          const first = parts.length > 1 ? parts.pop() || '' : parts[0] || '';
          const last = parts.join(' ');
          return { first: first.toLowerCase(), last: last.toLowerCase() };
        };
        const nameA = getParts(a.fullName || '');
        const nameB = getParts(b.fullName || '');
        return (
          nameA.first.localeCompare(nameB.first, 'vi', { sensitivity: 'base' }) ||
          nameA.last.localeCompare(nameB.last, 'vi', { sensitivity: 'base' })
        );
      });
    if (withPhoto.length === 0) {
      message.warning('Không có học viên nào có ảnh 3x4');
      return;
    }
    message.loading({ content: `Đang tải ${withPhoto.length} ảnh...`, key: 'zip' });
    let success = 0;
    for (let i = 0; i < withPhoto.length; i++) {
      const s = withPhoto[i];
      const photoSrc = s.photo!;
      const safeName = s.fullName.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') || `hocvien_${i + 1}`;
      try {
        let blob: Blob;
        let ext = 'jpg';
        if (photoSrc.startsWith('data:image/')) {
          const mime = photoSrc.match(/data:(.*?);/)?.[1] || 'image/jpeg';
          ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
          const [header, data] = photoSrc.split(',');
          const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
          const byteChars = atob(data);
          const byteArr = new Uint8Array(byteChars.length);
          for (let j = 0; j < byteChars.length; j++) byteArr[j] = byteChars.charCodeAt(j);
          blob = new Blob([byteArr], { type: mimeType });
        } else {
          let absoluteUrl = photoSrc;
          if (photoSrc.startsWith('/')) absoluteUrl = `${window.location.origin}${photoSrc}`;
          const fromUrl = photoSrc.split('?')[0].split('.').pop()?.toLowerCase();
          if (fromUrl && ['jpg', 'jpeg', 'png', 'webp'].includes(fromUrl)) ext = fromUrl === 'jpeg' ? 'jpg' : fromUrl;
          const token = localStorage.getItem('edumaster_token');
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          const response = await fetch(absoluteUrl, { headers });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          blob = await response.blob();
        }
        zip.file(`${String(i + 1).padStart(2, '0')}_${safeName}.${ext}`, blob);
        success++;
      } catch {
        // skip
      }
    }
    if (success === 0) {
      message.error({ content: 'Không tải được ảnh nào', key: 'zip' });
      return;
    }
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `anh-3x4-${decisionNumber}-${dayjs().format('DDMMYYYY')}.zip`);
    message.success({ content: `Đã tải ${success} ảnh`, key: 'zip' });
  };

  // ============================================================
  // In Quyết định
  // ============================================================
  const inQuyetDinh = (item: any, students?: StudentDetail[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Vui lòng cho phép Pop-up trên trình duyệt để in.');
      return;
    }
    const soQd = item.decision_number || '..../QĐ-CĐHH';
    const ngayKy = item.signed_date ? dayjs(item.signed_date) : dayjs();
    const tenLop = item.school_class?.name || 'Khóa đào tạo';
    const nguoiKy = item.signer_name || 'HIỆU TRƯỞNG';
    const svList: StudentDetail[] = students || item.students || [];

    const tieuDeVb = isOpening
      ? `QUYẾT ĐỊNH<br/><span style="font-size:13pt;font-weight:normal;">Về việc mở lớp đào tạo: ${tenLop}</span>`
      : `QUYẾT ĐỊNH<br/><span style="font-size:13pt;font-weight:normal;">Về việc công nhận tốt nghiệp và cấp chứng chỉ: ${tenLop}</span>`;

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${soQd} - ${tenLop}</title>
  <style>
    @page { size: A4; margin: 1.8cm 1.5cm 2cm 2cm; }
    body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.35; color: #000; margin: 0; }
    .top-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .top-table td { vertical-align: top; text-align: center; }
    .header-left { font-size: 11pt; }
    .header-left b { font-size: 12pt; }
    .header-right { font-size: 11pt; }
    .header-right b { font-size: 12.5pt; }
    .line { border-bottom: 1.5px solid #000; width: 130px; margin: 5px auto 0; }
    .title { text-align: center; font-weight: bold; font-size: 14pt; margin: 25px 0 15px; }
    .authority { text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 15px; }
    .preamble { text-align: justify; font-style: italic; margin-bottom: 15px; }
    .article { text-align: justify; margin-bottom: 10px; text-indent: 1.5cm; }
    .article b { font-style: normal; }
    .signatures { width: 100%; margin-top: 40px; border-collapse: collapse; }
    .signatures td { vertical-align: top; }
    .recipients { font-size: 10pt; font-style: italic; }
    .recipients b { font-size: 11pt; font-style: normal; }
    .signer { text-align: center; font-weight: bold; }
    .page-break { page-break-before: always; }
    table.list { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11.5pt; }
    table.list th, table.list td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
    table.list th { text-align: center; font-weight: bold; background: #f2f2f2; }
  </style>
</head>
<body>
  <table class="top-table">
    <tr>
      <td style="width:45%;" class="header-left">
        BỘ GIAO THÔNG VẬN TẢI<br/>
        <b>TRƯỜNG CĐ HÀNG HẢI &amp; ĐƯỜNG THỦY I</b>
        <div class="line"></div>
        <div style="margin-top:5px;">Số: ${soQd}</div>
      </td>
      <td style="width:55%;" class="header-right">
        <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br/>
        <b>Độc lập - Tự do - Hạnh phúc</b>
        <div class="line" style="width:170px;"></div>
        <div style="margin-top:5px;font-style:italic;">Hải Phòng, ngày ${ngayKy.date()} tháng ${ngayKy.month() + 1} năm ${ngayKy.year()}</div>
      </td>
    </tr>
  </table>
  <div class="title">${tieuDeVb}</div>
  <div class="authority">${nguoiKy.toUpperCase()} TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I</div>
  <div class="preamble">
    Căn cứ Luật Giáo dục nghề nghiệp ngày 27 tháng 11 năm 2014;<br/>
    Căn cứ Điều lệ Trường Cao đẳng Hàng hải và Đường thủy I ban hành theo Quyết định hiện hành;<br/>
    Theo đề nghị của Trưởng phòng Đào tạo và Quản lý học viên,
  </div>
  <div style="text-align:center;font-weight:bold;margin:15px 0;">QUYẾT ĐỊNH:</div>
  <div class="article">
    <b>Điều 1.</b> ${
      isOpening
        ? `Mở lớp đào tạo nghề cho lớp <b>${tenLop}</b> gồm <b>${svList.length}</b> học viên có danh sách kèm theo.`
        : `Công nhận tốt nghiệp và chuẩn y cấp Chứng chỉ đào tạo cho <b>${svList.length}</b> học viên lớp <b>${tenLop}</b> đã hoàn thành chương trình theo quy định.`
    }
  </div>
  <div class="article"><b>Điều 2.</b> Phòng Đào tạo, các đơn vị liên quan và các học viên có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này.</div>
  <div class="article"><b>Điều 3.</b> Quyết định này có hiệu lực kể từ ngày ký.</div>
  <table class="signatures">
    <tr>
      <td style="width:50%;" class="recipients">
        <b>Nơi nhận:</b><br/>
        - Như Điều 2;<br/>
        - Ban Giám hiệu (để b/c);<br/>
        - Lưu: VT, ĐT.
      </td>
      <td style="width:50%;" class="signer">
        <b>${nguoiKy.toUpperCase()}</b><br/><br/><br/><br/>
        <b>(Đã ký)</b>
      </td>
    </tr>
  </table>
  <div class="page-break"></div>
  <div style="text-align:center;margin-bottom:20px;">
    <b>DANH SÁCH HỌC VIÊN</b><br/>
    <i>(Kèm theo Quyết định số ${soQd} ngày ${fmtNgay(item.signed_date)})</i>
  </div>
  <table class="list">
    <thead>
      <tr>
        <th style="width:40px;">STT</th>
        <th>Họ và tên</th>
        <th style="width:80px;">Giới tính</th>
        <th style="width:100px;">Ngày sinh</th>
        <th style="width:120px;">Số CCCD</th>
        <th>Đơn vị / Địa chỉ</th>
      </tr>
    </thead>
    <tbody>
      ${svList.map((s, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td><b>${s.fullName || (s as any).full_name || ''}</b></td>
        <td style="text-align:center;">${s.gender || (s as any).gender || 'Nam'}</td>
        <td style="text-align:center;">${fmtNgay(s.dob)}</td>
        <td style="text-align:center;">${s.cardNumber || (s as any).id_number || (s as any).student_code || ''}</td>
        <td>${s.address || s.hometown || (s as any).company || ''}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  // ============================================================
  // Xuất Excel danh sách quyết định
  // ============================================================
  const xuatExcel = async () => {
    const items = queryQuyetDinh.data?.items || [];
    if (items.length === 0) {
      message.warning('Không có dữ liệu để xuất Excel');
      return;
    }
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(tieuDeLoai);
    ws.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'Số QĐ', key: 'decisionNumber', width: 20 },
      { header: 'Lớp học', key: 'className', width: 25 },
      { header: 'Ngày ký', key: 'signedDate', width: 12 },
      { header: 'Người ký', key: 'signerName', width: 18 },
      { header: 'Số học viên', key: 'studentCount', width: 12 },
    ];
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
    headerRow.alignment = { horizontal: 'center' };
    items.forEach((item: any, idx: number) => {
      const row = ws.addRow({
        stt: idx + 1,
        decisionNumber: item.decision_number || '',
        className: item.school_class?.name || '',
        signedDate: item.signed_date ? fmtNgay(item.signed_date) : '',
        signerName: item.signer_name || 'HIỆU TRƯỞNG',
        studentCount: (item.students || []).length,
      });
      if (idx % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
    });
    ws.eachRow(row => {
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    });
    const buf = await wb.xlsx.writeBuffer();
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([buf]), `${isOpening ? 'QD_MoLop' : 'QD_CongNhan'}_${dayjs().format('DDMMYYYY')}.xlsx`);
    message.success('Đã xuất file Excel quyết định thành công!');
  };

  // ============================================================
  // Helpers & Các nút chức năng trong Modal Lập Quyết định (từ edumaster-main)
  // ============================================================
  const sortStudentsByFirstName = (list: StudentDetail[]) => {
    return [...list]
      .filter((s) => s.fullName && s.fullName.trim() !== '')
      .sort((a, b) => {
        const getParts = (name: string) => {
          const parts = (name || '').trim().split(/\s+/);
          const first = parts.length > 1 ? parts.pop() || '' : parts[0] || '';
          const last = parts.join(' ');
          return { first: first.toLowerCase(), last: last.toLowerCase() };
        };
        const nameA = getParts(a.fullName);
        const nameB = getParts(b.fullName);
        return (
          nameA.first.localeCompare(nameB.first, 'vi', { sensitivity: 'base' }) ||
          nameA.last.localeCompare(nameB.last, 'vi', { sensitivity: 'base' })
        );
      });
  };

  const getModalFormContext = () => {
    const fv = form.getFieldsValue();
    const classId = fv.classId || lopDuocChon || editingItem?.school_class?.documentId || editingItem?.school_class?.id;
    const classObj =
      danhSachLop?.find(
        (c: any) =>
          String(c.documentId || c.id) === String(classId) ||
          String(c.strapiId) === String(classId),
      ) || editingItem?.school_class;
    const className = classObj?.name || editingItem?.school_class?.name || '';
    const trainingCourse = fv.training_course || editingItem?.training_course || '';
    const decisionNumber = fv.decision_number || editingItem?.decision_number || '';
    const signedDate = fv.signed_date
      ? dayjs(fv.signed_date).format('YYYY-MM-DD')
      : editingItem?.signed_date || dayjs().format('YYYY-MM-DD');
    const signerName = fv.signer_name || editingItem?.signer_name || 'HIỆU TRƯỞNG';
    const relDecObj = editingItem?.related_decision?.data || editingItem?.related_decision;
    const relOpenId =
      fv.relatedOpeningId ||
      relatedOpeningId ||
      relDecObj?.documentId ||
      relDecObj?.id ||
      '';
    const relOpenStrapiId = relDecObj?.strapiId || relDecObj?.id || '';
    return {
      classId,
      classObj,
      className,
      trainingCourse,
      decisionNumber,
      signedDate,
      signerName,
      relOpenId,
      relOpenStrapiId,
    };
  };

  const findGradeRecordForDecision = (
    targetDecId: string,
    targetStrapiId?: string | number,
    studentCodes?: string[],
  ) => {
    const matched = examGrades?.find((eg: any) => {
      const decRel = eg.decision?.data || eg.decision;
      const docId = String(decRel?.documentId || decRel?.id || '');
      const strId = String(decRel?.strapiId || decRel?.id || '');
      return (
        (targetDecId && (docId === String(targetDecId) || strId === String(targetDecId))) ||
        (targetStrapiId && (docId === String(targetStrapiId) || strId === String(targetStrapiId)))
      );
    });
    if (matched) return matched;
    // Fallback: tìm theo mã học viên / CCCD nếu quyết định chưa gắn hoặc khác documentId
    if (studentCodes && studentCodes.length > 0 && examGrades?.length) {
      const validCodes = studentCodes.filter(Boolean);
      if (validCodes.length > 0) {
        return examGrades.find((eg: any) => {
          const gradesObj = eg?.grades;
          if (!gradesObj || typeof gradesObj !== 'object') return false;
          return Object.values(gradesObj).some(
            (subjMap: any) =>
              subjMap &&
              typeof subjMap === 'object' &&
              validCodes.some((code) => subjMap[code] !== undefined),
          );
        });
      }
    }
    return undefined;
  };

  // 1. Nút "Bảng kê" - Xuất Excel Bảng kê nộp kinh phí đào tạo
  const xuatBangKeHocPhi = async () => {
    try {
      const { className, trainingCourse, signedDate } = getModalFormContext();
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Bảng kê Học phí', {
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      });

      worksheet.mergeCells('A1:C1');
      worksheet.getCell('A1').value = 'CỤC HÀNG HẢI VÀ ĐƯỜNG THỦY VIỆT NAM';
      worksheet.getCell('A1').font = { name: 'Times New Roman', size: 11 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:C2');
      worksheet.getCell('A2').value = 'TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I';
      worksheet.getCell('A2').font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.mergeCells('D1:G1');
      worksheet.getCell('D1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
      worksheet.getCell('D1').font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell('D1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('D2:G2');
      worksheet.getCell('D2').value = 'Độc lập - Tự do - Hạnh phúc';
      worksheet.getCell('D2').font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell('D2').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A4:G4');
      const classNameUpper = (className || '..................').toUpperCase();
      worksheet.getCell('A4').value = `BẢNG KÊ NỘP KINH PHÍ ĐÀO TẠO\nLỚP: ${classNameUpper} - KHOÁ: ${trainingCourse || '..................'}`;
      worksheet.getCell('A4').font = { name: 'Times New Roman', size: 14, bold: true };
      worksheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      worksheet.getRow(4).height = 45;

      worksheet.columns = [
        { key: 'stt', width: 6 },
        { key: 'ho_ten', width: 28 },
        { key: 'so_tien', width: 14 },
        { key: 'dia_chi', width: 30 },
        { key: 'cccd', width: 18 },
        { key: 'ky_ten', width: 18 },
        { key: 'ghi_chu', width: 15 },
      ];

      const headerRow = worksheet.getRow(5);
      headerRow.height = 30;
      headerRow.values = ['STT', 'Họ và tên', 'Số tiền', 'Địa chỉ', 'Số CCCD', 'Ký (ghi rõ họ tên)', 'Ghi chú'];
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Times New Roman', size: 12, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' },
        };
      });

      const sortedStudents = sortStudentsByFirstName(tempStudents);
      let currentRow = 6;
      for (let i = 0; i < sortedStudents.length; i++) {
        const s = sortedStudents[i];
        const row = worksheet.getRow(currentRow);
        row.height = 25;
        row.getCell(1).value = i + 1;
        row.getCell(2).value = s.fullName;
        row.getCell(3).value = '';
        row.getCell(4).value = s.address || s.hometown || '';
        row.getCell(5).value = s.cardNumber || s.studentCode || '';
        row.getCell(6).value = '';
        row.getCell(7).value = s.notes || '';

        for (let col = 1; col <= 7; col++) {
          const cell = row.getCell(col);
          cell.font = { name: 'Times New Roman', size: 12 };
          cell.alignment = {
            vertical: 'middle',
            horizontal: col === 1 || col === 3 || col === 5 ? 'center' : 'left',
            indent: col === 2 ? 1 : 0,
          };
          cell.border = {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' },
          };
        }
        currentRow++;
      }

      const summaryRow = worksheet.getRow(currentRow);
      summaryRow.height = 25;
      summaryRow.getCell(1).value = 'Tổng cộng';
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      summaryRow.getCell(1).font = { name: 'Times New Roman', size: 12, bold: true };
      summaryRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      summaryRow.getCell(3).value = '0';
      summaryRow.getCell(3).font = { name: 'Times New Roman', size: 12, bold: true };
      summaryRow.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

      for (let col = 1; col <= 7; col++) {
        if (col === 2) continue;
        summaryRow.getCell(col).border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' },
        };
      }

      currentRow += 1;
      const textSumRow = worksheet.getRow(currentRow);
      textSumRow.height = 25;
      textSumRow.getCell(1).value = 'Số tiền bằng chữ:';
      textSumRow.getCell(1).font = { name: 'Times New Roman', size: 12, italic: true, bold: true };
      textSumRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);

      currentRow += 1;
      const dateRow = worksheet.getRow(currentRow);
      dateRow.height = 20;
      worksheet.mergeCells(`D${currentRow}:G${currentRow}`);
      const dt = dayjs(signedDate);
      dateRow.getCell(4).value = `Hải Phòng, ngày ${dt.format('DD')} tháng ${dt.format('MM')} năm ${dt.format('YYYY')}`;
      dateRow.getCell(4).font = { name: 'Times New Roman', size: 12, italic: true };
      dateRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

      currentRow += 1;
      const signRoleRow = worksheet.getRow(currentRow);
      signRoleRow.height = 20;
      signRoleRow.getCell(1).value = 'NGƯỜI LẬP';
      signRoleRow.getCell(1).font = { name: 'Times New Roman', size: 12, bold: true };
      signRoleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);

      signRoleRow.getCell(3).value = 'TT. PHÁT TRIỂN NGUỒN LỰC';
      signRoleRow.getCell(3).font = { name: 'Times New Roman', size: 12, bold: true };
      signRoleRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

      signRoleRow.getCell(4).value = 'PHỤ TRÁCH KẾ TOÁN';
      signRoleRow.getCell(4).font = { name: 'Times New Roman', size: 12, bold: true };
      signRoleRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.mergeCells(`D${currentRow}:G${currentRow}`);

      currentRow += 5;
      const signNameRow = worksheet.getRow(currentRow);
      signNameRow.height = 20;
      signNameRow.getCell(3).value = 'Nguyễn Tất Quyền';
      signNameRow.getCell(3).font = { name: 'Times New Roman', size: 12, bold: true };
      signNameRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

      signNameRow.getCell(4).value = 'Nguyễn Thanh Huyền';
      signNameRow.getCell(4).font = { name: 'Times New Roman', size: 12, bold: true };
      signNameRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.mergeCells(`D${currentRow}:G${currentRow}`);

      const buffer = await workbook.xlsx.writeBuffer();
      const { saveAs } = await import('file-saver');
      saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `BangKeHocPhi_${(className || 'Lop').replace(/[/\\?%*:|"<>]/g, '_')}.xlsx`,
      );
      message.success('Đã xuất Bảng kê học phí thành công!');
    } catch {
      message.error('Có lỗi khi xuất Bảng kê học phí.');
    }
  };

  // 2. Nút "BG Tài Liệu" - In Biên bản bàn giao tài liệu
  const inBienBanBanGiaoTaiLieu = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup.');
      return;
    }
    const { classObj, className, trainingCourse } = getModalFormContext();
    const classNotes = classObj?.notes || classObj?.attributes?.notes || '';
    const sortedStudents = sortStudentsByFirstName(tempStudents);

    let studentRows = '<tbody>';
    sortedStudents.forEach((s, i) => {
      let first = '', last = '';
      if (s.fullName) {
        const parts = s.fullName.trim().split(/\s+/);
        if (parts.length === 1) {
          last = parts[0];
        } else {
          last = parts.pop() || '';
          first = parts.join(' ');
        }
      }
      studentRows += `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="left no-border-right w-first-name">${first}</td>
          <td class="center no-border-left w-last-name">${last}</td>
          <td class="center"></td>
          <td class="center"></td>
          <td class="left">${s.address || s.hometown || ''}</td>
        </tr>
      `;
      if (i === sortedStudents.length - 1) {
        studentRows += `
          <tr>
            <td colspan="3" class="bold center" style="border-right: 1px solid #000 !important;">Tổng cộng:</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        `;
      }
    });
    studentRows += '</tbody>';

    const html = `
      <html>
        <head>
          <title>Biên Bản Bàn Giao Tài Liệu</title>
          <style>
            @media print {
              @page { size: A4 landscape; margin: 15mm; }
              body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
            body { font-family: 'Times New Roman', serif; margin: 0; padding: 0; background: #fff; }
            .container { width: 100%; box-sizing: border-box; }
            .header-table { width: 100%; text-align: center; margin-bottom: 10px; border-collapse: collapse; border: none; }
            .header-table td { border: none; padding: 0; vertical-align: top; line-height: 1.3; }
            .bold { font-weight: bold; }
            .italic { font-style: italic; }
            .uppercase { text-transform: uppercase; }
            .title { text-align: center; font-size: 15pt; font-weight: bold; margin-bottom: 5px; line-height: 1.2; }
            .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .data-table th, .data-table td { border: 1px solid #000; padding: 6px 4px; font-size: 13pt; line-height: 1.2; height: 35px; }
            .data-table th { font-weight: bold; text-align: center; vertical-align: middle; padding: 8px 4px; background: #fff; }
            .center { text-align: center; }
            .left { text-align: left; padding-left: 10px !important; }
            .no-border-right { border-right: none !important; }
            .no-border-left { border-left: none !important; }
            .w-stt { width: 45px; }
            .w-first-name { width: 180px; }
            .w-last-name { width: 90px; }
            .w-sl { width: 110px; }
            .w-ky { width: 240px; }
            .footer-table { width: 100%; text-align: center; margin-top: 15px; border-collapse: collapse; border: none; page-break-inside: avoid; }
            .footer-table td { border: none; padding: 5px; vertical-align: top; }
          </style>
        </head>
        <body>
          <div class="container">
            <table class="header-table">
              <tr>
                <td style="width: 40%; font-size: 13pt;">
                  <div>TRƯỜNG CAO ĐẲNG HÀNG HẢI &amp; ĐT1</div>
                  <div class="bold">TRUNG TÂM ĐÀO TẠO PT NGUỒN LỰC</div>
                </td>
                <td style="width: 60%; font-size: 13pt;">
                  <div class="bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                  <div class="bold">Độc lập - Tự do - Hạnh phúc</div>
                </td>
              </tr>
            </table>
            <div class="title" style="margin-top: 10px;">BIÊN BẢN BÀN GIAO TÀI LIỆU</div>
            <div class="title uppercase">LỚP ${className || ''}</div>
            <div class="title uppercase" style="margin-bottom: 20px;">KHÓA : ${trainingCourse || ''}</div>
            <div style="font-size: 13pt; margin-bottom: 2px; line-height: 1.4;">
              <span class="bold">1- Tài liệu </span>
              <span>${classNotes}</span>
            </div>
            <div class="italic" style="text-align: right; font-size: 13pt; margin-bottom: 2px; white-space: nowrap;">
              ĐVT: Quyển
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th class="w-stt">STT</th>
                  <th colspan="2">HỌ VÀ TÊN</th>
                  <th class="w-sl">SỐ LƯỢNG</th>
                  <th class="w-ky">KÝ VÀ GHI HỌ VÀ TÊN</th>
                  <th>ĐỊA CHỈ LIÊN HỆ</th>
                </tr>
              </thead>
              ${studentRows}
            </table>
            <table class="footer-table">
              <tr>
                <td style="width: 50%;"></td>
                <td style="width: 50%;">
                  <div class="italic" style="font-size: 13pt; margin-bottom: 5px;">Hải Phòng, ngày ...... tháng ...... năm 20...</div>
                </td>
              </tr>
              <tr>
                <td style="width: 50%;">
                  <div class="bold uppercase" style="font-size: 13pt;">TRUNG TÂM ĐÀO TẠO PT NGUỒN LỰC</div>
                </td>
                <td style="width: 50%;">
                  <div class="bold uppercase" style="font-size: 13pt;">GIÁO VIÊN QUẢN LÝ LỚP</div>
                </td>
              </tr>
            </table>
          </div>
          <script>
            window.onload = function() { setTimeout(function() { window.print(); }, 500); };
          </script>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // 3. Nút "Xuất Excel" trong Modal (OPENING: Danh sách học lớp; RECOGNITION: Danh sách bàn giao GCN)
  const xuatExcelDanhSachHocVien = async () => {
    try {
      const { className, trainingCourse, decisionNumber, signedDate } = getModalFormContext();
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Danh sách học viên', {
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      });

      const exportSortedStudents = sortStudentsByFirstName(tempStudents);

      if (!isOpening) {
        worksheet.mergeCells('A1:C1');
        worksheet.getCell('A1').value = 'TRƯỜNG CAO ĐẲNG';
        worksheet.getCell('A1').font = { name: 'Times New Roman', size: 11 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('D1:F1');
        worksheet.getCell('D1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
        worksheet.getCell('D1').font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell('D1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:C2');
        worksheet.getCell('A2').value = 'HÀNG HẢI VÀ ĐƯỜNG THỦY I';
        worksheet.getCell('A2').font = { name: 'Times New Roman', size: 11 };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('D2:F2');
        worksheet.getCell('D2').value = 'Độc lập – Tự do – Hạnh phúc';
        worksheet.getCell('D2').font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell('D2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A3:C3');
        worksheet.getCell('A3').value = 'TT ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC';
        worksheet.getCell('A3').font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell('A3').alignment = { horizontal: 'center' };

        worksheet.getRow(5).height = 20;
        worksheet.mergeCells('A5:F5');
        worksheet.getCell('A5').value = 'DANH SÁCH BÀN GIAO GIẤY CHỨNG NHẬN';
        worksheet.getCell('A5').font = { name: 'Times New Roman', size: 14, bold: true };
        worksheet.getCell('A5').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A6:F6');
        worksheet.getCell('A6').value = `LỚP: ${(className || '').toUpperCase()} ${trainingCourse ? `– KHÓA: ${trainingCourse.toUpperCase()}` : ''}`.trim();
        worksheet.getCell('A6').font = { name: 'Times New Roman', size: 12, bold: true };
        worksheet.getCell('A6').alignment = { horizontal: 'center' };

        worksheet.getRow(8).height = 30;
        worksheet.columns = [
          { key: 'stt', width: 5 },
          { key: 'hoten', width: 25 },
          { key: 'ngaysinh', width: 12 },
          { key: 'noisinh', width: 15 },
          { key: 'kynhan', width: 30 },
          { key: 'ghichu', width: 10 },
        ];

        const headerRow = worksheet.getRow(8);
        headerRow.getCell(1).value = 'STT';
        headerRow.getCell(2).value = 'HỌ VÀ TÊN';
        headerRow.getCell(3).value = 'NGÀY\nSINH';
        headerRow.getCell(4).value = 'NƠI SINH';
        headerRow.getCell(5).value = 'KÝ VÀ GHI RÕ HỌ VÀ TÊN';
        headerRow.getCell(6).value = 'GHI CHÚ';

        headerRow.eachCell((cell, colNum) => {
          if (colNum <= 6) {
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          }
        });

        let currentRow = 9;
        for (let i = 0; i < exportSortedStudents.length; i++) {
          const s = exportSortedStudents[i];
          const row = worksheet.getRow(currentRow);
          row.height = 18;
          row.getCell(1).value = i + 1;
          row.getCell(2).value = s.fullName;
          row.getCell(3).value = fmtNgay(s.dob);
          row.getCell(4).value = s.hometown || '';
          row.getCell(5).value = '';
          row.getCell(6).value = s.notes || '';
          for (let c = 1; c <= 6; c++) {
            const cell = row.getCell(c);
            cell.font = { name: 'Times New Roman', size: 11 };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = c === 1 || c >= 3 ? { horizontal: 'center', vertical: 'middle' } : { horizontal: 'left', vertical: 'middle', indent: 1 };
          }
          currentRow++;
        }

        currentRow++;
        worksheet.getCell(currentRow, 1).value = 'BÊN NHẬN';
        worksheet.getCell(currentRow, 1).font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell(currentRow, 1).alignment = { horizontal: 'center' };

        worksheet.mergeCells(currentRow, 3, currentRow, 6);
        worksheet.getCell(currentRow, 3).value = 'TRUNG TÂM ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC';
        worksheet.getCell(currentRow, 3).font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell(currentRow, 3).alignment = { horizontal: 'center' };
      } else {
        worksheet.mergeCells('A1:B1');
        worksheet.getCell('A1').value = {
          richText: [
            { font: { size: 11, name: 'Times New Roman' }, text: 'TRƯỜNG CAO ĐẲNG\n' },
            { font: { size: 11, name: 'Times New Roman' }, text: 'HÀNG HẢI VÀ ĐƯỜNG THỦY I\n' },
            { font: { bold: true, size: 11, name: 'Times New Roman' }, text: 'TT ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC' },
          ],
        };
        worksheet.getCell('A1').alignment = { horizontal: 'center', wrapText: true, vertical: 'top' };
        worksheet.getRow(1).height = 45;

        worksheet.mergeCells('D1:F1');
        worksheet.getCell('D1').value = {
          richText: [
            { font: { bold: true, size: 11, name: 'Times New Roman' }, text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\n' },
            { font: { bold: true, size: 11, name: 'Times New Roman' }, text: 'Độc lập – Tự do – Hạnh phúc' },
          ],
        };
        worksheet.getCell('D1').alignment = { horizontal: 'center', wrapText: true, vertical: 'top' };

        worksheet.mergeCells('A3:F3');
        worksheet.getCell('A3').value = `DANH SÁCH HỌC LỚP ${className || '...'}`.toUpperCase();
        worksheet.getCell('A3').font = { name: 'Times New Roman', size: 12, bold: true };
        worksheet.getCell('A3').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A4:F4');
        worksheet.getCell('A4').value = `KHOÁ ${trainingCourse || '...'}`.toUpperCase();
        worksheet.getCell('A4').font = { name: 'Times New Roman', size: 12, bold: true };
        worksheet.getCell('A4').alignment = { horizontal: 'center' };

        worksheet.getRow(5).height = 20;
        worksheet.columns = [
          { key: 'stt', width: 5 },
          { key: 'ho', width: 16 },
          { key: 'ten', width: 9 },
          { key: 'ngaysinh', width: 14 },
          { key: 'noisinh', width: 15 },
          { key: 'ghichu', width: 12 },
        ];

        const headerRow = worksheet.getRow(5);
        headerRow.getCell(1).value = 'STT';
        worksheet.mergeCells('B5:C5');
        headerRow.getCell(2).value = 'HỌ VÀ TÊN';
        headerRow.getCell(4).value = 'NGÀY SINH';
        headerRow.getCell(5).value = 'NƠI SINH';
        headerRow.getCell(6).value = 'GHI CHÚ';

        headerRow.eachCell((cell, colNum) => {
          if (colNum <= 6) {
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          }
        });
        worksheet.getCell('B5').border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        worksheet.getCell('C5').border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        let currentRow = 6;
        for (let i = 0; i < exportSortedStudents.length; i++) {
          const s = exportSortedStudents[i];
          const parts = s.fullName.trim().split(' ');
          const ten = parts.pop() || '';
          const ho = parts.join(' ');

          const row = worksheet.getRow(currentRow);
          row.height = 18;
          row.getCell(1).value = i + 1;
          row.getCell(2).value = ho;
          row.getCell(3).value = ten;
          row.getCell(4).value = fmtNgay(s.dob);
          row.getCell(5).value = s.hometown || '';
          row.getCell(6).value = s.notes || '';

          for (let c = 1; c <= 6; c++) {
            const cell = row.getCell(c);
            cell.font = { name: 'Times New Roman', size: 11 };
            if (c === 2) {
              cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' } };
            } else if (c === 3) {
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
              cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            } else {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
          }
          currentRow++;
        }

        currentRow++;
        worksheet.mergeCells(currentRow, 4, currentRow, 6);
        const dt = dayjs(signedDate);
        worksheet.getCell(currentRow, 4).value = `Ngày ${dt.format('DD')} tháng ${dt.format('MM')} năm ${dt.format('YYYY')}`;
        worksheet.getCell(currentRow, 4).font = { name: 'Times New Roman', size: 11 };
        worksheet.getCell(currentRow, 4).alignment = { horizontal: 'center' };

        currentRow++;
        worksheet.mergeCells(currentRow, 4, currentRow, 6);
        worksheet.getCell(currentRow, 4).value = 'TRUNG TÂM ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC';
        worksheet.getCell(currentRow, 4).font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell(currentRow, 4).alignment = { horizontal: 'center' };

        currentRow += 5;
        worksheet.mergeCells(currentRow, 4, currentRow, 6);
        worksheet.getCell(currentRow, 4).value = 'Nguyễn Tất Quyền';
        worksheet.getCell(currentRow, 4).font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell(currentRow, 4).alignment = { horizontal: 'center' };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const { saveAs } = await import('file-saver');
      saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `DanhSachHocVien_${decisionNumber ? decisionNumber.replace(/\//g, '_') : 'Export'}.xlsx`,
      );
      message.success('Đã xuất Excel danh sách học viên!');
    } catch {
      message.error('Có lỗi khi xuất Excel danh sách học viên.');
    }
  };

  // 4. Nút "Xuất QĐ" - Xuất file Word (.doc) theo mẫu in & mở cửa sổ in
  const xuatWordQuyetDinh = () => {
    const { className, trainingCourse, decisionNumber, signedDate, signerName } = getModalFormContext();
    const dt = dayjs(signedDate);
    const dateText = `ngày ${dt.date()} tháng ${dt.month() + 1} năm ${dt.year()}`;

    const defaultTpl = isOpening
      ? {
          headerLine1: 'CỤC HÀNG HẢI VÀ ĐƯỜNG THỦY VIỆT NAM',
          headerLine2: 'TRƯỜNG CAO ĐẲNG',
          headerLine3: 'HÀNG HẢI VÀ ĐƯỜNG THỦY I',
          nation: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
          motto: 'Độc lập - Tự do - Hạnh phúc',
          title: 'QUYẾT ĐỊNH',
          subtitle: 'Về việc mở lớp {{CLASS_NAME}}',
          subtext: '(Theo Quy tắc Quốc tế về phòng ngừa đâm va tàu thuyền trên biển năm 1972 đã sửa đổi)',
          course: '{{TRAINING_COURSE}}',
          authority: 'HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I',
          preamble:
            'Căn cứ Quyết định số 638/QĐ-BGTVT ngày 24 tháng 05 năm 2024 của Bộ trưởng Bộ Giao thông vận tải quy định chức năng, nhiệm vụ, quyền hạn và cơ cấu tổ chức của Trường Cao đẳng Hàng hải và Đường thủy I;\nCăn cứ công văn số 905/CHHVN-VTHH ngày 11 tháng 3 năm 2022 của Cục Hàng hải Việt Nam về việc tổ chức các khóa huấn luyện cho thuyền viên;\nCăn cứ kế hoạch mở lớp và danh sách đăng ký học viên của Trung tâm Đào tạo phát triển nguồn lực;\nTheo đề nghị của Trưởng phòng Đào tạo.',
          article1:
            'Mở lớp huấn luyện nghiệp vụ {{CLASS_NAME}} cho {{STUDENT_COUNT}} học viên (Có danh sách kèm theo).',
          article2:
            'Giao cho Phòng Đào tạo chủ trì phối hợp với Trung tâm Đào tạo phát triển nguồn lực và các đơn vị liên quan tổ chức thực hiện kế hoạch giảng dạy, quản lý lớp học theo đúng quy chế hiện hành.',
          article3:
            'Các Ông (Bà) Trưởng phòng Đào tạo, Tài chính - Kế toán, Giám đốc Trung tâm Đào tạo phát triển nguồn lực, thủ trưởng các đơn vị có liên quan và các học viên có tên tại Điều 1 căn cứ Quyết định thi hành./.',
          recipients: '- Như Điều 3;\n- Lưu: VT, ĐT.',
          signerTitle: signerName || 'HIỆU TRƯỞNG',
          signerName: '',
        }
      : {
          headerLine1: 'CỤC HÀNG HẢI VÀ ĐƯỜNG THỦY VIỆT NAM',
          headerLine2: 'TRƯỜNG CAO ĐẲNG',
          headerLine3: 'HÀNG HẢI VÀ ĐƯỜNG THỦY I',
          nation: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
          motto: 'Độc lập - Tự do - Hạnh phúc',
          title: 'QUYẾT ĐỊNH',
          subtitle: 'Về việc cấp Giấy chứng nhận huấn luyện nghiệp vụ',
          subtext: '{{CLASS_NAME}}',
          course: '{{TRAINING_COURSE}}',
          authority: 'HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I',
          preamble:
            'Căn cứ Quyết định số 638/QĐ-BGTVT ngày 24 tháng 05 năm 2024 của Bộ trưởng Bộ Giao thông vận tải;\nCăn cứ kết quả học tập, kiểm tra kết thúc khóa huấn luyện;\nTheo đề nghị của Trưởng phòng Đào tạo.',
          article1:
            'Công nhận kết quả học tập và cấp Giấy chứng nhận huấn luyện nghiệp vụ {{CLASS_NAME}} cho {{STUDENT_COUNT}} học viên (Có danh sách kèm theo).',
          article2: 'Quyết định này có hiệu lực kể từ ngày ký.',
          article3:
            'Các Ông (Bà) Trưởng phòng Đào tạo, Tài chính - Kế toán, Giám đốc Trung tâm Đào tạo phát triển nguồn lực và các học viên có tên tại Điều 1 căn cứ Quyết định thi hành./.',
          recipients: '- Như Điều 3;\n- Lưu: VT, ĐT.',
          signerTitle: signerName || 'HIỆU TRƯỞNG',
          signerName: '',
        };

    const tplType = isOpening ? 'decision' : 'recognition';
    const serverTemplate = printTemplates?.find((t: any) => t.type === tplType);
    const mergedTpl: any = { ...defaultTpl, ...(serverTemplate?.content || {}) };

    const replaceMap: Record<string, string> = {
      '{{CLASS_NAME}}': className || '...',
      '{{TRAINING_COURSE}}': trainingCourse ? `Khóa: ${trainingCourse}` : '',
      '{{STUDENT_COUNT}}': String(tempStudents.length),
      '{{DECISION_NUMBER}}': decisionNumber || '...',
      '{{DATE}}': dateText,
    };

    Object.keys(mergedTpl).forEach((k) => {
      if (typeof mergedTpl[k] === 'string') {
        let text = mergedTpl[k] as string;
        Object.keys(replaceMap).forEach((ph) => {
          text = text.split(ph).join(replaceMap[ph]);
        });
        mergedTpl[k] = text;
      }
    });

    const studentRows = tempStudents
      .map(
        (s, i) => `
      <tr>
        <td style="border:1px solid black;padding:4px;text-align:center;">${i + 1}</td>
        <td style="border:1px solid black;padding:4px;" class="uppercase bold">${s.fullName}</td>
        <td style="border:1px solid black;padding:4px;text-align:center;">${fmtNgay(s.dob)}</td>
        <td style="border:1px solid black;padding:4px;text-align:center;mso-number-format:'\\@';">${s.cardNumber || s.studentCode || ''}</td>
        <td style="border:1px solid black;padding:4px;">${s.hometown || s.address || ''}</td>
        <td style="border:1px solid black;padding:4px;">${s.notes || ''}</td>
      </tr>
    `,
      )
      .join('');

    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>${isOpening ? 'Quyết định Mở lớp' : 'Quyết định Công nhận'}</title>
          <style>
             body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.3; }
             table.layout-grid { width: 100%; border: none; }
             td.layout-cell { vertical-align: top; }
             .uppercase { text-transform: uppercase; }
             .bold { font-weight: bold; }
             .italic { font-style: italic; }
             .title { text-align: center; margin: 10px 0; }
             .content-block { text-align: justify; margin-bottom: 10px;} 
             .indent { text-indent: 25px; margin-bottom: 2px; }
             table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10pt; }
             table.data-table td, table.data-table th { border: 1px solid black; padding: 2px 4px; }
             @page { size: A4; margin: 2.0cm 2.0cm 2.0cm 2.5cm; }
          </style>
        </head>
        <body>
          <table class="layout-grid">
            <tr>
              <td class="layout-cell" style="text-align: center; width: 50%;">
                <div class="uppercase">${mergedTpl.headerLine1 || ''}</div>
                <div class="uppercase bold">${mergedTpl.headerLine2 || ''}</div>
                <div class="uppercase bold">${mergedTpl.headerLine3 || ''}</div>
                <div style="margin-top:5px;">Số: ${decisionNumber || '...'}</div>
              </td>
              <td class="layout-cell" style="text-align: center; width: 50%;">
                <div class="uppercase bold">${mergedTpl.nation || ''}</div>
                <div class="bold">${mergedTpl.motto || ''}</div>
                <div class="italic" style="margin-top:5px;">Hải Phòng, ${dateText}</div>
              </td>
            </tr>
          </table>
          <div class="title">
            <div class="uppercase bold" style="font-size: 14pt; margin-bottom: 2px;">${mergedTpl.title || ''}</div>
            <div class="bold" style="font-size: 13pt; margin-bottom: 2px;">${mergedTpl.subtitle || ''}</div>
            ${mergedTpl.subtext ? `<div style="font-size: 11pt; margin-bottom: 2px;">${mergedTpl.subtext}</div>` : ''}
            ${mergedTpl.course ? `<div class="bold" style="font-size: 12pt;">${mergedTpl.course}</div>` : ''}
          </div>
          ${mergedTpl.authority ? `<div class="uppercase bold" style="text-align:center; margin-bottom:15px; font-size:13pt;">${mergedTpl.authority}</div>` : ''}
          <div class="content-block">
             ${(mergedTpl.preamble || '')
               .split('\n')
               .map((l: string) => `<div class="indent" style="font-size:11pt; margin-bottom: 4px;">${l}</div>`)
               .join('')}
             <div style="text-align:center; font-weight:bold; font-size:13pt; margin: 15px 0;">QUYẾT ĐỊNH:</div>
             <div class="indent"><span class="bold">Điều 1.</span> ${(mergedTpl.article1 || '').replace(/\n/g, '<br/>')}</div>
             <div class="indent"><span class="bold">Điều 2.</span> ${mergedTpl.article2 || ''}</div>
             <div class="indent"><span class="bold">Điều 3.</span> ${mergedTpl.article3 || ''}</div>
          </div>
          <table class="layout-grid" style="margin-top: 20px;">
            <tr>
              <td class="layout-cell" style="text-align: left; width: 45%; padding-left: 10px; font-size: 10pt;">
                 <div class="bold italic">Nơi nhận:</div>
                 <div class="italic" style="white-space: pre-line;">${mergedTpl.recipients || ''}</div>
              </td>
              <td class="layout-cell" style="text-align: center; width: 55%;">
                <div class="uppercase bold" style="white-space: pre-line; margin-bottom: 50px;">${mergedTpl.signerTitle || ''}</div>
                <div class="uppercase bold">${mergedTpl.signerName || ''}</div>
              </td>
            </tr>
          </table>
          <br clear="all" style="page-break-before:always" />
          <div style="text-align: center; margin-bottom: 10px;">
            <div class="uppercase bold" style="font-size: 11pt;">DANH SÁCH HỌC VIÊN</div>
            <div class="bold" style="font-size: 10pt;">${className}</div>
            <div style="font-size: 9pt;">(Kèm theo Quyết định số ${decisionNumber} ${dateText})</div>
          </div>
          <table class="data-table">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="width:50px;">STT</th>
                <th>Họ và tên</th>
                <th style="width:100px;">Ngày sinh</th>
                <th style="width:120px;">Số CCCD</th>
                <th>Quê quán</th>
                <th style="width:100px;">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${studentRows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `QuyetDinh_${decisionNumber ? decisionNumber.replace(/\//g, '_') : 'Draft'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('Đã xuất file Quyết định (.doc)!');
  };

  // 5. Nút "In Phiếu ĐK" - In Phiếu đăng ký học hàng loạt (A5 Landscape)
  const inPhieuDangKyHoc = () => {
    if (tempStudents.length === 0) {
      message.warning('Không có học viên nào để in phiếu!');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Vui lòng cho phép Pop-ups trên trình duyệt để in phiếu.');
      return;
    }
    const { className, trainingCourse } = getModalFormContext();
    const group = trainingCourse || className;

    const formsHtml = tempStudents
      .map((student) => {
        const formattedDob = fmtNgay(student.dob);
        return `
        <div class="page-break">
          <div class="header-right">
            ${student.photo ? '<img src="' + student.photo + '" alt="Ảnh 3x4" />' : 'Ảnh 3x4'}
          </div>
          <div class="header-left">
            <div class="agency">CỤC HÀNG HẢI VÀ ĐƯỜNG THUỶ VIỆT NAM</div>
            <div class="school">TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THUỶ I</div>
          </div>
          <div class="title">PHIẾU ĐĂNG KÝ HỌC</div>
          <div class="content">
            <div class="info-row">
              <span class="label">Họ và tên:</span>
              <span class="value"><b>${(student.fullName || '').toUpperCase()}</b></span>
            </div>
            <div class="info-row" style="margin-bottom: -4px;">
              <span class="label">Ngày, tháng, năm sinh:</span>
              <span class="value">${formattedDob || ''}</span>
            </div>
            <div style="line-height: 1.25; margin-top: 4px;">
              <div class="row-group-flex">
                <span class="label">Nơi sinh:</span>
                <span class="value" style="flex: 1.5">${student.hometown || ''}</span>
                <span class="label" style="margin-left: 10px;">Số CCCD:</span>
                <span class="value" style="flex: 1.5">${student.cardNumber || student.studentCode || ''}</span>
              </div>
              <div class="row-group-flex">
                <span class="label">Dân tộc:</span>
                <span class="value" style="flex: 1.5">Kinh</span>
                <span class="label" style="margin-left: 10px;">Quốc tịch:</span>
                <span class="value" style="flex: 1.5">Việt Nam</span>
              </div>
              <div class="info-row">
                <span class="label">Số điện thoại liên lạc:</span>
                <span class="value">${student.phone || ''}</span>
              </div>
              <div class="info-row">
                <span class="label">Đơn vị công tác:</span>
                <span class="value"></span>
              </div>
              <div class="info-row">
                <span class="label">Địa chỉ thường trú:</span>
                <span class="value">${student.address || student.hometown || ''}</span>
              </div>
              <div class="info-row">
                <span class="label">Đăng ký học:</span>
                <span class="value"><b>${group || ''}</b></span>
              </div>
            </div>
          </div>
          <div class="signature-section" style="margin-right: 15mm; margin-top: 14px; text-align: right;">
            <div style="display: inline-block; text-align: center;">
              <div style="font-weight: bold; font-style: italic;">Học viên (ký và ghi rõ họ tên)</div>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>In Phiếu Đăng Ký Học - ${group}</title>
      <style>
        @page { size: A5 landscape; margin: 0; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.3; margin: 0; padding: 0; background: #fff; color: #000; }
        .page-break { page-break-after: always; padding: 1.5cm 1.5cm 1.5cm 2cm; box-sizing: border-box; height: 100vh; position: relative; }
        .page-break:last-child { page-break-after: auto; }
        .header-right { float: right; width: 3cm; height: 4cm; border: 1px solid #777; display: flex; align-items: center; justify-content: center; color: red; font-size: 10pt; overflow: hidden; margin-left: 15px; margin-bottom: 10px; }
        .header-right img { width: 100%; height: 100%; object-fit: cover; }
        .header-left { text-align: center; font-size: 10pt; margin-bottom: 15px; }
        .header-left .agency { text-transform: uppercase; }
        .header-left .school { text-transform: uppercase; font-weight: bold; }
        .title { text-align: center; font-weight: bold; font-size: 14pt; margin: 0 0 15px 0; text-transform: uppercase; }
        .info-row { display: flex; margin-bottom: 6px; }
        .info-row .label { white-space: nowrap; min-width: fit-content; }
        .info-row .value { flex: 1; margin-left: 6px; border-bottom: 1px dotted #999; padding-bottom: 1px; }
        .row-group-flex { display: flex; margin-bottom: 6px; align-items: baseline; }
        .row-group-flex .value { margin-left: 6px; border-bottom: 1px dotted #999; padding-bottom: 1px; }
      </style>
    </head>
    <body>
      ${formsHtml}
      <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
    </body>
    </html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // 6. Nút "In thẻ" - In Thẻ học viên hàng loạt (A4 2 cột)
  const inTheHocVien = () => {
    if (tempStudents.length === 0) {
      message.warning('Không có học viên nào để in thẻ!');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Vui lòng cho phép Pop-ups trên trình duyệt để in thẻ.');
      return;
    }
    const { className, trainingCourse } = getModalFormContext();
    const courseLabel = trainingCourse || className || '...';

    const cardsHtml = tempStudents
      .map(
        (s) => `
      <div class="card">
        <div class="card-header">
          <div class="school-name">TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I</div>
          <div class="center-name">TRUNG TÂM ĐÀO TẠO VÀ PHÁT TRIỂN NGUỒN LỰC</div>
        </div>
        <div class="card-body">
           <div class="photo-box">
             ${s.photo ? `<img src="${s.photo}" alt="Photo" />` : '<span style="font-size:9pt;color:#999;">Ảnh 3x4</span>'}
           </div>
           <div class="info-section">
             <div class="card-type">THẺ HỌC VIÊN</div>
             <div class="student-name">${s.fullName}</div>
             <div class="separator"></div>
             <div class="info-grid">
                <div class="info-row">
                     <span class="label">Ngày sinh:</span>
                     <span class="value">${fmtNgay(s.dob)}</span>
                </div>
                <div class="info-row">
                    <span class="label">Lớp:</span>
                    <span class="value class-name">${courseLabel}</span>
                </div>
                <div class="info-row">
                    <span class="label">Mã HV:</span>
                    <span class="value">${s.studentCode || s.cardNumber || '...'}</span>
                </div>
             </div>
           </div>
        </div>
      </div>
    `,
      )
      .join('');

    const html = `
      <html>
        <head>
          <title>In Thẻ Học Viên</title>
          <style>
             body { font-family: 'Arial', sans-serif; padding: 0; background: #fff; margin: 0; }
             .card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; padding: 15px; max-width: 210mm; }
             .card { width: 340px; height: 220px; border: 1px solid #ccc; border-radius: 12px; overflow: hidden; background: white; box-sizing: border-box; position: relative; page-break-inside: avoid; margin: 0 auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
             .card-header { background-color: #15469e; color: white; text-align: center; padding: 5px 4px; height: 40px; display: flex; flex-direction: column; justify-content: center; }
             .school-name { font-size: 9pt; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
             .center-name { font-size: 7.5pt; font-weight: normal; text-transform: uppercase; }
             .card-body { padding: 17px 12px 10px 12px; display: flex; gap: 12px; height: calc(100% - 40px); align-items: flex-start; }
             .photo-box { width: 90px; height: 110px; border: 1px solid #e0e0e0; background: #f8f9fa; flex-shrink: 0; margin-top: 5px; display: flex; align-items: center; justify-content: center; }
             .photo-box img { width: 100%; height: 100%; object-fit: cover; }
             .info-section { flex: 1; display: flex; flex-direction: column; }
             .card-type { color: #d32f2f; font-weight: bold; font-size: 13pt; text-transform: uppercase; margin-bottom: 2px; }
             .student-name { color: #15469e; font-weight: bold; font-size: 12pt; text-transform: uppercase; line-height: 1.2; margin-bottom: 5px; }
             .separator { height: 1px; background-color: #a0c4ff; width: 100%; margin-bottom: 8px; }
             .info-grid { display: flex; flex-direction: column; gap: 4px; }
             .info-row { display: flex; font-size: 9pt; line-height: 1.3; }
             .label { color: #666; width: 65px; flex-shrink: 0; font-weight: normal; }
             .value { color: #000; font-weight: bold; flex: 1; }
             .class-name { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; font-size: 9pt; }
             @media print {
               @page { size: A4 portrait; margin: 1cm; }
               body { margin: 0; -webkit-print-color-adjust: exact; }
               .card { border: 1px solid #ccc; box-shadow: none; break-inside: avoid; }
               .card-header { -webkit-print-color-adjust: exact; background-color: #15469e !important; color: white !important; }
               .student-name { color: #15469e !important; }
               .card-type { color: #d32f2f !important; }
             }
          </style>
        </head>
        <body>
          <div class="card-grid">${cardsHtml}</div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // 7. Nút "DS Bàn giao" (RECOGNITION) - In Danh sách bàn giao giấy chứng nhận
  const inDanhSachBanGiao = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup.');
      return;
    }
    const { className, trainingCourse } = getModalFormContext();
    const sortedStudents = sortStudentsByFirstName(tempStudents);
    const dateNow = dayjs();
    const dateStr = `Ngày ${dateNow.format('DD')} tháng ${dateNow.format('MM')} năm ${dateNow.format('YYYY')}`;

    const rows = sortedStudents
      .map(
        (s, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="left uppercase bold">${s.fullName || ''}</td>
          <td class="center">${fmtNgay(s.dob)}</td>
          <td class="center">${s.hometown || ''}</td>
          <td class="center"></td>
          <td class="center">${s.notes || ''}</td>
        </tr>`,
      )
      .join('');

    const html = `<html>
      <head>
        <title>Danh Sách Bàn Giao Giấy Chứng Nhận</title>
        <style>
          @media print { @page { size: A4 landscape; margin: 15mm; } body { margin:0; } }
          body { font-family: 'Times New Roman', serif; background: #fff; }
          .title { text-align:center; font-size:15pt; font-weight:bold; margin:8px 0 4px; }
          .subtitle { text-align:center; font-size:13pt; font-weight:bold; margin-bottom:12px; }
          .header-table { width:100%; border-collapse:collapse; border:none; margin-bottom:8px; }
          .header-table td { border:none; padding:0; vertical-align:top; font-size:13pt; line-height:1.4; }
          table.data { width:100%; border-collapse:collapse; margin-top:8px; }
          table.data th, table.data td { border:1px solid #000; padding:6px 4px; font-size:11pt; height:34px; }
          table.data th { font-weight:bold; text-align:center; background:#fff; }
          .center { text-align:center; }
          .left { text-align:left; padding-left:10px !important; }
          .bold { font-weight:bold; }
          .uppercase { text-transform: uppercase; }
          .footer-table { width:100%; border:none; margin-top:18px; text-align:center; font-size:12pt; }
          .footer-table td { border:none; vertical-align:top; }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width:40%; text-align:center;">
              <div>TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I</div>
              <div class="bold">TT ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC</div>
            </td>
            <td style="width:60%; text-align:center;">
              <div class="bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div class="bold">Độc lập – Tự do – Hạnh phúc</div>
            </td>
          </tr>
        </table>
        <div class="title">DANH SÁCH BÀN GIAO GIẤY CHỨNG NHẬN</div>
        <div class="subtitle uppercase">LỚP: ${className || '...'} ${trainingCourse ? `– KHÓA: ${trainingCourse}` : ''}</div>
        <table class="data">
          <thead>
            <tr>
              <th style="width:45px;">STT</th>
              <th style="width:220px;">HỌ VÀ TÊN</th>
              <th style="width:110px;">NGÀY SINH</th>
              <th style="width:150px;">NƠI SINH</th>
              <th>KÝ VÀ GHI RÕ HỌ VÀ TÊN</th>
              <th style="width:120px;">GHI CHÚ</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <table class="footer-table">
          <tr>
            <td style="width:50%;" class="bold">BÊN NHẬN</td>
            <td style="width:50%;">
              <div style="font-style:italic; margin-bottom:4px;">Hải Phòng, ${dateStr}</div>
              <div class="bold">TRUNG TÂM ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC</div>
            </td>
          </tr>
        </table>
        <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
      </body>
    </html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // 8. Nút "DS Đề nghị" (RECOGNITION) - Xuất Danh sách đề nghị cấp GCN kèm điểm các môn
  const xuatDanhSachDeNghi = () => {
    const { classObj, className, trainingCourse, decisionNumber, signedDate, relOpenId } = getModalFormContext();
    const dt = dayjs(signedDate);
    const dateText = `ngày ${dt.date()} tháng ${dt.month() + 1} năm ${dt.year()}`;

    const matchingAssignment = assignments?.find((a: any) => {
      const decRel = a.decision?.data || a.decision;
      if (!decRel) return false;
      return (
        String(decRel.documentId || decRel.id || '') === String(relOpenId) ||
        String(decRel.strapiId || decRel.id || '') === String(relOpenId)
      );
    });

    let startDateText = '(Chưa xếp lịch học)';
    let endDateText = '(Chưa xếp lịch học)';
    if (matchingAssignment?.schedule?.length > 0) {
      const dates = matchingAssignment.schedule
        .map((r: any) => r.date)
        .filter(Boolean)
        .sort();
      if (dates.length > 0) {
        const d1 = dayjs(dates[0]);
        const d2 = dayjs(dates[dates.length - 1]);
        startDateText = `ngày ${d1.format('DD')} tháng ${d1.format('MM')} năm ${d1.format('YYYY')}`;
        endDateText = `ngày ${d2.format('DD')} tháng ${d2.format('MM')} năm ${d2.format('YYYY')}`;
      }
    }

    const defaultCertTpl = {
      headerLine1: 'CỤC HÀNG HẢI VÀ ĐƯỜNG THỦY VIỆT NAM',
      headerLine2: 'TRƯỜNG CAO ĐẲNG',
      headerLine3: 'HÀNG HẢI VÀ ĐƯỜNG THỦY I',
      nation: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
      motto: 'Độc lập - Tự do - Hạnh phúc',
      title: 'DANH SÁCH',
      subtitle: 'Đề nghị cấp giấy chứng nhận huấn luyện nghiệp vụ',
      preamble:
        'Lớp: {{CLASS_NAME}}\nKhóa: {{TRAINING_COURSE}}\nThời gian đào tạo: Từ {{START_DATE}} đến {{END_DATE}}',
      signerTitle: 'HIỆU TRƯỞNG',
      signerName: '',
      signerTitle2: 'PHỤ TRÁCH LẬP BẢNG',
      signerName2: '',
    };

    const serverTemplate = printTemplates?.find((t: any) => t.type === 'certificate_list');
    const content: any = { ...defaultCertTpl, ...(serverTemplate?.content || {}) };

    const replaceMap: Record<string, string> = {
      '{{CLASS_NAME}}': className || '...',
      '{{TRAINING_COURSE}}': trainingCourse || '...',
      '{{DATE}}': dateText,
      '{{START_DATE}}': startDateText,
      '{{END_DATE}}': endDateText,
    };

    Object.keys(content).forEach((k) => {
      if (typeof content[k] === 'string') {
        let text = content[k] as string;
        Object.keys(replaceMap).forEach((ph) => {
          text = text.split(ph).join(replaceMap[ph]);
        });
        content[k] = text;
      }
    });

    const subjectsList = normalizeStrapiList(classObj?.subjects || { data: classObj?.subjects || [] });
    const studentCodesForFallback = tempStudents.flatMap((s) => [s.studentCode, s.cardNumber]).filter(Boolean);
    const gradeRecord = findGradeRecordForDecision(
      String(relOpenId || ''),
      editingItem?.related_decision?.data?.id || editingItem?.related_decision?.id,
      studentCodesForFallback,
    );
    const subjectGrades = gradeRecord?.grades || {};

    const subjectHeaders = subjectsList
      .map(
        (subj: any) =>
          `<th style="border:1px solid black;padding:4px;text-align:center;font-size:9pt;">${subj.name}</th>`,
      )
      .join('');

    const sortedStudents = sortStudentsByFirstName(tempStudents);
    const studentRows = sortedStudents
      .map((s, i) => {
        const nameParts = s.fullName.trim().split(' ');
        const ten = nameParts.pop() || '';
        const ho = nameParts.join(' ');

        const subjectCells = subjectsList
          .map((subj: any) => {
            const subKey1 = String(subj.strapiId || subj.id);
            const subKey2 = String(subj.documentId || subj.id);
            const gradeObj =
              subjectGrades[subKey1]?.[s.studentCode] ||
              subjectGrades[subKey2]?.[s.studentCode] ||
              subjectGrades[subKey1]?.[s.cardNumber] ||
              subjectGrades[subKey2]?.[s.cardNumber];
            let displayGrade = '';
            if (gradeObj) {
              if (typeof gradeObj === 'object') {
                displayGrade =
                  gradeObj.theory !== undefined && gradeObj.theory !== null && gradeObj.theory !== ''
                    ? String(gradeObj.theory)
                    : gradeObj.practice !== undefined && gradeObj.practice !== null
                      ? String(gradeObj.practice)
                      : '';
              } else {
                displayGrade = String(gradeObj);
              }
            }
            return `<td style="border:1px solid black;padding:4px;text-align:center;">${displayGrade}</td>`;
          })
          .join('');

        return `
        <tr>
          <td style="border:1px solid black;padding:4px;text-align:center;">${i + 1}</td>
          <td style="border:1px solid black;padding:4px;" class="uppercase bold">${ho}</td>
          <td style="border:1px solid black;padding:4px;" class="uppercase bold">${ten}</td>
          <td style="border:1px solid black;padding:4px;text-align:center;">${fmtNgay(s.dob)}</td>
          <td style="border:1px solid black;padding:4px;text-align:center;mso-number-format:'\\@';">${s.cardNumber || s.studentCode || ''}</td>
          <td style="border:1px solid black;padding:4px;">${s.hometown || ''}</td>
          ${subjectCells}
          <td style="border:1px solid black;padding:4px;">${s.notes || ''}</td>
        </tr>
      `;
      })
      .join('');

    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>Danh sách đề nghị cấp GCN</title>
          <style>
             body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3; }
             table.layout-grid { width: 100%; border: none; margin-bottom: 20px; }
             td.layout-cell { vertical-align: top; }
             .uppercase { text-transform: uppercase; }
             .bold { font-weight: bold; }
             .italic { font-style: italic; }
             .title { text-align: center; margin: 10px 0; }
             table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9pt; }
             table.data-table td, table.data-table th { border: 1px solid black; padding: 4px; }
             @page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 1.5cm; }
             div.Section1 { page: Section1; }
          </style>
        </head>
        <body>
          <div class="Section1">
            <table class="layout-grid">
              <tr>
                <td class="layout-cell" style="text-align: center; width: 45%;">
                  <div class="uppercase">${content.headerLine1}</div>
                  <div class="bold uppercase">${content.headerLine2}</div>
                  <div class="bold uppercase">${content.headerLine3}</div>
                </td>
                <td class="layout-cell" style="text-align: center; width: 55%;">
                  <div class="uppercase bold">${content.nation}</div>
                  <div class="bold">${content.motto}</div>
                  <div class="italic" style="margin-top:5px;">Hải Phòng, ${dateText}</div>
                </td>
              </tr>
            </table>
            <div class="title">
              <div class="uppercase bold" style="font-size: 14pt;">${content.title}</div>
              <div class="uppercase bold" style="font-size: 12pt;">${content.subtitle}</div>
              <div class="bold" style="white-space: pre-line; margin-top: 5px;">${content.preamble}</div>
            </div>
            <table class="data-table">
              <thead>
                <tr style="background-color: #f2f2f2;">
                  <th style="width:30px;">STT</th>
                  <th colspan="2">HỌ VÀ TÊN</th>
                  <th style="width:80px;">NGÀY SINH</th>
                  <th style="width:100px;">SỐ CCCD</th>
                  <th>NƠI SINH</th>
                  ${subjectHeaders}
                  <th style="width:80px;">GHI CHÚ</th>
                </tr>
              </thead>
              <tbody>${studentRows}</tbody>
            </table>
            <table class="layout-grid" style="margin-top: 30px;">
              <tr>
                <td class="layout-cell" style="text-align: center; width: 50%;">
                  <div class="uppercase bold" style="white-space: pre-line; margin-bottom: 60px;">${content.signerTitle2}</div>
                  <div class="uppercase bold">${content.signerName2}</div>
                </td>
                <td class="layout-cell" style="text-align: center; width: 50%;">
                  <div class="uppercase bold" style="white-space: pre-line; margin-bottom: 60px;">${content.signerTitle}</div>
                  <div class="uppercase bold">${content.signerName}</div>
                </td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DS_DeNghi_${decisionNumber ? decisionNumber.replace(/\//g, '_') : 'Draft'}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('Đã xuất Danh sách đề nghị cấp GCN!');
  };

  // 9. Nút "Lịch phân công" (RECOGNITION) - Xuất Excel lịch phân công huấn luyện của lớp
  const xuatLichPhanCongExcel = async () => {
    const { className, trainingCourse, relOpenId } = getModalFormContext();
    const matchingAssignment = assignments?.find((a: any) => {
      const decRel = a.decision?.data || a.decision;
      if (!decRel) return false;
      return (
        String(decRel.documentId || decRel.id || '') === String(relOpenId) ||
        String(decRel.strapiId || decRel.id || '') === String(relOpenId)
      );
    });

    if (!matchingAssignment || !matchingAssignment.schedule || matchingAssignment.schedule.length === 0) {
      message.warning('Chưa có lịch phân công huấn luyện cho lớp này. Vui lòng lập lịch trong mục "Phân công giảng dạy" trước.');
      return;
    }

    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Lịch Phân Công');

      worksheet.mergeCells('A1:C1');
      worksheet.getCell('A1').value = 'TRƯỜNG CAO ĐẲNG';
      worksheet.getCell('A1').font = { name: 'Times New Roman', size: 11 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('D1:G1');
      worksheet.getCell('D1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
      worksheet.getCell('D1').font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell('D1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:C2');
      worksheet.getCell('A2').value = 'HÀNG HẢI VÀ ĐƯỜNG THỦY I';
      worksheet.getCell('A2').font = { name: 'Times New Roman', size: 11 };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.mergeCells('D2:G2');
      worksheet.getCell('D2').value = 'Độc lập – Tự do – Hạnh phúc';
      worksheet.getCell('D2').font = { name: 'Times New Roman', size: 11, bold: true, italic: true };
      worksheet.getCell('D2').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A3:C3');
      worksheet.getCell('A3').value = 'TT ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC';
      worksheet.getCell('A3').font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell('A3').alignment = { horizontal: 'center' };

      worksheet.getRow(5).height = 24;
      worksheet.mergeCells('A5:G5');
      worksheet.getCell('A5').value = 'LỊCH PHÂN CÔNG HUẤN LUYỆN';
      worksheet.getCell('A5').font = { name: 'Times New Roman', size: 14, bold: true };
      worksheet.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.getRow(6).height = 18;
      worksheet.mergeCells('A6:G6');
      worksheet.getCell('A6').value = `Lớp: ${(className || '').toUpperCase()}${trainingCourse ? ` – Khóa: ${trainingCourse}` : ''}`;
      worksheet.getCell('A6').font = { name: 'Times New Roman', size: 12, bold: true };
      worksheet.getCell('A6').alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.columns = [
        { key: 'stt', width: 6 },
        { key: 'date', width: 14 },
        { key: 'weekday', width: 10 },
        { key: 'shift', width: 10 },
        { key: 'subject', width: 36 },
        { key: 'teacher', width: 26 },
        { key: 'notes', width: 20 },
      ];

      worksheet.getRow(8).height = 30;
      const headerRow = worksheet.getRow(8);
      ['STT', 'NGÀY', 'THỨ', 'CA HỌC', 'MÔN HỌC', 'GIẢNG VIÊN', 'GHI CHÚ'].forEach((label, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = label;
        cell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5EA8' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      const shiftOrder: Record<string, number> = { 'Sáng': 0, 'Chiều': 1, 'Tối': 2 };
      const weekdayNames = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const sortedSchedule = [...matchingAssignment.schedule].sort((a: any, b: any) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return (shiftOrder[a.shift] ?? 99) - (shiftOrder[b.shift] ?? 99);
      });

      let schedCurrentRow = 9;
      sortedSchedule.forEach((row: any, idx: number) => {
        const dataRow = worksheet.getRow(schedCurrentRow);
        dataRow.height = 18;
        const weekday = row.date ? weekdayNames[new Date(row.date + 'T00:00:00').getDay()] || '' : '';
        dataRow.getCell(1).value = idx + 1;
        dataRow.getCell(2).value = fmtNgay(row.date);
        dataRow.getCell(3).value = weekday;
        dataRow.getCell(4).value = row.shift || '';
        dataRow.getCell(5).value = row.subjectName || '';
        dataRow.getCell(6).value = row.teacherName || '';
        dataRow.getCell(7).value = row.notes || '';

        const fillArgb = idx % 2 === 0 ? 'FFFAFAFA' : 'FFE8F4FE';
        for (let c = 1; c <= 7; c++) {
          const cell = dataRow.getCell(c);
          cell.font = { name: 'Times New Roman', size: 11 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = c <= 4 ? { horizontal: 'center', vertical: 'middle' } : { horizontal: 'left', vertical: 'middle', indent: 1 };
        }
        schedCurrentRow++;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const { saveAs } = await import('file-saver');
      saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `LichPhanCong_${(trainingCourse || className || 'Lop').replace(/[/\\?%*:|"<>]/g, '_')}.xlsx`,
      );
      message.success('Đã xuất Excel Lịch phân công huấn luyện!');
    } catch {
      message.error('Có lỗi khi xuất Excel lịch phân công.');
    }
  };

  // ============================================================
  // Tải file mẫu Excel import
  // ============================================================
  const taiFileMau = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Danh sách');
    ws.columns = [
      { header: 'Số QĐ', key: 'so_qd', width: 14 },
      { header: 'Tên lớp', key: 'ten_lop', width: 30 },
      { header: 'Đợt/Khóa', key: 'dot_khoa', width: 18 },
      { header: 'Ngày ký (dd/mm/yyyy)', key: 'ngay_ky', width: 22 },
      { header: 'Người ký', key: 'nguoi_ky', width: 18 },
      { header: 'Họ và tên HV', key: 'ho_ten', width: 26 },
      { header: 'Ngày sinh (dd/mm/yyyy)', key: 'ngay_sinh', width: 22 },
      { header: 'Giới tính (Nam/Nữ)', key: 'gioi_tinh', width: 18 },
      { header: 'Số CMND/CCCD', key: 'so_cmnd', width: 18 },
      { header: 'Mã học viên', key: 'ma_hv', width: 16 },
      { header: 'Quê quán', key: 'que_quan', width: 28 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 24 },
    ];
    const hRow = ws.getRow(1);
    hRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    hRow.height = 30;
    const sampleRows = [
      { so_qd: '0202', ten_lop: 'HUẤN LUYỆN NGHIỆP VỤ CƠ BẢN', dot_khoa: 'BTC-K1/2026', ngay_ky: '12/03/2026', nguoi_ky: 'HIỆU TRƯỞNG', ho_ten: 'NGUYỄN VĂN AN', ngay_sinh: '15/05/1990', gioi_tinh: 'Nam', so_cmnd: '001234567890', ma_hv: 'HV001', que_quan: 'Hải Phòng', ghi_chu: '' },
      { so_qd: '0202', ten_lop: 'HUẤN LUYỆN NGHIỆP VỤ CƠ BẢN', dot_khoa: 'BTC-K1/2026', ngay_ky: '12/03/2026', nguoi_ky: 'HIỆU TRƯỞNG', ho_ten: 'TRẦN THỊ BÌNH', ngay_sinh: '20/08/1992', gioi_tinh: 'Nữ', so_cmnd: '001234567891', ma_hv: 'HV002', que_quan: 'Hà Nội', ghi_chu: '' },
      { so_qd: '0203', ten_lop: 'HUẤN LUYỆN AN TOÀN CÁ NHÂN', dot_khoa: 'BTC-K2/2026', ngay_ky: '15/03/2026', nguoi_ky: 'HIỆU TRƯỞNG', ho_ten: 'PHẠM VĂN DŨNG', ngay_sinh: '10/03/1995', gioi_tinh: 'Nam', so_cmnd: '001234567893', ma_hv: 'HV004', que_quan: 'Nam Định', ghi_chu: '' },
    ];
    sampleRows.forEach(r => {
      const row = ws.addRow(r);
      row.eachCell(cell => {
        cell.alignment = { vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
    });
    const noteRow = ws.addRow([]);
    noteRow.getCell(1).value = '⚠️ Hướng dẫn: Cùng Số QĐ = Cùng 1 quyết định. Mỗi dòng là 1 học viên. Các lớp khác nhau thì dùng Số QĐ khác nhau.';
    noteRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' }, size: 9 };
    ws.mergeCells(`A${noteRow.number}:L${noteRow.number}`);
    const buf = await wb.xlsx.writeBuffer();
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'mau_import_quyet_dinh.xlsx');
  };

  // ============================================================
  // Import Excel
  // ============================================================
  const parseDateToISO = (raw: any): string => {
    if (!raw) return '';
    if (typeof raw === 'number') {
      // Excel serial date
      const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
      return d.toISOString().split('T')[0];
    }
    const str = String(raw).trim();
    // dd/mm/yyyy
    const parts = str.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
    // yyyy-mm-dd already
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
    return str;
  };

  const handleImportFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];
      const rows: any[] = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values = row.values as any[];
        const soQd = String(values[1] ?? '').trim();
        const tenLop = String(values[2] ?? '').trim();
        if (!soQd && !tenLop) return;
        rows.push({
          so_qd: soQd,
          ten_lop: tenLop,
          dot_khoa: String(values[3] ?? '').trim(),
          ngay_ky: parseDateToISO(values[4] ?? ''),
          nguoi_ky: String(values[5] ?? '').trim(),
          ho_ten: String(values[6] ?? '').trim(),
          ngay_sinh: parseDateToISO(values[7] ?? ''),
          gioi_tinh: String(values[8] ?? '').trim(),
          so_cmnd: String(values[9] ?? '').trim(),
          ma_hv: String(values[10] ?? '').trim(),
          que_quan: String(values[11] ?? '').trim(),
          ghi_chu: String(values[12] ?? '').trim(),
        });
      });
      setImportRows(rows);
      setMoImportModal(true);
    } catch {
      message.error('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng file.');
    }
    return false; // prevent antd auto-upload
  };

  const handleConfirmImport = async () => {
    if (!importRows.length) return;
    setImportLoading(true);
    let successCount = 0;
    let errorCount = 0;

    const grouped = new Map<string, any[]>();
    importRows.forEach(row => {
      if (!grouped.has(row.so_qd)) grouped.set(row.so_qd, []);
      grouped.get(row.so_qd)!.push(row);
    });

    for (const [soQd, rowGroup] of Array.from(grouped.entries())) {
      try {
        const firstRow = rowGroup[0];
        const signedDate = firstRow.ngay_ky || new Date().toISOString().split('T')[0];
        const currentYear = new Date(signedDate).getFullYear();

        // Check duplicate
        const dupRes = await api<any>(
          `/${COLLECTIONS.CLASS_DECISIONS}?filters[decision_number][$eq]=${encodeURIComponent(soQd)}&publicationState=preview`,
        );
        const dupList = normalizeStrapiList(dupRes);
        const isDup = dupList.some((d: any) => {
          if (!d.signed_date) return false;
          return new Date(d.signed_date).getFullYear() === currentYear;
        });
        if (isDup) { errorCount++; continue; }

        // Find matching class
        const matchedClass = danhSachLop?.find(
          (c: any) => (c.name || '').toLowerCase().trim() === (firstRow.ten_lop || '').toLowerCase().trim(),
        );

        const payload: any = {
          decision_number: soQd,
          type: mode,
          training_course: firstRow.dot_khoa,
          signed_date: signedDate,
          signer_name: firstRow.nguoi_ky || 'HIỆU TRƯỞNG',
          notes: firstRow.ghi_chu,
          students: [],
          publishedAt: new Date().toISOString(),
        };
        if (matchedClass) payload.school_class = Number(matchedClass.strapiId || matchedClass.id);

        await api(`/${COLLECTIONS.CLASS_DECISIONS}`, { method: 'POST', body: { data: payload } });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setImportLoading(false);
    setMoImportModal(false);
    setImportRows([]);
    qc.invalidateQueries({ queryKey: ['decisions-list'] });
    modal.info({
      title: 'Import hoàn tất',
      content: `✅ Thành công: ${successCount} quyết định\n❌ Thất bại/Trùng: ${errorCount} quyết định`,
    });
  };

  // ============================================================
  // Expandable row render
  // ============================================================
  const renderExpandedRow = (record: any) => {
    const docId = record.documentId || record.id;
    const isLoading = expandedLoading[docId];
    const students: StudentDetail[] = expandedStudents[docId] || [];

    if (isLoading) return <Spin tip="Đang tải danh sách học viên..." />;

    const cols: TableProps<StudentDetail>['columns'] = [
      { title: 'STT', width: 50, align: 'center', render: (_, __, i) => i + 1 },
      {
        title: 'Họ tên',
        dataIndex: 'fullName',
        render: (v: string) => <b>{v}</b>,
      },
      { title: 'Giới tính', dataIndex: 'gender', width: 90, align: 'center' },
      {
        title: 'Ngày sinh',
        dataIndex: 'dob',
        width: 110,
        render: (v: string) => fmtNgay(v),
      },
      {
        title: 'Số CCCD',
        dataIndex: 'cardNumber',
        width: 140,
        render: (v: string, r: StudentDetail) => v || r.studentCode,
      },
      {
        title: 'Địa chỉ / Đơn vị',
        dataIndex: 'address',
        render: (v: string, r: StudentDetail) => v || r.hometown,
      },
      {
        title: 'Điểm thi',
        key: 'grades',
        width: 110,
        align: 'center',
        render: (_: any, r: StudentDetail) => (
          <Button
            size="small"
            type="primary"
            ghost
            icon={<TrophyOutlined />}
            onClick={() => {
              const cls = record.school_class?.data || record.school_class;
              const classId = cls?.documentId || cls?.id || null;
              const relDecObj = record.related_decision?.data || record.related_decision;
              const relId = record.relatedOpeningId || relDecObj?.documentId || relDecObj?.id || '';
              setEditingItem(record);
              setLopDuocChon(classId);
              setRelatedOpeningId(String(relId));
              setViewingGradeStudent(r);
            }}
          >
            Xem điểm
          </Button>
        ),
      },
      {
        title: 'Hồ sơ',
        key: 'docs',
        width: 95,
        align: 'center',
        render: (_: any, r: StudentDetail) => (
          <Button
            size="small"
            icon={<PaperClipOutlined />}
            onClick={() => setViewingDocsStudent(r)}
          >
            {r.documents?.length || 0} file
          </Button>
        ),
      },
      {
        title: 'Thao tác',
        key: 'actions',
        width: 90,
        align: 'center',
        render: (_: any, r: StudentDetail, idx: number) => (
          <Space size={4}>
            <Tooltip title="Sửa thông tin HV">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  // Open in modal edit form for this decision
                  setTempStudents(students);
                  setEditingItem(record);
                  moSuaHocVien(r, idx);
                }}
              />
            </Tooltip>
          </Space>
        ),
      },
    ];

    return (
      <div style={{ padding: '8px 24px', background: '#fafafa' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
          <Text strong>
            Danh sách học viên{' '}
            <Tag color="blue">{students.length} học viên</Tag>
          </Text>
          <Space>
            <Tooltip title="Tải ảnh 3x4 ZIP">
              <Button
                size="small"
                icon={<FileZipOutlined />}
                onClick={() => taiAnh3x4(students, record.decision_number || '')}
              >
                Tải ảnh 3x4
              </Button>
            </Tooltip>
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingItem(record);
                setLopDuocChon(record.school_class?.documentId || record.school_class?.id || null);
                setTempStudents(students);
                moPickerHocVien(record);
              }}
            >
              Thêm học viên
            </Button>
          </Space>
        </div>
        <Table
          dataSource={students}
          columns={cols}
          rowKey={r => r.id}
          size="small"
          pagination={false}
          locale={{ emptyText: 'Chưa có học viên nào' }}
        />
      </div>
    );
  };

  // ============================================================
  // Columns
  // ============================================================
  const columns: TableProps<any>['columns'] = [
    { title: 'STT', width: 55, align: 'center', render: (_, __, i) => (trang - 1) * kichThuocTrang + i + 1 },
    {
      title: 'Số quyết định',
      dataIndex: 'decision_number',
      key: 'decision_number',
      width: 165,
      render: (v: string, r: any) => {
        const id = String(r.documentId || r.id);
        const locked = checkIfLocked(id);
        return (
          <Space size={4}>
            {locked && (
              <Tooltip title="Đã có QĐ công nhận tốt nghiệp liên kết">
                <LockOutlined style={{ color: '#faad14' }} />
              </Tooltip>
            )}
            <Tag color={isOpening ? 'blue' : 'gold'}>{v || '---'}</Tag>
          </Space>
        );
      },
    },
    {
      title: 'Lớp học & Khóa học',
      key: 'lop',
      render: (_: any, r: any) => (
        <div>
          <b>{r.school_class?.name || '---'}</b>
          {r.training_course && <div style={{ fontSize: 12, color: '#64748b' }}>Đợt/Khóa: {r.training_course}</div>}
        </div>
      ),
    },
    {
      title: 'Ngày ký',
      dataIndex: 'signed_date',
      key: 'signed_date',
      width: 115,
      render: (v: string) => fmtNgay(v) || '---',
    },
    {
      title: 'Số học viên',
      key: 'students_count',
      width: 110,
      align: 'center',
      render: (_: any, r: any) => {
        const count = r.students?.length ?? 0;
        return <Tag color={count > 0 ? 'green' : 'default'}>{count} học viên</Tag>;
      },
    },
    {
      title: 'Người ký',
      dataIndex: 'signer_name',
      key: 'signer_name',
      width: 145,
      render: (v: string) => v || 'HIỆU TRƯỞNG',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 155,
      align: 'center',
      render: (_: any, r: any) => {
        const id = String(r.documentId || r.id);
        const locked = checkIfLocked(id);
        return (
          <Space size={4}>
            {locked && (
              <Tooltip title="Mở khóa (xóa QĐ công nhận liên kết)">
                <Button
                  size="small"
                  icon={<UnlockOutlined />}
                  onClick={() => handleClickEdit(r)}
                />
              </Tooltip>
            )}
            <Tooltip title="In quyết định">
              <Button
                size="small"
                icon={<PrinterOutlined />}
                onClick={() => {
                  const svList = expandedStudents[id] || r.students || [];
                  inQuyetDinh(r, svList);
                }}
              />
            </Tooltip>
            <Tooltip title="Chỉnh sửa">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<EditOutlined />}
                onClick={() => handleClickEdit(r)}
              />
            </Tooltip>
            <Popconfirm
              title={locked ? 'Quyết định này đã bị khóa. Vẫn xóa?' : 'Xác nhận xóa quyết định này?'}
              onConfirm={() => xoaMut.mutate(r.documentId || r.id)}
              disabled={locked}
            >
              <Button size="small" danger icon={<DeleteOutlined />} disabled={locked} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  // ============================================================
  // Filtered picker students
  // ============================================================
  const filteredPickerStudents = pickerStudents.filter(s => {
    if (!pickerSearch) return true;
    const name = (s.full_name || s.fullName || '').toLowerCase();
    const cccd = (s.id_number || s.card_number || '').toLowerCase();
    const q = pickerSearch.toLowerCase();
    return name.includes(q) || cccd.includes(q);
  });

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <Card className="card-mem">
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Space>
          <Input.Search
            placeholder="Tìm theo số QĐ, tên lớp, khóa..."
            allowClear
            onSearch={v => { setTuKhoa(v.trim()); setTrang(1); }}
            style={{ width: 300 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['decisions-list'] })}>
            Làm mới
          </Button>
        </Space>
        <Space>
          <Tooltip title="Xem lịch sử thao tác">
            <Button icon={<HistoryOutlined />} onClick={() => setMoAuditModal(true)}>
              Lịch sử
            </Button>
          </Tooltip>
          <Tooltip title="Tải file mẫu Excel">
            <Button icon={<DownloadOutlined />} onClick={taiFileMau}>
              Mẫu Excel
            </Button>
          </Tooltip>
          <Upload beforeUpload={(file) => { handleImportFile(file); return false; }} showUploadList={false} accept=".xlsx,.xls">
            <Button icon={<UploadOutlined />}>Import Excel</Button>
          </Upload>
          <Button icon={<FileExcelOutlined />} onClick={xuatExcel}>
            Xuất Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={moThemMoi}>
            {isOpening ? 'Tạo QĐ mở lớp' : 'Tạo QĐ công nhận'}
          </Button>
        </Space>
      </div>

      {/* Main Table */}
      <Table
        dataSource={queryQuyetDinh.data?.items ?? []}
        columns={columns}
        rowKey={r => r.documentId || r.id}
        loading={queryQuyetDinh.isFetching}
        locale={{ emptyText: <Empty description="Chưa có quyết định nào" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        expandable={{
          expandedRowRender: renderExpandedRow,
          onExpand: handleExpand,
        }}
        pagination={{
          current: trang,
          pageSize: kichThuocTrang,
          total: queryQuyetDinh.data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: ['15', '30', '50'],
          onChange: (p, ps) => { setTrang(p); setKichThuocTrang(ps); },
        }}
      />

      {/* ======================================================
          Modal Thêm / Sửa Quyết định
      ====================================================== */}
      <Modal
        title={
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              paddingRight: 28,
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {isLockedViewMode
                  ? `🔒 Xem thông tin (Chỉ xem) - ${tieuDeLoai}`
                  : isOpening
                    ? 'Lập Quyết định Mở lớp'
                    : 'Lập Quyết định Công nhận'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>
                {editingItem
                  ? `Chỉnh sửa • ${editingItem.decision_number || ''}`
                  : 'Tạo quyết định mới'}
              </div>
            </div>
            <Space size={6} wrap>
              {isOpening ? (
                <>
                  <Button
                    size="small"
                    icon={<FileExcelOutlined />}
                    style={{ background: '#059669', borderColor: '#059669', color: '#fff', fontWeight: 600 }}
                    onClick={xuatBangKeHocPhi}
                  >
                    Bảng kê
                  </Button>
                  <Button
                    size="small"
                    icon={<FileTextOutlined />}
                    style={{ background: '#d97706', borderColor: '#d97706', color: '#fff', fontWeight: 600 }}
                    onClick={inBienBanBanGiaoTaiLieu}
                  >
                    BG Tài Liệu
                  </Button>
                  <Button
                    size="small"
                    icon={<FileExcelOutlined />}
                    style={{ background: '#059669', borderColor: '#059669', color: '#fff', fontWeight: 600 }}
                    onClick={xuatExcelDanhSachHocVien}
                  >
                    Xuất Excel
                  </Button>
                  <Button
                    size="small"
                    icon={<PrinterOutlined />}
                    style={{ background: '#475569', borderColor: '#475569', color: '#fff', fontWeight: 600 }}
                    onClick={xuatWordQuyetDinh}
                  >
                    Xuất QĐ
                  </Button>
                  <Button
                    size="small"
                    icon={<PrinterOutlined />}
                    style={{ background: '#4f46e5', borderColor: '#4f46e5', color: '#fff', fontWeight: 600 }}
                    onClick={inPhieuDangKyHoc}
                  >
                    In Phiếu ĐK
                  </Button>
                  <Button
                    size="small"
                    icon={<IdcardOutlined />}
                    style={{ background: '#4f46e5', borderColor: '#4f46e5', color: '#fff', fontWeight: 600 }}
                    onClick={inTheHocVien}
                  >
                    In thẻ
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="small"
                    icon={<PrinterOutlined />}
                    style={{ background: '#2563eb', borderColor: '#2563eb', color: '#fff', fontWeight: 600 }}
                    onClick={inDanhSachBanGiao}
                  >
                    DS Bàn giao
                  </Button>
                  <Button
                    size="small"
                    icon={<FileExcelOutlined />}
                    style={{ background: '#059669', borderColor: '#059669', color: '#fff', fontWeight: 600 }}
                    onClick={xuatExcelDanhSachHocVien}
                  >
                    Xuất Excel
                  </Button>
                  <Button
                    size="small"
                    icon={<PrinterOutlined />}
                    style={{ background: '#475569', borderColor: '#475569', color: '#fff', fontWeight: 600 }}
                    onClick={xuatWordQuyetDinh}
                  >
                    Xuất QĐ
                  </Button>
                  <Button
                    size="small"
                    icon={<FileTextOutlined />}
                    style={{ background: '#9333ea', borderColor: '#9333ea', color: '#fff', fontWeight: 600 }}
                    onClick={xuatDanhSachDeNghi}
                  >
                    DS Đề nghị
                  </Button>
                  <Button
                    size="small"
                    icon={<CalendarOutlined />}
                    style={{ background: '#0d9488', borderColor: '#0d9488', color: '#fff', fontWeight: 600 }}
                    onClick={xuatLichPhanCongExcel}
                  >
                    Lịch phân công
                  </Button>
                  <Button
                    size="small"
                    icon={<FileZipOutlined />}
                    style={{ background: '#7c3aed', borderColor: '#7c3aed', color: '#fff', fontWeight: 600 }}
                    onClick={() => taiAnh3x4(tempStudents, form.getFieldValue('decision_number') || editingItem?.decision_number || '')}
                  >
                    Tải ảnh 3x4
                  </Button>
                </>
              )}
              {!isLockedViewMode && (
                <Button
                  size="small"
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={luuMut.isPending}
                  style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700 }}
                  onClick={() => form.submit()}
                >
                  Lưu
                </Button>
              )}
            </Space>
          </div>
        }
        open={moModal}
        width={1080}
        onCancel={() => { setMoModal(false); stopCamera(); }}
        onOk={isLockedViewMode ? undefined : () => form.submit()}
        confirmLoading={luuMut.isPending}
        okText={isLockedViewMode ? undefined : 'Lưu quyết định'}
        okButtonProps={isLockedViewMode ? { style: { display: 'none' } } : undefined}
        cancelText="Đóng"
        forceRender
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ signed_date: dayjs(), signer_name: 'HIỆU TRƯỞNG' }}
          onFinish={v => luuMut.mutate(v)}
          onFinishFailed={(errInfo) => {
            const firstErr = errInfo.errorFields?.[0]?.errors?.[0];
            if (firstErr) message.warning(firstErr);
          }}
          style={{ marginTop: 16 }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="decision_number"
                label="Số quyết định"
                rules={[{ required: true, message: 'Nhập số quyết định' }]}
              >
                <Input placeholder="Vd: 125/QĐ-CĐHH" disabled={isLockedViewMode} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="signed_date" label="Ngày ký" rules={[{ required: true, message: 'Chọn ngày ký' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled={isLockedViewMode} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="signer_name" label="Người ký" rules={[{ required: true }]}>
                <Input placeholder="HIỆU TRƯỞNG" disabled={isLockedViewMode} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={!isOpening ? 12 : 14}>
              <Form.Item name="classId" label="Lớp học áp dụng" rules={[{ required: isOpening, message: 'Vui lòng chọn lớp học' }]}>
                <Select
                  placeholder="Chọn lớp học..."
                  showSearch
                  optionFilterProp="label"
                  disabled={isLockedViewMode}
                  onChange={async (v) => {
                    setLopDuocChon(v);
                    if (isOpening && !editingItem && v) {
                      try {
                        const clsObj = danhSachLop?.find(
                          (c: any) =>
                            String(c.documentId || c.id) === String(v) ||
                            String(c.strapiId) === String(v),
                        );
                        const clsName = (clsObj?.name || '').trim();
                        const res = await api<any>(
                          `/${COLLECTIONS.STUDENTS}/unassigned?filters[school_class][name][$eq]=${encodeURIComponent(clsName)}&filters[is_approved][$eq]=true&populate[school_class]=true&pagination[pageSize]=500&publicationState=preview`,
                        );
                        const rawList = normalizeStrapiList(res);
                        const list = rawList.filter((s: any) => {
                          const sCls = s.school_class?.data || s.school_class || {};
                          const sClassDocId = String(sCls.documentId || sCls.id || '');
                          const sClassName = String(sCls.name || s.class_name || s.group || '').trim();
                          const matchClass =
                            sClassDocId === String(v) ||
                            (clsName && sClassName.toLowerCase() === clsName.toLowerCase());
                          const matchApproved =
                            s.is_approved === true || String(s.is_approved).toLowerCase() === 'true';
                          return matchClass && matchApproved;
                        });
                        setTempStudents(
                          list.map((s: any) => ({
                            id: String(s.documentId || s.id),
                            strapiId: s.strapiId || s.id,
                            fullName: s.full_name || s.fullName || '',
                            gender: s.gender || 'Nam',
                            dob: s.dob || '',
                            cardNumber: s.id_number || s.card_number || '',
                            studentCode: s.student_code || '',
                            hometown: s.pob || '',
                            address: s.address || '',
                            phone: s.phone || '',
                            notes: s.notes || '',
                            photo: s.photo || null,
                          })),
                        );
                      } catch {
                        // ignore
                      }
                    }
                  }}
                  options={danhSachLop?.map((c: any) => ({
                    value: c.documentId || c.id,
                    label: `${c.code ? `[${c.code}] ` : ''}${c.name}`,
                  }))}
                />
              </Form.Item>
            </Col>
            {!isOpening && (
              <Col xs={24} md={12}>
                <Form.Item name="relatedOpeningId" label="QĐ Mở lớp liên kết">
                  <Select
                    placeholder="Chọn QĐ mở lớp..."
                    showSearch
                    optionFilterProp="label"
                    allowClear
                    disabled={isLockedViewMode}
                    onChange={async (v) => {
                      setRelatedOpeningId(v || '');
                      if (v) {
                        const relDec = danhSachQdMoLop?.find(
                          (d: any) => String(d.documentId || d.id) === String(v),
                        );
                        if (relDec) {
                          const clsId = relDec.school_class?.documentId || relDec.school_class?.id;
                          if (clsId) {
                            setLopDuocChon(clsId);
                            form.setFieldValue('classId', clsId);
                          }
                          if (relDec.training_course && !form.getFieldValue('training_course')) {
                            form.setFieldValue('training_course', relDec.training_course);
                          }
                        }
                        try {
                          const students = await loadDecisionStudents(String(v));
                          setTempStudents(students);
                        } catch {
                          // ignore
                        }
                      }
                    }}
                    options={danhSachQdMoLop?.map((d: any) => ({
                      value: d.documentId || d.id,
                      label: `${d.decision_number} – ${d.school_class?.name || ''}`,
                    }))}
                  />
                </Form.Item>
              </Col>
            )}
            <Col xs={24} md={isOpening ? 10 : 24}>
              <Form.Item name="training_course" label="Khóa / Đợt đào tạo">
                <Input placeholder="Vd: Đợt 1 năm 2026" disabled={isLockedViewMode} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Ghi chú thêm">
            <Input.TextArea rows={2} placeholder="Nội dung ghi chú..." disabled={isLockedViewMode} />
          </Form.Item>

          <Divider orientation="left">
            <span style={{ fontSize: 13, color: '#1677ff' }}>
              Danh sách học viên trong quyết định ({tempStudents.length} học viên)
            </span>
          </Divider>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text type="secondary">Học viên sẽ được đưa vào quyết định này:</Text>
            {!isLockedViewMode && (
              <Space>
                <Button
                  size="small"
                  icon={<UserOutlined />}
                  onClick={() => moPickerHocVien()}
                  disabled={isOpening && !lopDuocChon}
                >
                  Thêm học viên
                </Button>
                <Button
                  size="small"
                  icon={<FileZipOutlined />}
                  onClick={() => taiAnh3x4(tempStudents, form.getFieldValue('decision_number') || '')}
                >
                  Tải ảnh ZIP
                </Button>
                <Button
                  size="small"
                  icon={<PrinterOutlined />}
                  onClick={() => {
                    const fv = form.getFieldsValue();
                    const cls = danhSachLop?.find((c: any) => c.documentId === fv.classId || c.id === fv.classId);
                    inQuyetDinh(
                      {
                        decision_number: fv.decision_number,
                        signed_date: fv.signed_date ? fv.signed_date.format('YYYY-MM-DD') : null,
                        signer_name: fv.signer_name,
                        school_class: cls,
                        students: tempStudents,
                      },
                      tempStudents,
                    );
                  }}
                >
                  In QĐ
                </Button>
              </Space>
            )}
          </div>

          <Table
            dataSource={tempStudents}
            rowKey={r => r.id}
            size="small"
            pagination={{ pageSize: 8, size: 'small' }}
            locale={{ emptyText: 'Chưa có học viên nào. Nhấn "Thêm học viên" để thêm.' }}
            columns={[
              { title: 'STT', width: 50, align: 'center', render: (_, __, i) => i + 1 },
              { title: 'Họ tên', dataIndex: 'fullName', render: (v: string) => <b>{v}</b> },
              {
                title: 'Ngày sinh',
                dataIndex: 'dob',
                width: 105,
                render: (v: string) => fmtNgay(v),
              },
              { title: 'Số CCCD', dataIndex: 'cardNumber', width: 130, render: (v: string, r: StudentDetail) => v || r.studentCode },
              { title: 'Giới tính', dataIndex: 'gender', width: 80, align: 'center' },
              {
                title: 'Điểm thi',
                key: 'grades',
                width: 105,
                align: 'center',
                render: (_: any, r: StudentDetail) => (
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<TrophyOutlined />}
                    onClick={() => setViewingGradeStudent(r)}
                  >
                    Xem điểm
                  </Button>
                ),
              },
              {
                title: 'Hồ sơ',
                key: 'docs',
                width: 95,
                align: 'center',
                render: (_: any, r: StudentDetail) => (
                  <Button
                    size="small"
                    icon={<PaperClipOutlined />}
                    onClick={() => setViewingDocsStudent(r)}
                  >
                    {r.documents?.length || 0} file
                  </Button>
                ),
              },
              {
                title: 'Thao tác',
                key: 'act',
                width: 95,
                align: 'center',
                render: (_: any, r: StudentDetail, idx: number) => (
                  <Space size={4}>
                    <Tooltip title="Sửa thông tin HV">
                      <Button size="small" icon={<EditOutlined />} onClick={() => moSuaHocVien(r, idx)} />
                    </Tooltip>
                    {!isLockedViewMode && (
                      <Tooltip title="Xóa khỏi danh sách">
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => setTempStudents(prev => prev.filter((_, i) => i !== idx))}
                        />
                      </Tooltip>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      {/* ======================================================
          Modal Chọn học viên (Picker)
      ====================================================== */}
      <Modal
        title="Chọn học viên thêm vào quyết định"
        open={moPickerModal}
        width={750}
        onCancel={() => { setMoPickerModal(false); setPickerSelected(new Set()); }}
        onOk={themHocVienVaoTemp}
        okText={`Thêm ${pickerSelected.size} học viên`}
        cancelText="Hủy"
        destroyOnClose
      >
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <Input.Search
            placeholder="Tìm theo tên, số CCCD..."
            allowClear
            value={pickerSearch}
            onChange={e => setPickerSearch(e.target.value)}
            style={{ width: 300 }}
          />
          <Space>
            <Button
              size="small"
              onClick={() => {
                const all = new Set(filteredPickerStudents.map((s: any) => String(s.documentId || s.id)));
                setPickerSelected(all);
              }}
            >
              Chọn tất cả
            </Button>
            <Button size="small" onClick={() => setPickerSelected(new Set())}>Bỏ chọn hết</Button>
          </Space>
        </div>
        <Spin spinning={pickerLoading}>
          <Table
            dataSource={filteredPickerStudents}
            rowKey={(r: any) => String(r.documentId || r.id)}
            size="small"
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: 'Không có học viên phù hợp' }}
            rowSelection={{
              selectedRowKeys: Array.from(pickerSelected),
              onChange: keys => setPickerSelected(new Set(keys as string[])),
            }}
            columns={[
              {
                title: 'Họ tên',
                render: (_: any, r: any) => <b>{r.full_name || r.fullName || ''}</b>,
              },
              { title: 'Số CCCD', dataIndex: 'id_number', render: (v: string, r: any) => v || r.card_number || r.student_code },
              { title: 'Ngày sinh', dataIndex: 'dob', width: 110, render: (v: string) => fmtNgay(v) },
              { title: 'Giới tính', dataIndex: 'gender', width: 85 },
              {
                title: 'Lớp đăng ký',
                render: (_: any, r: any) => (
                  <Tag color="blue">
                    {r.school_class?.data?.name || r.school_class?.name || r.class_name || r.group || '---'}
                  </Tag>
                ),
              },
            ]}
          />
        </Spin>
      </Modal>

      {/* ======================================================
          Modal Sửa thông tin học viên
      ====================================================== */}
      <Modal
        title="Sửa thông tin học viên trong quyết định"
        open={moEditSvModal}
        width={700}
        onCancel={() => { stopCamera(); setMoEditSvModal(false); setEditingSvData(null); }}
        onOk={luuSuaHocVien}
        okText="Lưu thông tin"
        cancelText="Hủy"
        forceRender
      >
        <div>
          <Form form={editStudentForm} layout="vertical" style={{ marginTop: 8 }}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="fullName" label="Họ và tên">
                  <Input placeholder="Nhập họ tên" />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name="dob" label="Ngày sinh">
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name="gender" label="Giới tính">
                  <Select options={[{ value: 'Nam', label: 'Nam' }, { value: 'Nữ', label: 'Nữ' }, { value: 'Khác', label: 'Khác' }]} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="cardNumber" label="Số CCCD">
                  <Input placeholder="Số CCCD/CMND" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="phone" label="Số điện thoại">
                  <Input placeholder="Số điện thoại" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="hometown" label="Nơi sinh">
                  <Select
                    showSearch
                    allowClear
                    placeholder="Chọn Tỉnh/Thành phố"
                    options={PROVINCES_LIST.map((p) => ({ value: p, label: p }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="address" label="Địa chỉ">
                  <Input placeholder="Địa chỉ thường trú" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="notes" label="Ghi chú">
              <Input.TextArea rows={2} placeholder="Ghi chú..." />
            </Form.Item>
          </Form>

          {editingSvData && (
            <>
              <Divider orientation="left">Ảnh thẻ 3x4</Divider>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div
                  onClick={isCameraLive ? undefined : startCamera}
                  title="Nhấn để mở Camera chụp ảnh 3x4"
                  style={{
                    width: 120,
                    height: 160,
                    border: '2px solid #cbd5e1',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: '#fafafa',
                    cursor: isCameraLive ? 'default' : 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {editingSvData.photo ? (
                    <img src={editingSvData.photo} alt="Ảnh HV" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>Chưa có ảnh<br/>3x4</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  {isCameraLive ? (
                    <div style={{ maxWidth: 260 }}>
                      <div style={{ position: 'relative', aspectRatio: '3 / 4', background: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
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
                              strokeDasharray="6 6"
                            />
                          </svg>
                        </div>
                      </div>
                      <canvas ref={canvasRef} style={{ display: 'none' }} />
                      <Space style={{ marginTop: 8 }}>
                        <Button type="primary" icon={<CameraOutlined />} onClick={capturePhoto}>Chụp ảnh 3x4</Button>
                        <Button onClick={stopCamera}>Hủy camera</Button>
                      </Space>
                    </div>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%', maxWidth: 220 }}>
                      <Button type="primary" ghost icon={<CameraOutlined />} onClick={startCamera} block>
                        Chụp ảnh 3x4
                      </Button>
                      <Upload
                        accept="image/*"
                        showUploadList={false}
                        beforeUpload={file => {
                          const reader = new FileReader();
                          reader.onload = e => {
                            if (editingSvData) setEditingSvData({ ...editingSvData, photo: e.target?.result as string });
                          };
                          reader.readAsDataURL(file);
                          return false;
                        }}
                      >
                        <Button icon={<UploadOutlined />} block style={{ width: '100%' }}>Tải ảnh lên</Button>
                      </Upload>
                      {editingSvData.photo && (
                        <Button
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
                      {editingSvData.photo && (
                        <Button
                          icon={<DownloadOutlined />}
                          onClick={taiAnhXuong}
                          block
                          style={{
                            background: '#f0fdf4',
                            borderColor: '#bbf7d0',
                            color: '#16a34a',
                            fontWeight: 600,
                          }}
                        >
                          Tải ảnh xuống
                        </Button>
                      )}
                      {editingSvData.photo && (
                        <Button danger icon={<DeleteOutlined />} onClick={() => setEditingSvData({ ...editingSvData, photo: null })} block>
                          Xóa ảnh
                        </Button>
                      )}
                    </Space>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ======================================================
          Modal Hành động với QĐ bị khóa
      ====================================================== */}
      <Modal
        title={<span><LockOutlined style={{ color: '#faad14' }} /> Quyết định đang bị khóa</span>}
        open={moLockedModal}
        onCancel={() => setMoLockedModal(false)}
        footer={null}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text>
            Quyết định mở lớp này đã có <b>QĐ Công nhận tốt nghiệp số "{lockedDecisionNumber}"</b> liên kết.
          </Text>
          <br />
          <Text type="secondary">Vui lòng chọn một trong hai hành động bên dưới:</Text>
        </div>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            block
            icon={<UserOutlined />}
            onClick={async () => {
              setMoLockedModal(false);
              const item = queryQuyetDinh.data?.items?.find(
                (d: any) => String(d.documentId || d.id) === String(lockedTargetId),
              );
              if (item) moSua(item, true);
            }}
          >
            Xem / Sửa thông tin học viên (chỉ xem)
          </Button>
          <Popconfirm
            title="CẢNH BÁO: Thao tác này sẽ XÓA QĐ Công nhận để mở khóa. Bạn có chắc không?"
            okText="Có, xóa và mở khóa"
            cancelText="Không"
            okButtonProps={{ danger: true }}
            onConfirm={handleDeleteRecognitionToUnlock}
          >
            <Button block danger icon={<DeleteOutlined />}>
              Xóa QĐ Công nhận để mở khóa
            </Button>
          </Popconfirm>
        </Space>
      </Modal>

      {/* ======================================================
          Modal Import Excel Preview
      ====================================================== */}
      <Modal
        title="Xác nhận Import từ Excel"
        open={moImportModal}
        width={900}
        onCancel={() => { setMoImportModal(false); setImportRows([]); }}
        onOk={handleConfirmImport}
        confirmLoading={importLoading}
        okText="Xác nhận Import"
        cancelText="Hủy"
        destroyOnClose
      >
        <div style={{ marginBottom: 12 }}>
          <Text>Tìm thấy <b>{importRows.length}</b> dòng dữ liệu ({new Set(importRows.map(r => r.so_qd)).size} quyết định). Xem trước:</Text>
        </div>
        <Table
          dataSource={importRows.map((r, i) => ({ ...r, _key: i }))}
          rowKey="_key"
          size="small"
          pagination={{ pageSize: 8 }}
          scroll={{ x: 800 }}
          columns={[
            { title: 'Số QĐ', dataIndex: 'so_qd', width: 90 },
            { title: 'Tên lớp', dataIndex: 'ten_lop', width: 160 },
            { title: 'Đợt/Khóa', dataIndex: 'dot_khoa', width: 100 },
            { title: 'Ngày ký', dataIndex: 'ngay_ky', width: 100 },
            { title: 'Người ký', dataIndex: 'nguoi_ky', width: 120 },
            { title: 'Họ tên HV', dataIndex: 'ho_ten', width: 160 },
            { title: 'Ngày sinh', dataIndex: 'ngay_sinh', width: 100 },
            { title: 'Giới tính', dataIndex: 'gioi_tinh', width: 90 },
            { title: 'CCCD', dataIndex: 'so_cmnd', width: 130 },
          ]}
        />
      </Modal>

      {/* ======================================================
          Modal Xem Điểm Học Viên
      ====================================================== */}
      <Modal
        title={`Bảng điểm: ${viewingGradeStudent?.fullName || ''}`}
        open={!!viewingGradeStudent}
        onCancel={() => setViewingGradeStudent(null)}
        footer={[
          <Button key="close" onClick={() => setViewingGradeStudent(null)}>
            Đóng
          </Button>,
        ]}
        width={680}
      >
        {viewingGradeStudent && (() => {
          const { classObj, relOpenId, relOpenStrapiId } = getModalFormContext();
          const targetDecId = isOpening
            ? String(editingItem?.documentId || editingItem?.id || '')
            : String(relOpenId || '');
          const targetStrapiId = isOpening
            ? editingItem?.strapiId || editingItem?.id
            : relOpenStrapiId;
          const subjectsList = normalizeStrapiList(classObj?.subjects || { data: classObj?.subjects || [] });

          const gradeRecord = findGradeRecordForDecision(
            targetDecId,
            targetStrapiId,
            [viewingGradeStudent.studentCode, viewingGradeStudent.cardNumber],
          );
          const subjectGrades = gradeRecord?.grades || {};

          const apprRecord = examApprovals?.find((ea: any) => {
            const decRel = ea.decision?.data || ea.decision;
            const docId = String(decRel?.documentId || decRel?.id || '');
            const strId = String(decRel?.strapiId || decRel?.id || '');
            return (
              (targetDecId && (docId === targetDecId || strId === targetDecId)) ||
              (targetStrapiId && (docId === String(targetStrapiId) || strId === String(targetStrapiId)))
            );
          });
          const subjectApprovals = apprRecord?.approvals || {};

          return (
            <Table
              dataSource={subjectsList}
              rowKey={(s: any) => String(s.documentId || s.id)}
              size="small"
              pagination={false}
              locale={{ emptyText: 'Lớp này chưa cấu hình môn học' }}
              columns={[
                { title: 'STT', width: 50, align: 'center', render: (_, __, i) => i + 1 },
                { title: 'Môn học', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
                {
                  title: 'Lý thuyết',
                  width: 110,
                  align: 'center',
                  render: (_: any, subj: any) => {
                    const k1 = String(subj.strapiId || subj.id);
                    const k2 = String(subj.documentId || subj.id);
                    const g =
                      subjectGrades[k1]?.[viewingGradeStudent.studentCode] ||
                      subjectGrades[k2]?.[viewingGradeStudent.studentCode] ||
                      subjectGrades[k1]?.[viewingGradeStudent.cardNumber] ||
                      subjectGrades[k2]?.[viewingGradeStudent.cardNumber];
                    const val = typeof g === 'object' ? g?.theory : g;
                    return val !== undefined && val !== '' ? <b>{val}</b> : '---';
                  },
                },
                {
                  title: 'Thực hành',
                  width: 110,
                  align: 'center',
                  render: (_: any, subj: any) => {
                    if (!subj.has_practice && !subj.hasPractice) return <Text type="secondary">Không</Text>;
                    const k1 = String(subj.strapiId || subj.id);
                    const k2 = String(subj.documentId || subj.id);
                    const appr =
                      subjectApprovals[k1]?.[viewingGradeStudent.studentCode] ||
                      subjectApprovals[k2]?.[viewingGradeStudent.studentCode] ||
                      subjectApprovals[k1]?.[viewingGradeStudent.cardNumber] ||
                      subjectApprovals[k2]?.[viewingGradeStudent.cardNumber];
                    if (appr && typeof appr === 'object') {
                      return appr.practicePass ? <Tag color="success">Đạt</Tag> : <Tag color="error">K.Đạt</Tag>;
                    }
                    return '---';
                  },
                },
              ]}
            />
          );
        })()}
      </Modal>

      {/* ======================================================
          Modal Xem Hồ Sơ Học Viên
      ====================================================== */}
      <Modal
        title={`Hồ sơ đính kèm: ${viewingDocsStudent?.fullName || ''}`}
        open={!!viewingDocsStudent}
        onCancel={() => setViewingDocsStudent(null)}
        footer={[
          <Button key="close" onClick={() => setViewingDocsStudent(null)}>
            Đóng
          </Button>,
        ]}
        width={640}
      >
        {viewingDocsStudent && (
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">
              CCCD: <b>{viewingDocsStudent.cardNumber || viewingDocsStudent.studentCode || '---'}</b>
            </Text>
            <Space size={8}>
              {['CCCD Mặt trước', 'CCCD Mặt sau'].map((docName) => (
                <Upload
                  key={docName}
                  showUploadList={false}
                  accept="image/*,.pdf"
                  beforeUpload={async (file) => {
                    const cccd = (viewingDocsStudent.cardNumber || viewingDocsStudent.studentCode || '').trim();
                    const prefix = docName.includes('trước') ? 'cccd_front' : 'cccd_back';
                    try {
                      const uploaded = await uploadFile(file, `${prefix}_${cccd || Date.now()}_${Date.now()}.jpg`);
                      const fileUrl = uploaded?.[0]?.url;
                      if (!fileUrl) throw new Error('Không lấy được URL file');
                      const studentNumericId = viewingDocsStudent.strapiId
                        ? Number(viewingDocsStudent.strapiId)
                        : !isNaN(Number(viewingDocsStudent.id))
                          ? Number(viewingDocsStudent.id)
                          : undefined;
                      await api('/student-documents/replace-or-create', {
                        method: 'POST',
                        body: {
                          name: docName,
                          type: file.type || 'image/jpeg',
                          date: new Date().toLocaleDateString('vi-VN'),
                          url: fileUrl,
                          student: studentNumericId,
                          id_number: cccd,
                        },
                      });
                      const newDoc = {
                        name: docName,
                        url: fileUrl,
                        type: file.type || 'image/jpeg',
                        date: new Date().toLocaleDateString('vi-VN'),
                      };
                      const updatedDocs = [
                        ...(viewingDocsStudent.documents || []).filter((d: any) => d.name !== docName),
                        newDoc,
                      ];
                      const updatedStudent = { ...viewingDocsStudent, documents: updatedDocs };
                      setViewingDocsStudent(updatedStudent);
                      setTempStudents((prev) =>
                        prev.map((s) => (s.id === updatedStudent.id ? updatedStudent : s)),
                      );
                      setExpandedStudents((prev) => {
                        const next = { ...prev };
                        Object.keys(next).forEach((k) => {
                          next[k] = next[k].map((s) => (s.id === updatedStudent.id ? updatedStudent : s));
                        });
                        return next;
                      });
                      message.success(`Đã tải lên ${docName}`);
                    } catch (err: any) {
                      message.error(err?.message || `Lỗi khi tải lên ${docName}`);
                    }
                    return false;
                  }}
                >
                  <Button size="small" icon={<UploadOutlined />}>
                    + {docName}
                  </Button>
                </Upload>
              ))}
            </Space>
          </div>
        )}
        {!viewingDocsStudent?.documents?.length ? (
          <Empty description="Học viên chưa có tài liệu đính kèm" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            {viewingDocsStudent.documents.map((doc: any, idx: number) => {
              const rawUrl = String(doc.url || '');
              const docUrl =
                rawUrl.startsWith('data:') || rawUrl.startsWith('http')
                  ? rawUrl
                  : `${window.location.origin}${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`;
              const isImg =
                rawUrl.startsWith('data:image/') ||
                /\.(jpg|jpeg|png|webp|gif)$/i.test(rawUrl.split('?')[0]) ||
                String(doc.type || '').startsWith('image/');
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    border: '1px solid #f0f0f0',
                    borderRadius: 6,
                  }}
                >
                  <Space size={12}>
                    {isImg ? (
                      <Image
                        src={docUrl}
                        width={56}
                        height={40}
                        style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid #d9d9d9' }}
                      />
                    ) : (
                      <PaperClipOutlined />
                    )}
                    <div>
                      <Text strong>{doc.name || `Tài liệu #${idx + 1}`}</Text>
                      {doc.date && (
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>Ngày tải: {doc.date}</div>
                      )}
                    </div>
                  </Space>
                  <Button
                    size="small"
                    type="link"
                    icon={<DownloadOutlined />}
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = docUrl;
                      a.download = doc.name || `tai_lieu_${idx + 1}.jpg`;
                      a.target = '_blank';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                  >
                    Xem / Tải
                  </Button>
                </div>
              );
            })}
          </Space>
        )}
      </Modal>

      {/* ======================================================
          Modal Lịch sử thao tác (Audit Logs)
      ====================================================== */}
      <Modal
        title={
          <Space>
            <HistoryOutlined />
            <span>Lịch sử thao tác hệ thống</span>
          </Space>
        }
        open={moAuditModal}
        onCancel={() => setMoAuditModal(false)}
        footer={[
          <Button key="close" onClick={() => setMoAuditModal(false)}>
            Đóng
          </Button>,
        ]}
        width={880}
      >
        <Table
          dataSource={auditLogs || []}
          rowKey={(r: any) => String(r.documentId || r.id)}
          loading={auditLoading}
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Thời gian',
              dataIndex: 'createdAt',
              width: 155,
              render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : '---'),
            },
            {
              title: 'Người thực hiện',
              dataIndex: 'actor_name',
              width: 150,
              render: (v: string, r: any) => <b>{v || r.username || 'Admin'}</b>,
            },
            {
              title: 'Hành động',
              dataIndex: 'action',
              width: 120,
              render: (v: string) => <Tag color="blue">{v || 'UPDATE'}</Tag>,
            },
            {
              title: 'Chi tiết',
              dataIndex: 'details',
              render: (v: any, r: any) =>
                typeof v === 'string' ? v : r.description || JSON.stringify(v || ''),
            },
          ]}
        />
      </Modal>
    </Card>
  );
}

import { useState, useRef } from 'react';
import type React from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  App,
  Avatar,
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
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tooltip,
  Upload,
} from 'antd';
import type { TableProps } from 'antd';
import {
  CameraOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileExcelOutlined,
  FileZipOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, checkDuplicateStudent, COLLECTIONS, normalizeStrapiList, uploadFile } from '../api';
import { fmtNgay, PROVINCES_LIST, toIso } from '../constants';

export default function HocVienList() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();

  // State bộ lọc và phân trang
  const [trang, setTrang] = useState(1);
  const [kichThuocTrang, setKichThuocTrang] = useState(20);
  const [tuKhoa, setTuKhoa] = useState('');
  const [lopLoc, setLopLoc] = useState<string>();
  const [trangThaiLoc, setTrangThaiLoc] = useState<string>(); // 'approved', 'pending'

  // State Modal Thêm/Sửa
  const [moModal, setMoModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [anh3x4, setAnh3x4] = useState<string | null>(null);
  const [viewingDocs, setViewingDocs] = useState<any[]>([]);
  const [_dangKiemTraTrung, setDangKiemTraTrung] = useState(false);
  const [canhBaoTrung, setCanhBaoTrung] = useState<string | null>(null);

  // State camera WebRTC & AI
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State tài liệu CCCD (map name -> url)
  const [docsMap, setDocsMap] = useState<Record<string, string>>({});
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Bulk selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  // 1. Fetch danh sách lớp học để làm dropdown lọc & chọn lớp
  const { data: danhSachLop } = useQuery({
    queryKey: ['classes-list-for-filter'],
    queryFn: async () => {
      const res = await api<any>(
        `/${COLLECTIONS.CLASSES}?pagination[pageSize]=200&publicationState=preview&sort=createdAt:desc`,
      );
      return normalizeStrapiList(res);
    },
  });

  // 2. Fetch danh sách học viên (chỉ hiển thị học viên chưa vào Quyết định mở lớp - giống edumaster-main)
  const queryHocVien = useQuery({
    queryKey: ['students-list', trang, kichThuocTrang, tuKhoa, lopLoc, trangThaiLoc, danhSachLop?.length],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = `/${COLLECTIONS.STUDENTS}/unassigned?populate[school_class]=true&populate[documents]=true&sort=createdAt:desc&pagination[page]=${trang}&pagination[pageSize]=${kichThuocTrang}&publicationState=preview`;

      if (tuKhoa) {
        const raw = tuKhoa.trim();
        q += `&filters[$or][0][full_name][$containsi]=${encodeURIComponent(raw)}&filters[$or][1][id_number][$contains]=${encodeURIComponent(raw)}`;
      }

      if (lopLoc) {
        const clsObj = danhSachLop?.find(
          (c: any) => String(c.documentId || c.id) === String(lopLoc) || String(c.name) === String(lopLoc),
        );
        const className = clsObj?.name || lopLoc;
        q += `&filters[school_class][name][$eq]=${encodeURIComponent(className)}`;
      }

      if (trangThaiLoc === 'approved') {
        q += `&filters[is_approved][$eq]=true`;
      } else if (trangThaiLoc === 'pending') {
        q += `&filters[is_approved][$eq]=false`;
      }

      const res = await api<any>(q);
      return {
        items: normalizeStrapiList(res),
        total: res?.meta?.pagination?.total ?? 0,
      };
    },
  });

  // 3. Mutation Duyệt / Bỏ duyệt
  const duyetMut = useMutation({
    mutationFn: async ({ documentId, isApproved }: { documentId: string; isApproved: boolean }) => {
      return api(`/${COLLECTIONS.STUDENTS}/${documentId}`, {
        method: 'PUT',
        body: { data: { is_approved: isApproved } },
      });
    },
    onSuccess: (_, v) => {
      message.success(v.isApproved ? 'Đã duyệt học viên' : 'Đã chuyển về chờ duyệt');
      qc.invalidateQueries({ queryKey: ['students-list'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['unapproved-students-count'] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'Lỗi khi cập nhật trạng thái duyệt');
    },
  });

  // 4. Mutation Xóa học viên
  const xoaMut = useMutation({
    mutationFn: async (documentId: string) => {
      return api(`/${COLLECTIONS.STUDENTS}/${documentId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      message.success('Đã xóa học viên thành công');
      qc.invalidateQueries({ queryKey: ['students-list'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['unapproved-students-count'] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'Lỗi khi xóa học viên');
    },
  });

  // 5. Mutation Thêm / Sửa học viên
  const luuMut = useMutation({
    mutationFn: async (values: any) => {
      const cccd = (values.idNumber || '').trim();
      const nameParts = values.fullName.trim().split(/\s+/);
      const firstName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : values.fullName;
      const lastName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
      const cls = danhSachLop?.find(
        (c: any) =>
          String(c.documentId) === String(values.classId) ||
          String(c.id) === String(values.classId) ||
          String(c.strapiId) === String(values.classId),
      );
      const classNumericId = cls?.strapiId
        ? Number(cls.strapiId)
        : !isNaN(Number(values.classId))
          ? Number(values.classId)
          : null;

      let finalPhotoUrl = anh3x4;
      if (anh3x4 && anh3x4.startsWith('data:image/')) {
        const up = await uploadFile(anh3x4, `avatar_${cccd}_${Date.now()}.jpg`);
        if (up && up.length > 0) finalPhotoUrl = up[0].url;
      }

      const payload: any = {
        student_code: cccd,
        id_number: cccd,
        card_number: cccd,
        full_name: values.fullName.toUpperCase().trim(),
        first_name: firstName.toUpperCase().trim(),
        last_name: lastName.toUpperCase().trim(),
        dob: values.dob ? toIso(values.dob) : null,
        pob: values.pob || '',
        gender: values.gender || 'Nam',
        ethnicity: values.ethnicity || 'Kinh',
        nationality: values.nationality || 'Việt Nam',
        phone: values.phone || '',
        address: values.address || '',
        company: values.company || '',
        notes: values.notes || '',
        photo: finalPhotoUrl,
        class_code: cls?.code || '',
        class_name: cls?.name || '',
        group: cls?.name || '',
      };
      if (classNumericId) {
        payload.school_class = classNumericId;
      }

      if (editingItem) {
        return api(`/${COLLECTIONS.STUDENTS}/${editingItem.documentId || editingItem.id}`, {
          method: 'PUT',
          body: { data: payload },
        });
      } else {
        payload.is_approved = false;
        payload.publishedAt = new Date().toISOString();
        const createdRes = await api<any>(`/${COLLECTIONS.STUDENTS}`, {
          method: 'POST',
          body: { data: payload },
        });
        const newStudentId = createdRes?.data?.id || createdRes?.data?.strapiId;
        // Lưu CCCD mặt trước / mặt sau nếu đã chọn khi tạo mới
        const frontUrl = docsMap['CCCD Mặt trước'] || docsMap['cccd_front'];
        const backUrl = docsMap['CCCD Mặt sau'] || docsMap['cccd_back'];
        if (frontUrl) {
          await api('/student-documents/replace-or-create', {
            method: 'POST',
            body: {
              name: 'CCCD Mặt trước',
              type: 'image/jpeg',
              date: new Date().toLocaleDateString('vi-VN'),
              url: frontUrl,
              student: newStudentId ? Number(newStudentId) : undefined,
              id_number: cccd,
            },
          }).catch(() => {});
        }
        if (backUrl) {
          await api('/student-documents/replace-or-create', {
            method: 'POST',
            body: {
              name: 'CCCD Mặt sau',
              type: 'image/jpeg',
              date: new Date().toLocaleDateString('vi-VN'),
              url: backUrl,
              student: newStudentId ? Number(newStudentId) : undefined,
              id_number: cccd,
            },
          }).catch(() => {});
        }
        return createdRes;
      }
    },
    onSuccess: () => {
      message.success(editingItem ? 'Cập nhật học viên thành công' : 'Thêm mới học viên thành công');
      setMoModal(false);
      setEditingItem(null);
      form.resetFields();
      setAnh3x4(null);
      setCanhBaoTrung(null);
      qc.invalidateQueries({ queryKey: ['students-list'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'Lỗi khi lưu học viên');
    },
  });

  // Tự động lấy ảnh 3x4 & tài liệu CCCD dùng chung theo số CCCD
  const taiAnhVaHoSoTheoCCCD = async (idNumber: string, currentPhoto?: string | null) => {
    if (!idNumber || idNumber.length < 9) return;
    try {
      const res = await api<any>(
        `/${COLLECTIONS.STUDENTS}?filters[id_number][$eq]=${encodeURIComponent(idNumber)}&populate[documents]=true&sort=createdAt:desc&pagination[pageSize]=10&publicationState=preview`,
      );
      const records = normalizeStrapiList(res);
      if (records.length > 0) {
        if (!currentPhoto) {
          const recWithPhoto = records.find((r: any) => r.photo);
          if (recWithPhoto?.photo) {
            const pUrl = typeof recWithPhoto.photo === 'string' ? recWithPhoto.photo : recWithPhoto.photo?.url;
            if (pUrl) setAnh3x4(pUrl);
          }
        }
        const mergedDocs: Record<string, string> = {};
        records.forEach((r: any) => {
          const dList = r.documents?.data || r.documents || [];
          dList.forEach((d: any) => {
            if (d.name && d.url && !mergedDocs[d.name]) {
              mergedDocs[d.name] = d.url;
            }
          });
        });
        if (Object.keys(mergedDocs).length > 0) {
          setDocsMap((prev) => ({ ...mergedDocs, ...prev }));
        }
      }
      // Lấy thêm từ endpoint by-id-number
      const sharedRes = await api<any>(`/student-documents/by-id-number?id_number=${encodeURIComponent(idNumber)}`).catch(() => null);
      const sharedList = sharedRes?.data || [];
      if (Array.isArray(sharedList) && sharedList.length > 0) {
        setViewingDocs((prev) => {
          const map = new Map<string, any>();
          [...prev, ...sharedList].forEach((d: any) => {
            const k = String(d.url || d.name || d.id);
            if (k && !map.has(k)) map.set(k, d);
          });
          return Array.from(map.values());
        });
        setDocsMap((prev) => {
          const next = { ...prev };
          sharedList.forEach((d: any) => {
            if (d.name && d.url && !next[d.name]) next[d.name] = d.url;
          });
          return next;
        });
      }
    } catch {
      // ignore
    }
  };

  const moThem = () => {
    setEditingItem(null);
    form.resetFields();
    setAnh3x4(null);
    setViewingDocs([]);
    setDocsMap({});
    setCanhBaoTrung(null);
    form.setFieldsValue({
      gender: 'Nam',
      ethnicity: 'Kinh',
      nationality: 'Việt Nam',
      classId: lopLoc || undefined,
    });
    setMoModal(true);
  };

  const moSua = (item: any) => {
    setEditingItem(item);
    form.resetFields();
    setCanhBaoTrung(null);
    const initialPhoto = typeof item.photo === 'string' ? item.photo : item.photo?.url || null;
    setAnh3x4(initialPhoto);
    const rawDocs = item.documents?.data || item.documents || item.student_documents || [];
    setViewingDocs(Array.isArray(rawDocs) ? rawDocs : []);

    // Nạp tài liệu CCCD hiện có vào docsMap
    const initialDocsMap: Record<string, string> = {};
    (Array.isArray(rawDocs) ? rawDocs : []).forEach((doc: any) => {
      const docUrl = doc.url || doc.file?.url;
      if (doc.name && docUrl) {
        initialDocsMap[doc.name] = docUrl;
      }
    });
    setDocsMap(initialDocsMap);

    const cls = item.school_class?.data || item.school_class;
    const classId = cls?.documentId || cls?.id || item.classId;
    const cccd = item.id_number || item.student_code || item.studentCode || '';

    form.setFieldsValue({
      fullName: item.full_name || item.fullName,
      idNumber: cccd,
      dob: item.dob ? dayjs(item.dob) : null,
      pob: item.pob,
      gender: item.gender || 'Nam',
      ethnicity: item.ethnicity || 'Kinh',
      nationality: item.nationality || 'Việt Nam',
      phone: item.phone,
      address: item.address,
      company: item.company,
      classId: classId || undefined,
      notes: item.notes,
    });
    setMoModal(true);

    if (cccd) {
      taiAnhVaHoSoTheoCCCD(cccd, initialPhoto);
    }
  };

  // Kiểm tra quy tắc 5 năm
  const kiemTraQuyTac5Nam = async (idNumber: string, classId: string) => {
    if (!idNumber || !classId) return;
    try {
      const classRes = await fetch(`/api/school-classes/${classId}`);
      const classData = await classRes.json();
      const trainingCourse = classData.data?.training_course || classData.data?.attributes?.training_course;

      const studRes = await fetch(`/api/students?filters[id_number][$eq]=${idNumber}&populate[school_class]=true`);
      const studData = await studRes.json();

      const fiveYearsAgo = dayjs().subtract(5, 'year');
      const conflict = studData.data?.find((s: any) => {
        const cls = s.school_class || s.attributes?.school_class?.data?.attributes;
        return cls && cls.training_course === trainingCourse && dayjs(cls.start_date).isAfter(fiveYearsAgo);
      });

      if (conflict) {
        const cls = conflict.school_class || conflict.attributes?.school_class?.data?.attributes;
        message.warning(`Học viên đã học lớp "${cls?.name || ''}" cùng chương trình trong vòng 5 năm qua!`);
      }
    } catch {
      // silent
    }
  };

  // Kiểm tra trùng CCCD
  const kiemTraTrungCCCD = async () => {
    const cccd = form.getFieldValue('idNumber');
    const classId = form.getFieldValue('classId');
    if (!cccd || cccd.length !== 12 || !classId) return;

    setDangKiemTraTrung(true);
    try {
      const res = await checkDuplicateStudent(cccd, classId, editingItem?.documentId || editingItem?.id);
      if (res.exists) {
        setCanhBaoTrung(`Học viên với CCCD ${cccd} đã đăng ký lớp này rồi!`);
      } else {
        setCanhBaoTrung(null);
      }
    } finally {
      setDangKiemTraTrung(false);
    }
  };

  // Nén & chuẩn hóa kích thước ảnh 3x4 (900x1200)
  const compressAndResizeImage = (
    base64Str: string,
    maxWidth = 900,
    maxHeight = 1200,
    quality = 0.9,
  ): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = base64Str;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  // ── Camera WebRTC (chuẩn 3x4 có khung căn khuôn mặt) ──────────────────────
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
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        message.error('Bạn đã từ chối quyền truy cập Camera. Vui lòng cấp quyền trên trình duyệt.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        message.error('Không tìm thấy thiết bị Camera trên máy tính/điện thoại của bạn.');
      } else {
        message.error('Không thể truy cập Camera: ' + (err?.message || 'Lỗi thiết bị'));
      }
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
    const targetRatio = 3 / 4;
    let sX = 0;
    let sY = 0;
    let sW = vw;
    let sH = vh;

    if (vw / vh > targetRatio) {
      sW = vh * targetRatio;
      sX = (vw - sW) / 2;
    } else {
      sH = vw / targetRatio;
      sY = (vh - sH) / 2;
    }

    ctx.drawImage(video, sX, sY, sW, sH, 0, 0, 900, 1200);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setAnh3x4(dataUrl);
    dongCamera();
    message.success('Đã chụp ảnh 3x4 thành công!');
  };

  const dongCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  // ── Xử lý AI (Thay trang phục ảnh thẻ 3x4) ────────────────────────────────
  const xuLyAnhAI = async () => {
    if (!anh3x4) return;
    setIsProcessingAI(true);
    try {
      const gender = form.getFieldValue('gender') || 'Nam';
      const res = await api<any>('/students/process-photo', {
        method: 'POST',
        body: {
          originalImage: anh3x4,
          gender,
        },
      });
      if (res?.processedImage) {
        const compressed = await compressAndResizeImage(res.processedImage, 900, 1200, 0.9);
        setAnh3x4(compressed);
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

  // ── Tải ảnh 3x4 xuống máy ────────────────────────────────────────────────
  const taiAnhXuong = async () => {
    if (!anh3x4) return;
    try {
      const cccd = form.getFieldValue('idNumber') || editingItem?.student_code || 'HocVien';
      const fullName = (form.getFieldValue('fullName') || editingItem?.full_name || 'HV').replace(/\s+/g, '_');
      const fullUrl =
        anh3x4.startsWith('data:') || anh3x4.startsWith('http')
          ? anh3x4
          : `${window.location.origin}${anh3x4.startsWith('/') ? anh3x4 : `/${anh3x4}`}`;
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
      link.href = anh3x4;
      link.download = 'Anh_3x4.jpg';
      link.target = '_blank';
      link.click();
    }
  };

  // ── Upload tài liệu CCCD ──────────────────────────────────────────────────
  const uploadCCCD = async (file: File, docName: string) => {
    setUploadingDoc(docName);
    try {
      const cccd = editingItem?.id_number || editingItem?.student_code || form.getFieldValue('idNumber') || '';
      const uploaded = await uploadFile(file, `doc_${cccd || Date.now()}_${file.name}`);
      const fileUrl = uploaded?.[0]?.url;
      if (!fileUrl) throw new Error('Upload file thất bại');

      if (editingItem) {
        const studentNumericId = editingItem.strapiId ? Number(editingItem.strapiId) : undefined;
        await api('/student-documents/replace-or-create', {
          method: 'POST',
          body: {
            name: docName,
            type: file.type,
            date: new Date().toLocaleDateString('vi-VN'),
            url: fileUrl,
            student: studentNumericId,
            id_number: cccd,
          },
        });
        qc.invalidateQueries({ queryKey: ['students-list'] });
      }

      setDocsMap((prev) => ({ ...prev, [docName]: fileUrl }));
      setViewingDocs((prev) => {
        const filtered = prev.filter((d: any) => d.name !== docName);
        return [...filtered, { name: docName, url: fileUrl, type: file.type, date: new Date().toLocaleDateString('vi-VN') }];
      });
      message.success(`Đã tải lên ${docName}`);
    } catch (err: any) {
      message.error(err.message || 'Upload thất bại');
    } finally {
      setUploadingDoc(null);
    }
  };

  // In Phiếu Đăng Ký (A5)
  const inPhieuDangKy = (student: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Vui lòng cho phép Pop-up trên trình duyệt để in phiếu.');
      return;
    }

    const hoTen = student.full_name || student.fullName || '';
    const dob = student.dob ? fmtNgay(student.dob) : '';
    const pob = student.pob || '';
    const cccd = student.id_number || student.student_code || '';
    const lop = student.school_class?.name || student.class_name || student.group || '';
    const sdt = student.phone || '';
    const diaChi = student.address || '';
    const donVi = student.company || '';
    const photo = student.photo || '';

    const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Phiếu đăng ký học - ${hoTen}</title>
      <style>
        @page { size: A5 landscape; margin: 1cm; }
        body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.4; color: #000; margin: 0; padding: 10px; }
        .head { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .head-left { text-align: center; }
        .head-left b { font-size: 12pt; text-transform: uppercase; }
        .head-right { width: 3cm; height: 4cm; border: 1px dashed #666; display: flex; align-items: center; justify-content: center; font-size: 10pt; color: #888; overflow: hidden; }
        .head-right img { width: 100%; height: 100%; object-fit: cover; }
        .title { text-align: center; font-size: 16pt; font-weight: bold; margin: 15px 0 20px; text-transform: uppercase; }
        .row { margin-bottom: 8px; display: flex; }
        .label { min-width: 170px; font-weight: bold; }
        .val { flex: 1; border-bottom: 1px dotted #888; }
        .foot { margin-top: 30px; display: flex; justify-content: space-between; }
        .foot-col { text-align: center; width: 45%; }
      </style>
    </head>
    <body>
      <div class="head">
        <div class="head-left">
          TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I<br/>
          <b>PHÒNG ĐÀO TẠO &amp; QUẢN LÝ HỌC VIÊN</b>
        </div>
        <div class="head-right">
          ${photo ? `<img src="${photo}" alt="3x4"/>` : 'Ảnh 3x4'}
        </div>
      </div>
      <div class="title">PHIẾU ĐĂNG KÝ THAM GIA KHÓA HỌC</div>
      <div class="row"><div class="label">Họ và tên học viên:</div><div class="val" style="font-weight:bold; text-transform:uppercase;">${hoTen}</div></div>
      <div class="row"><div class="label">Ngày sinh:</div><div class="val">${dob} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>Nơi sinh:</b> ${pob}</div></div>
      <div class="row"><div class="label">Số CCCD/CMND:</div><div class="val">${cccd}</div></div>
      <div class="row"><div class="label">Số điện thoại:</div><div class="val">${sdt}</div></div>
      <div class="row"><div class="label">Lớp học đăng ký:</div><div class="val" style="font-weight:bold;">${lop}</div></div>
      <div class="row"><div class="label">Địa chỉ thường trú:</div><div class="val">${diaChi}</div></div>
      <div class="row"><div class="label">Đơn vị công tác:</div><div class="val">${donVi || 'Tự do'}</div></div>
      <div class="foot">
        <div class="foot-col">
          <b>NGƯỜI TIẾP NHẬN HỒ SƠ</b><br/>
          <i>(Ký và ghi rõ họ tên)</i>
        </div>
        <div class="foot-col">
          <i>Ngày ..... tháng ..... năm 202...</i><br/>
          <b>NGƯỜI ĐĂNG KÝ</b><br/>
          <i>(Ký và ghi rõ họ tên)</i>
        </div>
      </div>
    </body>
    </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Xuất Excel
  const xuatExcel = async () => {
    const list = queryHocVien.data?.items || [];
    if (list.length === 0) {
      message.warning('Không có dữ liệu để xuất Excel');
      return;
    }
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Danh sách học viên');

    ws.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'Mã HV', key: 'studentCode', width: 15 },
      { header: 'Họ và tên', key: 'fullName', width: 25 },
      { header: 'Ngày sinh', key: 'dob', width: 12 },
      { header: 'Nơi sinh', key: 'pob', width: 20 },
      { header: 'Giới tính', key: 'gender', width: 10 },
      { header: 'Số CCCD', key: 'idNumber', width: 15 },
      { header: 'SĐT', key: 'phone', width: 12 },
      { header: 'Địa chỉ', key: 'address', width: 30 },
      { header: 'Lớp', key: 'className', width: 15 },
      { header: 'Trạng thái', key: 'approved', width: 12 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
    headerRow.alignment = { horizontal: 'center' };

    list.forEach((s: any, i: number) => {
      const row = ws.addRow({
        stt: i + 1,
        studentCode: s.id_number || s.student_code || '',
        fullName: s.full_name || s.fullName || '',
        dob: s.dob ? fmtNgay(s.dob) : '',
        pob: s.pob || '',
        gender: s.gender || '',
        idNumber: s.id_number || s.student_code || '',
        phone: s.phone || '',
        address: s.address || '',
        className: s.school_class?.name || s.class_name || s.group || '',
        approved: s.is_approved ? 'Đã duyệt' : 'Chờ duyệt',
      });
      if (i % 2 === 1) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }
    });

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
    saveAs(new Blob([buf]), `danh-sach-hoc-vien-${dayjs().format('DDMMYYYY')}.xlsx`);
    message.success('Đã xuất file Excel danh sách học viên');
  };

  // Tải ảnh 3x4 của các học viên đã chọn thành file ZIP
  const taiAnh3x4ZIP = async () => {
    const list = queryHocVien.data?.items || [];
    const selected = selectedRowKeys.length > 0
      ? list.filter((s: any) => selectedRowKeys.includes(s.documentId || s.id))
      : list;
    const withPhoto = selected.filter((s: any) => s.photo);
    if (withPhoto.length === 0) {
      message.warning('Không có học viên nào (trong nhóm đã chọn) có ảnh 3x4.');
      return;
    }

    setIsDownloadingZip(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      const zip = new JSZip();
      let ok = 0;

      for (let i = 0; i < withPhoto.length; i++) {
        const s = withPhoto[i];
        const photoSrc: string = s.photo;
        const name = (s.full_name || s.fullName || `hocvien_${i + 1}`).trim().replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
        const ext = photoSrc.startsWith('data:image/') ? (photoSrc.match(/data:image\/(\w+);/)?.[1] || 'jpg').replace('jpeg', 'jpg') : (photoSrc.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg');
        try {
          let blob: Blob;
          if (photoSrc.startsWith('data:image/')) {
            const [, data] = photoSrc.split(',');
            const bytes = atob(data);
            const arr = new Uint8Array(bytes.length);
            for (let j = 0; j < bytes.length; j++) arr[j] = bytes.charCodeAt(j);
            blob = new Blob([arr], { type: `image/${ext}` });
          } else {
            const absUrl = photoSrc.startsWith('/') ? `${window.location.origin}${photoSrc}` : photoSrc;
            const token = localStorage.getItem('edumaster_token');
            const r = await fetch(absUrl, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            blob = await r.blob();
          }
          zip.file(`${String(i + 1).padStart(3, '0')}_${name}.${ext}`, blob);
          ok++;
        } catch {
          // skip failed
        }
      }

      if (ok === 0) {
        message.error('Không tải được ảnh nào. Kiểm tra kết nối.');
        return;
      }
      const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const dateStr = dayjs().format('DDMMYYYY');
      saveAs(content, `Anh3x4_HocVien_${dateStr}.zip`);
      message.success(`Đã tải ${ok}/${withPhoto.length} ảnh thành công!`);
      setSelectedRowKeys([]);
    } catch (err: any) {
      message.error('Lỗi tạo file ZIP: ' + (err.message || String(err)));
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const columns: TableProps<any>['columns'] = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_, __, idx) => (trang - 1) * kichThuocTrang + idx + 1,
    },
    {
      title: 'Ảnh',
      dataIndex: 'photo',
      key: 'photo',
      width: 64,
      align: 'center',
      render: (url: string, _r: any) =>
        url ? (
          <Image
            src={url}
            alt="3x4"
            width={40}
            height={52}
            style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }}
          />
        ) : (
          <Avatar shape="square" size={40} icon={<UserOutlined />} style={{ backgroundColor: '#cbd5e1' }} />
        ),
    },
    {
      title: 'Học viên & CCCD',
      key: 'hocVien',
      render: (_, r: any) => (
        <div>
          <b style={{ color: '#0f1f3d', fontSize: 14 }}>{r.full_name || r.fullName || '---'}</b>
          <div style={{ fontSize: 12, color: '#1677ff', fontFamily: 'monospace' }}>
            CCCD: {r.id_number || r.student_code || '---'}
          </div>
        </div>
      ),
    },
    {
      title: 'Lớp học',
      key: 'lop',
      render: (_, r: any) => {
        const cls = r.school_class;
        return (
          <div>
            <b>{cls?.name || r.class_name || r.group || '---'}</b>
            {cls?.code && <div style={{ fontSize: 11, color: '#64748b' }}>[{cls.code}]</div>}
          </div>
        );
      },
    },
    {
      title: 'Ngày sinh & Nơi sinh',
      key: 'ngaySinh',
      width: 150,
      render: (_, r: any) => (
        <div style={{ fontSize: 13 }}>
          <div>{fmtNgay(r.dob) || '---'} ({r.gender || 'Nam'})</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{r.pob || ''}</div>
        </div>
      ),
    },
    {
      title: 'SĐT',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
    },
    {
      title: 'Duyệt',
      dataIndex: 'is_approved',
      key: 'is_approved',
      width: 130,
      align: 'center',
      render: (approved: boolean, r: any) => (
        <Switch
          checked={!!approved}
          checkedChildren="Đã duyệt"
          unCheckedChildren="Chưa"
          loading={duyetMut.isPending}
          onChange={(checked) => duyetMut.mutate({ documentId: r.documentId || r.id, isApproved: checked })}
        />
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 130,
      align: 'center',
      render: (_, r: any) => (
        <Space size={4}>
          <Tooltip title="Tải ảnh 3x4">
            <Button
              size="small"
              icon={<DownloadOutlined />}
              disabled={!r.photo}
              onClick={async () => {
                if (!r.photo) return;
                try {
                  const resp = await fetch(r.photo.startsWith('/') ? `${window.location.origin}${r.photo}` : r.photo);
                  const blob = await resp.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  const name = (r.full_name || r.fullName || 'hocvien').replace(/\s+/g, '_');
                  const ext = r.photo.split('.').pop()?.split('?')[0] || 'jpg';
                  a.href = url; a.download = `${name}_3x4.${ext}`;
                  a.click(); URL.revokeObjectURL(url);
                } catch { message.error('Không tải được ảnh'); }
              }}
            />
          </Tooltip>
          <Tooltip title="In phiếu đăng ký học">
            <Button size="small" icon={<PrinterOutlined />} onClick={() => inPhieuDangKy(r)} />
          </Tooltip>
          <Tooltip title="Sửa thông tin">
            <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => moSua(r)} />
          </Tooltip>
          <Popconfirm
            title="Xác nhận xóa học viên?"
            description="Hành động này không thể hoàn tác."
            onConfirm={() => xoaMut.mutate(r.documentId || r.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card className="card-mem">
      {/* Thanh công cụ lọc & tìm kiếm */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, justifyContent: 'space-between' }}>
        <Space wrap>
          <Input.Search
            placeholder="Tìm theo Tên, CCCD, SĐT..."
            allowClear
            onSearch={(v) => {
              setTuKhoa(v.trim());
              setTrang(1);
            }}
            style={{ width: 260 }}
          />
          <Select
            placeholder="Lọc theo lớp học"
            allowClear
            showSearch
            optionFilterProp="label"
            popupMatchSelectWidth={false}
            style={{ width: 420, maxWidth: '100%' }}
            value={lopLoc}
            onChange={(v) => {
              setLopLoc(v);
              setTrang(1);
            }}
            options={danhSachLop?.map((c: any) => ({
              value: c.documentId || c.id,
              label: `${c.code ? `[${c.code}] ` : ''}${c.name}`,
            }))}
          />
          <Select
            placeholder="Trạng thái duyệt"
            allowClear
            style={{ width: 150 }}
            value={trangThaiLoc}
            onChange={(v) => {
              setTrangThaiLoc(v);
              setTrang(1);
            }}
            options={[
              { value: 'approved', label: 'Đã duyệt' },
              { value: 'pending', label: 'Chờ duyệt' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => queryHocVien.refetch()}>
            Làm mới
          </Button>
        </Space>

        <Space wrap>
          <Button icon={<FileExcelOutlined />} onClick={xuatExcel}>
            Xuất Excel
          </Button>
          <Button
            icon={<FileZipOutlined />}
            loading={isDownloadingZip}
            onClick={taiAnh3x4ZIP}
            title={selectedRowKeys.length > 0 ? `Tải ảnh ${selectedRowKeys.length} học viên đã chọn` : 'Tải tất cả ảnh 3x4'}
          >
            {selectedRowKeys.length > 0 ? `Tải ảnh (${selectedRowKeys.length})` : 'Tải ảnh ZIP'}
          </Button>
          {selectedRowKeys.length > 0 && (
            <Button size="small" onClick={() => setSelectedRowKeys([])}>
              Bỏ chọn ({selectedRowKeys.length})
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={moThem}>
            Thêm học viên
          </Button>
        </Space>
      </div>

      {/* Bảng danh sách học viên */}
      <Table
        dataSource={queryHocVien.data?.items ?? []}
        columns={columns}
        rowKey={(r) => r.documentId || r.id}
        loading={queryHocVien.isFetching}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        locale={{
          emptyText: <Empty description="Không có học viên nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
        }}
        pagination={{
          current: trang,
          pageSize: kichThuocTrang,
          total: queryHocVien.data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          onChange: (p, ps) => {
            setTrang(p);
            setKichThuocTrang(ps);
          },
        }}
      />

      {/* Modal Thêm / Sửa học viên */}
      <Modal
        title={editingItem ? 'Cập nhật thông tin học viên' : 'Thêm mới học viên'}
        open={moModal}
        width={940}
        onCancel={() => {
          dongCamera();
          setMoModal(false);
        }}
        onOk={() => form.submit()}
        confirmLoading={luuMut.isPending}
        okText="Lưu lại"
        cancelText="Đóng"
        forceRender
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ gender: 'Nam', ethnicity: 'Kinh', nationality: 'Việt Nam' }}
          onFinish={(v) => luuMut.mutate(v)}
          onFinishFailed={(errInfo) => {
            const firstErr = errInfo.errorFields?.[0]?.errors?.[0];
            if (firstErr) message.warning(firstErr);
          }}
          style={{ marginTop: 12 }}
        >
          {canhBaoTrung && (
            <div
              style={{
                background: '#fff2f0',
                border: '1px solid #ffccc7',
                padding: '8px 12px',
                borderRadius: 8,
                color: '#ff4d4f',
                marginBottom: 16,
                fontWeight: 500,
              }}
            >
              ⚠️ {canhBaoTrung}
            </div>
          )}

          <Row gutter={24}>
            {/* Cột trái: 1. Thông tin học viên + 2. Thông tin liên lạc */}
            <Col xs={24} md={17}>
              <Card
                size="small"
                title={<span style={{ color: '#1677ff', fontWeight: 700, fontSize: 13 }}>1. Thông tin học viên</span>}
                style={{ marginBottom: 16, background: '#f8fafc' }}
              >
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="idNumber"
                      label="Số CCCD / CMND (Mã HV - 12 số)"
                      rules={[
                        { required: true, message: 'Nhập số CCCD' },
                        { pattern: /^\d{12}$/, message: 'CCCD phải đủ 12 số' },
                      ]}
                    >
                      <Input
                        placeholder="Nhập 12 chữ số CCCD"
                        maxLength={12}
                        onBlur={() => {
                          kiemTraTrungCCCD();
                          const idNumber = form.getFieldValue('idNumber');
                          const classId = form.getFieldValue('classId');
                          if (idNumber && classId) kiemTraQuyTac5Nam(idNumber, classId);
                          if (idNumber && idNumber.length === 12) {
                            taiAnhVaHoSoTheoCCCD(idNumber, anh3x4);
                          }
                        }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="fullName"
                      label="Họ và tên học viên"
                      rules={[{ required: true, message: 'Nhập họ và tên' }]}
                    >
                      <Input placeholder="NGUYỄN VĂN AN" style={{ textTransform: 'uppercase', fontWeight: 600 }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={12}>
                  <Col xs={24} md={8}>
                    <Form.Item name="dob" label="Ngày sinh" rules={[{ required: true, message: 'Chọn ngày sinh' }]}>
                      <DatePicker format="DD/MM/YYYY" placeholder="DD/MM/YYYY" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="gender" label="Giới tính" rules={[{ required: true }]}>
                      <Radio.Group>
                        <Radio value="Nam">Nam</Radio>
                        <Radio value="Nữ">Nữ</Radio>
                      </Radio.Group>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="pob" label="Nơi sinh" rules={[{ required: true, message: 'Chọn nơi sinh' }]}>
                      <Select
                        showSearch
                        allowClear
                        placeholder="Tỉnh / Thành"
                        options={PROVINCES_LIST.map((p) => ({ value: p, label: p }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item name="ethnicity" label="Dân tộc">
                      <Input placeholder="Kinh" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="nationality" label="Quốc tịch">
                      <Input placeholder="Việt Nam" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="classId"
                  label="Lớp học tham gia"
                  rules={[{ required: true, message: 'Vui lòng chọn lớp học!' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    placeholder="-- Chọn lớp học --"
                    showSearch
                    optionFilterProp="label"
                    onChange={(v) => {
                      kiemTraTrungCCCD();
                      const idNumber = form.getFieldValue('idNumber');
                      if (idNumber) kiemTraQuyTac5Nam(idNumber, v);
                    }}
                    options={danhSachLop?.map((c: any) => ({
                      value: c.documentId || c.id,
                      label: `${c.code ? `[${c.code}] ` : ''}${c.name}`,
                    }))}
                  />
                </Form.Item>
              </Card>

              <Card
                size="small"
                title={<span style={{ color: '#1677ff', fontWeight: 700, fontSize: 13 }}>2. Thông tin liên lạc</span>}
                style={{ background: '#f8fafc' }}
              >
                <Row gutter={12}>
                  <Col xs={24}>
                    <Form.Item
                      name="address"
                      label="Địa chỉ thường trú"
                      rules={[{ required: true, message: 'Nhập địa chỉ thường trú' }]}
                    >
                      <Input placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={14}>
                    <Form.Item name="company" label="Đơn vị công tác">
                      <Input placeholder="Tên cơ quan, công ty, đơn vị..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={10}>
                    <Form.Item name="phone" label="Điện thoại">
                      <Input placeholder="Số điện thoại liên hệ" />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item name="notes" label="Ghi chú" style={{ marginBottom: 0 }}>
                      <Input.TextArea rows={2} placeholder="Ghi chú thêm (nếu có)..." />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Cột phải: Ảnh thẻ 3x4 + Căn cước công dân (Hồ sơ) */}
            <Col xs={24} md={7}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#475569', marginBottom: 8, textAlign: 'center' }}>
                  Ảnh thẻ 3x4
                </div>

                {/* Khung xem trước ảnh 3x4 (150x200) */}
                <div
                  onClick={moCamera}
                  title="Nhấn để mở Camera chụp ảnh 3x4"
                  style={{
                    width: 150,
                    height: 200,
                    border: '2px solid #cbd5e1',
                    borderRadius: 6,
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    position: 'relative',
                  }}
                >
                  {anh3x4 ? (
                    <img
                      src={anh3x4}
                      alt="Ảnh thẻ 3x4"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                      <UserOutlined style={{ fontSize: 44, opacity: 0.45 }} />
                      <div style={{ fontSize: 11, marginTop: 6 }}>Chưa có ảnh 3x4</div>
                    </div>
                  )}
                </div>

                {/* Nhóm nút thao tác Ảnh thẻ 3x4 (Luôn hiển thị đầy đủ như edumaster-main) */}
                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    width: '100%',
                    maxWidth: 165,
                  }}
                >
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    icon={<CameraOutlined />}
                    onClick={moCamera}
                    block
                    style={{ fontWeight: 600 }}
                  >
                    Chụp ảnh 3x4
                  </Button>

                  <Upload
                    showUploadList={false}
                    accept="image/*"
                    beforeUpload={(f) => {
                      const reader = new FileReader();
                      reader.onload = async (e) => {
                        const raw = e.target?.result as string;
                        if (raw) {
                          const compressed = await compressAndResizeImage(raw, 900, 1200, 0.9);
                          setAnh3x4(compressed);
                        }
                      };
                      reader.readAsDataURL(f);
                      return false;
                    }}
                  >
                    <Button size="small" icon={<UploadOutlined />} block style={{ width: '100%', fontWeight: 600 }}>
                      Tải ảnh lên
                    </Button>
                  </Upload>

                  {anh3x4 && (
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

                  {anh3x4 && (
                    <Button
                      size="small"
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

                  {anh3x4 && (
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setAnh3x4(null)} block>
                      Xóa ảnh
                    </Button>
                  )}
                </div>

                {/* Căn cước công dân (Hồ sơ) */}
                <Divider style={{ margin: '18px 0 10px' }} />
                <div style={{ width: '100%' }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      marginBottom: 10,
                    }}
                  >
                    Căn cước công dân (Hồ sơ)
                  </div>

                  <Row gutter={8}>
                    {/* Mặt trước */}
                    <Col span={12}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Mặt trước:</span>
                        <Upload
                          showUploadList={false}
                          accept="image/*"
                          customRequest={async ({ file }) => {
                            await uploadCCCD(file as File, 'CCCD Mặt trước');
                          }}
                        >
                          <Button
                            size="small"
                            type="link"
                            style={{ padding: 0, height: 'auto', fontSize: 11 }}
                            loading={uploadingDoc === 'CCCD Mặt trước'}
                          >
                            <UploadOutlined /> Tải lên
                          </Button>
                        </Upload>
                      </div>
                      <div
                        style={{
                          height: 68,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {docsMap['CCCD Mặt trước'] || docsMap['cccd_front'] ? (
                          <Image
                            src={docsMap['CCCD Mặt trước'] || docsMap['cccd_front']}
                            width="100%"
                            height={68}
                            style={{ objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ fontSize: 10, color: '#cbd5e1', fontStyle: 'italic' }}>Chưa có ảnh</span>
                        )}
                      </div>
                    </Col>

                    {/* Mặt sau */}
                    <Col span={12}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Mặt sau:</span>
                        <Upload
                          showUploadList={false}
                          accept="image/*"
                          customRequest={async ({ file }) => {
                            await uploadCCCD(file as File, 'CCCD Mặt sau');
                          }}
                        >
                          <Button
                            size="small"
                            type="link"
                            style={{ padding: 0, height: 'auto', fontSize: 11 }}
                            loading={uploadingDoc === 'CCCD Mặt sau'}
                          >
                            <UploadOutlined /> Tải lên
                          </Button>
                        </Upload>
                      </div>
                      <div
                        style={{
                          height: 68,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {docsMap['CCCD Mặt sau'] || docsMap['cccd_back'] ? (
                          <Image
                            src={docsMap['CCCD Mặt sau'] || docsMap['cccd_back']}
                            width="100%"
                            height={68}
                            style={{ objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ fontSize: 10, color: '#cbd5e1', fontStyle: 'italic' }}>Chưa có ảnh</span>
                        )}
                      </div>
                    </Col>
                  </Row>

                  {/* Các tài liệu đính kèm khác */}
                  {viewingDocs && viewingDocs.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                        Tài liệu đã lưu ({viewingDocs.length}):
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {viewingDocs.map((doc: any, i: number) => (
                          <div
                            key={i}
                            style={{
                              border: '1px solid #e2e8f0',
                              padding: 4,
                              borderRadius: 4,
                              textAlign: 'center',
                              fontSize: 10,
                              background: '#fff',
                            }}
                          >
                            {doc.url?.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                              <Image src={doc.url} width={56} height={36} style={{ objectFit: 'cover' }} />
                            ) : (
                              <a href={doc.url} target="_blank" rel="noreferrer">
                                📄 {doc.name || 'File'}
                              </a>
                            )}
                            <div style={{ maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.name || 'Tài liệu'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal Camera chụp ảnh 3x4 có khung Oval chuẩn như edumaster-main */}
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
              margin: '0 auto',
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
              }}
            />
            {/* Khung căn khuôn mặt Oval & Vai */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <svg style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
                <defs>
                  <mask id="face-oval-mask">
                    <rect width="100%" height="100%" fill="white" />
                    <ellipse cx="50%" cy="42%" rx="28%" ry="33%" fill="black" />
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#face-oval-mask)" />
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
              <div
                style={{
                  position: 'absolute',
                  bottom: 16,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    background: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    padding: '4px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                  }}
                >
                  Căn khuôn mặt vào khung Oval
                </span>
              </div>
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
    </Card>
  );
}

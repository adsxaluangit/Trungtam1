const TOKEN_KEY = 'edumaster_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export interface LoiTruong {
  truong: string;
  loi: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public loi?: LoiTruong[],
  ) {
    super(message);
  }
}

export type Query = Record<string, string | number | boolean | undefined | null>;

function taoUrl(path: string, query?: Query) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return `/api${path}${s ? `?${s}` : ''}`;
}

async function goi(path: string, opts: { method?: string; body?: unknown; query?: Query } = {}) {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) body = opts.body;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(taoUrl(path, opts.query), { method: opts.method ?? 'GET', headers, body });
  if (!res.ok) {
    let data: { message?: string | string[]; loi?: LoiTruong[]; error?: { message?: string } } = {};
    try {
      data = await res.json();
    } catch {
      /* phản hồi không phải JSON */
    }
    if (res.status === 401 && !path.startsWith('/auth/local')) {
      tokenStore.clear();
      window.dispatchEvent(new Event('edumaster:dang-xuat'));
    }
    const rawMsg = data.error?.message ?? data.message;
    const msg = Array.isArray(rawMsg) ? rawMsg.join('; ') : rawMsg;
    const macDinh =
      res.status >= 500 && !msg
        ? `Không kết nối được máy chủ API (mã ${res.status}). Vui lòng kiểm tra dịch vụ API backend.`
        : `Lỗi máy chủ (${res.status})`;
    throw new ApiError(msg || macDinh, res.status, data.loi);
  }
  return res;
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; query?: Query } = {}): Promise<T> {
  const res = await goi(path, opts);
  if (res.status === 204) return null as T;
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('application/json') ? res.json() : res.text()) as Promise<T>;
}

/** Tải file về máy */
export async function taiFile(path: string, opts: { method?: string; query?: Query; tenMacDinh?: string } = {}) {
  const res = await goi(path, { method: opts.method, query: opts.query });
  const cd = res.headers.get('content-disposition') ?? '';
  const m = cd.match(/filename\*=UTF-8''([^;]+)/) ?? cd.match(/filename="?([^";]+)"?/);
  let ten = m ? decodeURIComponent(m[1]) : (opts.tenMacDinh ?? 'tai-ve.xlsx');
  if (!/\.[a-z0-9]{2,5}$/i.test(ten)) ten += '.xlsx';
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ten;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

// ========================================================
// Strapi Normalization & Constants
// ========================================================

export const COLLECTIONS = {
  NATIONS: 'nations',
  SUPPLIERS: 'suppliers',
  CLASSROOMS: 'classrooms',
  CLASSES: 'school-classes',
  SUBJECTS: 'subjects',
  TEACHERS: 'teachers',
  STUDENTS: 'students',
  CLASS_DECISIONS: 'class-decisions',
  TRAINING_ASSIGNMENTS: 'training-assignments',
  EXAM_APPROVALS: 'exam-approvals',
  EXAM_GRADES: 'exam-grades',
  STUDENT_DOCUMENTS: 'student-documents',
  AUDIT_LOGS: 'audit-logs',
  PRINT_TEMPLATES: 'print-templates',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export interface StrapiMetaPagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export interface StrapiMeta {
  pagination?: StrapiMetaPagination;
}

export interface StrapiListResponse<T = any> {
  data: T[];
  meta?: StrapiMeta;
}

export interface StrapiItemResponse<T = any> {
  data: T;
  meta?: StrapiMeta;
}

/**
 * Chuẩn hóa list từ Strapi (hỗ trợ cả Strapi v4 lồng attributes và Strapi v5 phẳng)
 */
export function normalizeStrapiList<T = any>(response: any): T[] {
  if (!response) return [];
  const rawArray = Array.isArray(response)
    ? response
    : response?.data && Array.isArray(response.data)
      ? response.data
      : null;
  if (rawArray) {
    const items = rawArray.map((item: any) => {
      if (!item || typeof item !== 'object') return item;
      const attrs = item.attributes || {};
      return {
        ...attrs,
        ...item,
        strapiId: item.strapiId || item.id,
        id: item.documentId || item.id,
        documentId: item.documentId || String(item.id),
      };
    });
    // Deduplicate theo id / documentId
    return Array.from(new Map(items.map((it: any) => [it?.id ?? it, it])).values()) as T[];
  }
  return [];
}

/**
 * Chuẩn hóa một item từ Strapi
 */
export function normalizeStrapiItem<T = any>(item: any): T | null {
  if (!item) return null;
  const raw = item?.data ? item.data : item;
  if (!raw) return null;
  const attrs = raw.attributes || {};
  return {
    ...attrs,
    ...raw,
    strapiId: raw.id,
    id: raw.documentId || raw.id,
    documentId: raw.documentId || String(raw.id),
  } as T;
}

/**
 * Upload file lên Strapi (/upload)
 */
export async function uploadFile(
  fileOrBase64: File | Blob | string,
  filename: string = `upload_${Date.now()}.jpg`,
): Promise<{ id: number; url: string; name: string }[] | null> {
  try {
    let blob: Blob;
    if (typeof fileOrBase64 === 'string') {
      const res = await fetch(fileOrBase64);
      blob = await res.blob();
    } else {
      blob = fileOrBase64;
    }

    const formData = new FormData();
    formData.append('files', blob, filename);

    const headers: Record<string, string> = {};
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Upload failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Lỗi tải file lên máy chủ:', err);
    return null;
  }
}

/**
 * Kiểm tra trùng lặp học viên theo CCCD và lớp
 */
export async function checkDuplicateStudent(
  idNumber: string,
  classDocumentId: string,
  excludeStudentId?: string,
): Promise<{ exists: boolean; count: number; students: any[] }> {
  if (!idNumber || !classDocumentId) return { exists: false, count: 0, students: [] };
  try {
    const qs = new URLSearchParams({
      id_number: idNumber,
      class_id: classDocumentId,
    });
    if (excludeStudentId) qs.set('exclude_student_id', excludeStudentId);
    return await api<{ exists: boolean; count: number; students: any[] }>(`/students/check-duplicate?${qs.toString()}`);
  } catch {
    // Fallback nếu backend chưa có endpoint custom /students/check-duplicate
    try {
      const q = `/students?filters[id_number][$eq]=${encodeURIComponent(idNumber)}&filters[school_class][documentId][$eq]=${encodeURIComponent(classDocumentId)}&publicationState=preview`;
      const res = await api<any>(q);
      const list = normalizeStrapiList(res).filter((s: any) => s.documentId !== excludeStudentId && s.id !== excludeStudentId);
      return { exists: list.length > 0, count: list.length, students: list };
    } catch {
      return { exists: false, count: 0, students: [] };
    }
  }
}

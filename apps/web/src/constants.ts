import dayjs, { Dayjs } from 'dayjs';

// Vai trò người dùng trong hệ thống
export type UserRole = 'ADMIN' | 'MANAGER' | 'TEACHER' | 'GUEST';

export const NHAN_VAI_TRO: Record<UserRole, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Cán bộ quản lý / Đào tạo',
  TEACHER: 'Giảng viên',
  GUEST: 'Khách',
};

// Trạng thái lớp học
export const TRANG_THAI_LOP = {
  OPENING: 'Đang khai giảng',
  CLOSED: 'Đã kết thúc',
  PENDING: 'Chờ khai giảng',
} as const;

export type TrangThaiLop = keyof typeof TRANG_THAI_LOP;

export const MAU_TRANG_THAI_LOP: Record<string, string> = {
  OPENING: 'processing',
  CLOSED: 'default',
  PENDING: 'warning',
  'Đang khai giảng': 'processing',
  'Đã kết thúc': 'default',
  'Chờ khai giảng': 'warning',
  active: 'success',
  inactive: 'error',
};

// Giới tính
export const NHAN_GIOI_TINH = {
  Nam: 'Nam',
  'Nữ': 'Nữ',
  Khác: 'Khác',
} as const;

// Danh sách 34 tỉnh thành Việt Nam sau sáp nhập
export const PROVINCES_LIST: string[] = [
  'An Giang', 'Bắc Ninh', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk',
  'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Tĩnh',
  'Hưng Yên', 'Khánh Hoà', 'Lai Châu', 'Lâm Đồng', 'Lạng Sơn',
  'Lào Cai', 'Nghệ An', 'Ninh Bình', 'Phú Thọ', 'Quảng Ngãi',
  'Quảng Ninh', 'Quảng Trị', 'Sơn La', 'Tây Ninh', 'Thái Nguyên',
  'Thanh Hóa', 'TP. Cần Thơ', 'TP. Đà Nẵng', 'TP. Hà Nội', 'Hải Phòng',
  'TP. Hồ Chí Minh', 'TP. Huế', 'Tuyên Quang', 'Vĩnh Long',
];

// Helper functions định dạng ngày giờ
export const fmtNgay = (v?: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '');
export const fmtNgayGio = (v?: string | null) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '');
export const toIso = (d?: Dayjs | null) => (d ? d.format('YYYY-MM-DD') : null);
export const toDayjs = (v?: string | null) => (v ? dayjs(v) : null);

export function chuCaiDau(ten: string) {
  if (!ten) return '';
  const p = ten.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export function tuyChon<T extends Record<string, string>>(m: T) {
  return Object.entries(m).map(([value, label]) => ({ value, label }));
}

// Kiểm tra quyền
export function getRoleFromUser(u?: { role?: { name?: string; type?: string } | null; username?: string }): UserRole {
  const roleName = u?.role?.name?.toUpperCase() || u?.role?.type?.toUpperCase() || '';
  if (roleName.includes('ADMIN') || u?.username === 'admin') return 'ADMIN';
  if (roleName.includes('MANAGER') || roleName.includes('ĐÀO TẠO') || roleName.includes('DAO TAO')) return 'MANAGER';
  if (roleName.includes('TEACHER') || roleName.includes('GIẢNG VIÊN') || roleName.includes('GIANG VIEN')) return 'TEACHER';
  return 'GUEST';
}

export const isAdmin = (u?: { role?: { name?: string; type?: string } | null; username?: string }) =>
  getRoleFromUser(u) === 'ADMIN';

export const isManagerOrAdmin = (u?: { role?: { name?: string; type?: string } | null; username?: string }) => {
  const r = getRoleFromUser(u);
  return r === 'ADMIN' || r === 'MANAGER';
};

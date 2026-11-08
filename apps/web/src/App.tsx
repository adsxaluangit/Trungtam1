import { Navigate, Route, Routes } from 'react-router-dom';
import { Spin } from 'antd';
import { lazy, Suspense } from 'react';
import { useAuth } from './auth';
import AppLayout from './layout/AppLayout';

const DangNhap = lazy(() => import('./pages/DangNhap'));
const DangKy = lazy(() => import('./pages/DangKy'));
const TongQuan = lazy(() => import('./pages/TongQuan'));
const HocVienList = lazy(() => import('./pages/HocVienList'));
const DanhMuc = lazy(() => import('./pages/DanhMuc'));
const QuyetDinh = lazy(() => import('./pages/QuyetDinh'));
const PhanCong = lazy(() => import('./pages/PhanCong'));
const DuyetThi = lazy(() => import('./pages/DuyetThi'));
const NhapDiem = lazy(() => import('./pages/NhapDiem'));
const ThongKe = lazy(() => import('./pages/ThongKe'));
const TraCuu = lazy(() => import('./pages/TraCuu'));
const QuanTri = lazy(() => import('./pages/QuanTri'));
const MauIn = lazy(() => import('./pages/MauIn'));
const DoiMatKhau = lazy(() => import('./pages/DoiMatKhau'));
const AiConfig = lazy(() => import('./pages/AiConfig'));

const Loading = () => (
  <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
    <Spin size="large" />
  </div>
);

export default function App() {
  const { nguoiDung, dangTai } = useAuth();

  if (dangTai) {
    return <Loading />;
  }

  if (!nguoiDung) {
    return (
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<DangKy />} />
          <Route path="/dang-ky" element={<DangKy />} />
          <Route path="/dang-nhap" element={<DangNhap />} />
          <Route path="/login" element={<DangNhap />} />
          <Route path="/quan-ly" element={<DangNhap />} />
          <Route path="*" element={<Navigate to="/dang-nhap" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<DangKy />} />
        <Route path="/dang-ky" element={<DangKy />} />
        <Route path="/dang-nhap" element={<Navigate to="/tong-quan" replace />} />
        <Route path="/login" element={<Navigate to="/tong-quan" replace />} />
        <Route path="/quan-ly" element={<Navigate to="/tong-quan" replace />} />
        <Route element={<AppLayout />}>
          <Route path="tong-quan" element={<TongQuan />} />
          <Route path="hoc-vien" element={<HocVienList />} />
          <Route path="danh-muc" element={<DanhMuc />} />
          <Route path="quyet-dinh" element={<QuyetDinh mode="OPENING" />} />
          <Route path="phan-cong" element={<PhanCong />} />
          <Route path="duyet-thi" element={<DuyetThi />} />
          <Route path="nhap-diem" element={<NhapDiem />} />
          <Route path="cong-nhan" element={<QuyetDinh mode="RECOGNITION" />} />
          <Route path="thong-ke" element={<ThongKe />} />
          <Route path="tra-cuu" element={<TraCuu />} />
          <Route path="quan-tri" element={<QuanTri />} />
          <Route path="mau-in" element={<MauIn />} />
          <Route path="doi-mat-khau" element={<DoiMatKhau />} />
          <Route path="cau-hinh-ai" element={<AiConfig />} />
          <Route path="*" element={<Navigate to="/tong-quan" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

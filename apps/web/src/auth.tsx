import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokenStore } from './api';

export interface VaiTroInfo {
  id?: number;
  name?: string;
  type?: string;
  description?: string;
}

export interface NguoiDung {
  id: number;
  username: string;
  email: string;
  permissions: string[] | null;
  role?: VaiTroInfo;
  blocked?: boolean;
  confirmed?: boolean;
}

interface AuthCtx {
  nguoiDung: NguoiDung | null;
  dangTai: boolean;
  dangNhap: (token: string, nd: NguoiDung) => void;
  dangXuat: () => void;
  lamMoiNguoiDung: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [nguoiDung, setNguoiDung] = useState<NguoiDung | null>(null);
  const [dangTai, setDangTai] = useState(!!tokenStore.get());

  const dangXuat = useCallback(() => {
    tokenStore.clear();
    setNguoiDung(null);
    qc.clear();
  }, [qc]);

  const lamMoiNguoiDung = useCallback(async () => {
    if (!tokenStore.get()) return;
    try {
      const nd = await api<NguoiDung>('/users/me?populate=*');
      setNguoiDung(nd);
    } catch {
      tokenStore.clear();
      setNguoiDung(null);
    }
  }, []);

  useEffect(() => {
    if (tokenStore.get()) {
      lamMoiNguoiDung().finally(() => setDangTai(false));
    } else {
      setDangTai(false);
    }
    const h = () => setNguoiDung(null);
    window.addEventListener('edumaster:dang-xuat', h);
    return () => window.removeEventListener('edumaster:dang-xuat', h);
  }, [lamMoiNguoiDung]);

  const dangNhap = useCallback((token: string, nd: NguoiDung) => {
    tokenStore.set(token);
    setNguoiDung(nd);
  }, []);

  return (
    <Ctx.Provider value={{ nguoiDung, dangTai, dangNhap, dangXuat, lamMoiNguoiDung }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

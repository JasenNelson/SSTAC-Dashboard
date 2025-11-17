'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  clearAdminStatusBackup,
  refreshGlobalAdminStatus,
} from '@/lib/admin-utils';

interface AdminContextValue {
  isAdmin: boolean;
  isCheckingAdmin: boolean;
  refreshAdminStatus: (force?: boolean) => Promise<boolean>;
  clearAdminStatus: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

function restoreAdminStatusFromStorage(userId: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return localStorage.getItem(`admin_status_${userId}`) === 'true';
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const refreshAdminStatus = useCallback(
    async (force = false) => {
      if (!session?.user) {
        setIsAdmin(false);
        setIsChecking(false);
        return false;
      }

      if (!force && restoreAdminStatusFromStorage(session.user.id)) {
        setIsAdmin(true);
        setIsChecking(false);
        return true;
      }

      setIsChecking(true);
      const status = await refreshGlobalAdminStatus(force);
      setIsAdmin(status);
      setIsChecking(false);
      return status;
    },
    [session?.user],
  );

  useEffect(() => {
    if (session?.user) {
      void refreshAdminStatus();
    } else {
      setIsAdmin(false);
      setIsChecking(false);
    }
  }, [session?.user, refreshAdminStatus]);

  const contextValue = useMemo<AdminContextValue>(
    () => ({
      isAdmin,
      isCheckingAdmin: isChecking,
      refreshAdminStatus,
      clearAdminStatus: clearAdminStatusBackup,
    }),
    [isAdmin, isChecking, refreshAdminStatus],
  );

  return (
    <AdminContext.Provider value={contextValue}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}


"use client";

import { apiClient } from "@ecommerce/api-client";
import type { AdminUser } from "@ecommerce/types";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface AdminAuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getCurrentAdminUser()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      user,
      loading,
      register: async (input) => setUser(await apiClient.registerAdmin(input)),
      login: async (email, password) => setUser(await apiClient.adminLogin(email, password)),
      resetPassword: async (email, newPassword) => apiClient.resetAdminPassword(email, newPassword),
      logout: async () => {
        await apiClient.adminLogout();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  return ctx;
}

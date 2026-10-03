"use client";

import { apiClient } from "@ecommerce/api-client";
import type { AdminUser } from "@ecommerce/types";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

interface AdminAuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    apiClient
      .getCurrentAdminUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // O token de login do admin dura 1 hora. Passado isso, ao recarregar a pagina o servidor responde "ninguem logado",
  // e as paginas que devolvem null antes de montar o AdminShell (Empresas, Clientes, Configuracoes...) ficavam em
  // branco pra sempre, porque era o AdminShell que mandava pro login. Agora o redirecionamento vale pra qualquer rota
  // que nao seja uma das telas publicas de acesso.
  useEffect(() => {
    if (loading || user) return;
    const publicas = ["/login", "/criar-conta", "/esqueci-senha", "/redefinir-senha"];
    if (publicas.some((rota) => pathname === rota || pathname.startsWith(rota + "/"))) return;
    router.replace("/login");
  }, [loading, user, pathname, router]);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      user,
      loading,
      register: async (input) => setUser(await apiClient.registerAdmin(input)),
      login: async (email, password) => setUser(await apiClient.adminLogin(email, password)),
      resetPassword: async (email) => apiClient.resetAdminPassword(email),
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

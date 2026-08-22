"use client";

import { apiClient, type RegisterInput } from "@ecommerce/api-client";
import type { Customer } from "@ecommerce/types";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface AuthContextValue {
  customer: Customer | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getCurrentCustomer()
      .then(setCustomer)
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      customer,
      loading,
      login: async (email, password) => setCustomer(await apiClient.login(email, password)),
      register: async (input) => setCustomer(await apiClient.register(input)),
      logout: async () => {
        await apiClient.logout();
        setCustomer(null);
      },
    }),
    [customer, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

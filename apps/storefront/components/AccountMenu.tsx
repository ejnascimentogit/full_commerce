"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function AccountMenu() {
  const { customer, loading, logout } = useAuth();

  if (loading) {
    return <div className="w-24 h-9 rounded-md bg-white/20 animate-pulse" />;
  }

  if (customer) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/conta" className="font-medium hover:underline">
          Olá, {customer.name.split(" ")[0]}
        </Link>
        <button type="button" onClick={() => logout()} className="text-brand-100 hover:text-white hover:underline">
          Sair
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/conta/entrar"
      className="bg-white text-brand-700 font-semibold rounded-md px-4 py-2 text-sm text-center leading-tight hover:bg-brand-50"
    >
      Cadastre-se
      <span className="block font-normal text-xs text-slate-500">Ou faça Login</span>
    </Link>
  );
}

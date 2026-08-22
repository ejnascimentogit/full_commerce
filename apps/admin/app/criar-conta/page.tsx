"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function CriarContaAdminPage() {
  const { register } = useAdminAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register({ name, email, password });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error && err.message === "EMAIL_IN_USE" ? "Esse e-mail já está cadastrado." : "Não foi possível criar a conta.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-slate-900 mb-1">
          full<span className="text-brand-600">commerce</span>
        </h1>
        <p className="text-sm text-slate-500 mb-6">Criar sua conta de administrador da plataforma</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-600 text-white font-semibold rounded-md py-2.5 hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <p className="text-sm text-slate-500 mt-4">
          Já tem conta?{" "}
          <Link href="/login" className="text-brand-600 font-medium hover:underline">
            Entrar
          </Link>
        </p>

        <p className="text-xs text-slate-400 mt-6 pt-4 border-t border-slate-100">
          Essa conta tem acesso total ao painel (papel de plataforma).
        </p>
      </div>
    </div>
  );
}

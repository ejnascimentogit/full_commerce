"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { PasswordField } from "@/components/PasswordField";

export default function EsqueciSenhaAdminPage() {
  const { resetPassword } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(email, newPassword);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error && err.message === "EMAIL_NOT_FOUND" ? "Não encontramos esse e-mail." : "Não foi possível redefinir a senha.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-slate-900 mb-1">
          full<span className="text-brand-600">commerce</span>
        </h1>

        {done ? (
          <>
            <p className="text-sm text-slate-500 mb-6">Senha redefinida — já pode entrar com a nova senha.</p>
            <Link href="/login" className="text-brand-600 font-medium hover:underline text-sm">
              Ir para o login
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-6">Informe seu e-mail e defina uma nova senha.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
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
              <PasswordField label="Nova senha" value={newPassword} onChange={setNewPassword} required minLength={6} />
              <PasswordField label="Confirmar nova senha" value={confirmPassword} onChange={setConfirmPassword} required minLength={6} />

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-600 text-white font-semibold rounded-md py-2.5 hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? "Redefinindo..." : "Redefinir senha"}
              </button>
            </form>

            <p className="text-sm text-slate-500 mt-4">
              <Link href="/login" className="text-brand-600 font-medium hover:underline">
                Voltar para o login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function EsqueciSenhaAdminPage() {
  const { resetPassword } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await resetPassword(email);
    setSubmitting(false);
    setDone(true);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-slate-900 mb-1">
          full<span className="text-brand-600">commerce</span>
        </h1>

        {done ? (
          <>
            <p className="text-sm text-slate-500 mb-6">
              Se esse e-mail tiver uma conta, mandamos um link pra redefinir a senha. Confira sua caixa de entrada.
            </p>
            <Link href="/login" className="text-brand-600 font-medium hover:underline text-sm">
              Voltar para o login
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-6">Informe seu e-mail — vamos te mandar um link pra redefinir a senha.</p>

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

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-600 text-white font-semibold rounded-md py-2.5 hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? "Enviando..." : "Enviar link"}
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

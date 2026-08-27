"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PasswordField } from "@/components/PasswordField";

// Público, não vem de variável de ambiente de propósito — é a chave anônima do
// Supabase (segura para expor no navegador, é pra isso que ela existe) e o
// próprio Supabase quem redireciona pra cá com o token de recuperação, então
// depender de env var de build só adicionaria mais uma coisa pra esquecer de
// configurar num deploy (like aconteceu com NEXT_PUBLIC_API_MODE).
const SUPABASE_URL = "https://ijruithwgvxdqhatgwqd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqcnVpdGh3Z3Z4ZHFoYXRnd3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Nzg3NTksImV4cCI6MjEwMjA1NDc1OX0.0fMuMcb04TlPd8jyigEh5hUqmBl5xiwBu9VesKtSYpI";

export default function RedefinirSenhaPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // O Supabase manda o token no fragmento da URL (#access_token=...), não na
    // query — só existe no navegador, então isso precisa rodar no client.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    setAccessToken(hash.get("access_token"));
    setChecked(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!accessToken) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError("Não foi possível redefinir a senha. O link pode ter expirado — peça um novo.");
      setSubmitting(false);
    }
  }

  if (!checked) return null;

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Link inválido ou expirado</h1>
        <Link href="/conta/esqueci-senha" className="text-brand-600 font-medium hover:underline text-sm">
          Pedir um novo link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Senha redefinida</h1>
        <p className="text-sm text-slate-500 mb-6">Já pode entrar com a nova senha.</p>
        <Link href="/conta/entrar" className="text-brand-600 font-medium hover:underline text-sm">
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Redefinir senha</h1>
      <p className="text-sm text-slate-500 mb-6">Defina sua nova senha.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField label="Nova senha" value={newPassword} onChange={setNewPassword} required minLength={6} />
        <PasswordField label="Confirmar nova senha" value={confirmPassword} onChange={setConfirmPassword} required minLength={6} />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 text-white font-semibold rounded-md py-2.5 hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}

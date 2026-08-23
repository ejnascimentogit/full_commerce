"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PasswordField } from "@/components/PasswordField";

export default function EntrarPage() {
  return (
    <Suspense>
      <EntrarForm />
    </Suspense>
  );
}

function EntrarForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      router.push(searchParams.get("redirect") ?? "/conta");
    } catch {
      setError("E-mail ou senha inválidos.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Entrar</h1>

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
        <PasswordField label="Senha" value={password} onChange={setPassword} required />

        <p className="text-right -mt-2">
          <Link href="/conta/esqueci-senha" className="text-xs text-brand-600 font-medium hover:underline">
            Esqueci minha senha
          </Link>
        </p>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 text-white font-semibold rounded-md py-2.5 hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="text-sm text-slate-500 mt-4">
        Ainda não tem conta?{" "}
        <Link href="/conta/criar" className="text-brand-600 font-medium hover:underline">
          Criar uma conta
        </Link>
      </p>
    </div>
  );
}

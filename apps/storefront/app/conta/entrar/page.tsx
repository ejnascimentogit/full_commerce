"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDocument, onlyDigits } from "@ecommerce/api-client";
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
  const { login, checkFirstAccess, completeFirstAccess } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Primeiro acesso: cliente cadastrado pelo vendedor ainda sem senha.
  const [firstAccess, setFirstAccess] = useState(false);
  const [document, setDocument] = useState("");
  const [confirm, setConfirm] = useState("");

  async function handleEmailBlur() {
    if (!email.includes("@")) return;
    try {
      setFirstAccess(await checkFirstAccess(email));
    } catch {
      setFirstAccess(false); // se a checagem falhar, segue o login normal
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (firstAccess) {
        if (password !== confirm) {
          setError("As senhas não são iguais.");
          setSubmitting(false);
          return;
        }
        await completeFirstAccess({ email, document, password });
        router.push(searchParams.get("redirect") ?? "/conta");
        return;
      }
      await login(email, password);
      router.push(searchParams.get("redirect") ?? "/conta");
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        firstAccess
          ? code === "WEAK_PASSWORD"
            ? "A senha precisa ter pelo menos 6 caracteres."
            : "Não foi possível confirmar seus dados. Confira o CPF/CNPJ do cadastro."
          : "E-mail ou senha inválidos.",
      );
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
            onChange={(e) => {
              setEmail(e.target.value);
              setFirstAccess(false);
            }}
            onBlur={handleEmailBlur}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>

        {firstAccess ? (
          <>
            <div className="bg-brand-50 border border-brand-100 rounded-md px-3 py-2 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Primeiro acesso</p>
              <p className="text-xs mt-1">Seu cadastro foi feito pela nossa equipe. Confirme seu CPF/CNPJ e crie sua senha para entrar.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CPF ou CNPJ do cadastro</label>
              <input
                required
                inputMode="numeric"
                value={document}
                onChange={(e) => {
                  const digits = onlyDigits(e.target.value);
                  setDocument(formatDocument(digits.length > 11 ? "cnpj" : "cpf", e.target.value));
                }}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <PasswordField label="Crie sua senha" value={password} onChange={setPassword} required minLength={6} />
            <PasswordField label="Repita a senha" value={confirm} onChange={setConfirm} required minLength={6} />
          </>
        ) : (
          <>
            <PasswordField label="Senha" value={password} onChange={setPassword} required />

            <p className="text-right -mt-2">
              <Link href="/conta/esqueci-senha" className="text-xs text-brand-600 font-medium hover:underline">
                Esqueci minha senha
              </Link>
            </p>
          </>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 text-white font-semibold rounded-md py-2.5 hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Entrando..." : firstAccess ? "Criar senha e entrar" : "Entrar"}
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

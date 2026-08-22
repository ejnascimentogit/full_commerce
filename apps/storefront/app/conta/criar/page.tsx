"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@ecommerce/api-client";
import type { DeliveryRegion, DocumentType } from "@ecommerce/types";
import { useAuth } from "@/lib/auth-context";

export default function CriarContaPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [regions, setRegions] = useState<DeliveryRegion[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("cnpj");
  const [document, setDocument] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [regionId, setRegionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient.getRegions().then((r) => {
      setRegions(r);
      setRegionId(r[0]?.id ?? "");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register({
        name,
        email,
        password,
        documentType,
        document,
        businessName: documentType === "cnpj" ? businessName : undefined,
        phone,
        regionId,
      });
      router.push("/conta");
    } catch (err) {
      setError(err instanceof Error && err.message === "EMAIL_IN_USE" ? "Esse e-mail já está cadastrado." : "Não foi possível criar a conta.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Criar uma conta</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDocumentType("cnpj")}
            className={`flex-1 border rounded-md py-2 text-sm font-medium ${documentType === "cnpj" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}
          >
            Pessoa jurídica (CNPJ)
          </button>
          <button
            type="button"
            onClick={() => setDocumentType("cpf")}
            className={`flex-1 border rounded-md py-2 text-sm font-medium ${documentType === "cpf" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}
          >
            Pessoa física (CPF)
          </button>
        </div>
        {documentType === "cnpj" && (
          <p className="text-xs text-green-700 bg-green-50 rounded-md px-3 py-2">Clientes CNPJ têm frete grátis.</p>
        )}

        <Field label={documentType === "cnpj" ? "Nome do responsável" : "Nome completo"} value={name} onChange={setName} required />
        {documentType === "cnpj" && (
          <Field label="Razão social" value={businessName} onChange={setBusinessName} required />
        )}
        <Field label={documentType.toUpperCase()} value={document} onChange={setDocument} required />
        <Field label="E-mail" type="email" value={email} onChange={setEmail} required />
        <Field label="Telefone" value={phone} onChange={setPhone} required />
        <Field label="Senha" type="password" value={password} onChange={setPassword} required />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Região de entrega</label>
          <select
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
            required
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
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
        <Link href="/conta/entrar" className="text-brand-600 font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
      />
    </div>
  );
}

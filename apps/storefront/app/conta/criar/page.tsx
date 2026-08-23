"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCep, formatDocument, isValidDocument, lookupCep, onlyDigits } from "@ecommerce/api-client";
import type { DocumentType } from "@ecommerce/types";
import { useAuth } from "@/lib/auth-context";
import { PasswordField } from "@/components/PasswordField";

export default function CriarContaPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("cnpj");
  const [document, setDocument] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");

  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const documentDigitCount = documentType === "cpf" ? 11 : 14;
  const documentComplete = onlyDigits(document).length === documentDigitCount;
  const documentValid = documentComplete && isValidDocument(documentType, document);

  function handleDocumentChange(value: string) {
    setDocument(formatDocument(documentType, value));
  }

  function handleDocumentTypeChange(type: DocumentType) {
    setDocumentType(type);
    setDocument(""); // formato muda (CPF x CNPJ) — evita máscara inválida de sobra
  }

  async function handleZipCodeBlur() {
    const digits = onlyDigits(zipCode);
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepError(null);
    try {
      const address = await lookupCep(digits);
      if (!address) {
        setCepError("CEP não encontrado.");
        return;
      }
      setStreet(address.street);
      setNeighborhood(address.neighborhood);
      setCity(address.city);
      setState(address.state);
    } catch {
      setCepError("Não foi possível buscar o CEP agora — preencha manualmente.");
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!documentValid) {
      setError(`${documentType.toUpperCase()} inválido — confira os números digitados.`);
      return;
    }
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
        address: { street, number, complement: complement || undefined, neighborhood, city, state, zipCode },
      });
      router.push("/conta");
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "EMAIL_IN_USE"
          ? "Esse e-mail já está cadastrado."
          : code === "INVALID_DOCUMENT"
            ? `${documentType.toUpperCase()} inválido — confira os números digitados.`
            : "Não foi possível criar a conta.",
      );
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
            onClick={() => handleDocumentTypeChange("cnpj")}
            className={`flex-1 border rounded-md py-2 text-sm font-medium ${documentType === "cnpj" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}
          >
            Pessoa jurídica (CNPJ)
          </button>
          <button
            type="button"
            onClick={() => handleDocumentTypeChange("cpf")}
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

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{documentType.toUpperCase()}</label>
          <input
            type="text"
            inputMode="numeric"
            required
            value={document}
            onChange={(e) => handleDocumentChange(e.target.value)}
            placeholder={documentType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
            className={`w-full border rounded-md px-3 py-2 text-sm ${documentComplete && !documentValid ? "border-red-400" : "border-slate-300"}`}
          />
          {documentComplete && !documentValid && (
            <p className="text-red-600 text-xs mt-1">{documentType.toUpperCase()} inválido.</p>
          )}
        </div>

        <Field label="E-mail" type="email" value={email} onChange={setEmail} required />
        <Field label="Telefone" value={phone} onChange={setPhone} required />
        <PasswordField label="Senha" value={password} onChange={setPassword} required minLength={6} />

        <div className="pt-2 border-t border-slate-100">
          <p className="text-sm font-semibold text-slate-900 mb-3 pt-2">Endereço de entrega</p>

          <div className="mb-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
            <input
              type="text"
              inputMode="numeric"
              required
              value={zipCode}
              onChange={(e) => setZipCode(formatCep(e.target.value))}
              onBlur={handleZipCodeBlur}
              placeholder="00000-000"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            {cepLoading && <p className="text-xs text-slate-400 mt-1">Buscando endereço...</p>}
            {cepError && <p className="text-xs text-amber-600 mt-1">{cepError}</p>}
          </div>

          <div className="space-y-3">
            <Field label="Rua" value={street} onChange={setStreet} required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número" value={number} onChange={setNumber} required />
              <Field label="Complemento" value={complement} onChange={setComplement} />
            </div>
            <Field label="Bairro" value={neighborhood} onChange={setNeighborhood} required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade" value={city} onChange={setCity} required />
              <Field label="Estado" value={state} onChange={setState} required />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Sua região de entrega é definida automaticamente pelo bairro — não precisa escolher.
          </p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting || (documentComplete && !documentValid)}
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

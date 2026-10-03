"use client";

import { useEffect, useRef, useState } from "react";
import { apiClient } from "@ecommerce/api-client";
import { AdminShell } from "@/components/AdminShell";
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  SAMPLE_VARS,
  WHATSAPP_KIND_LABEL,
  WHATSAPP_VARIABLES,
  renderTemplate,
  type WhatsappKind,
} from "@/lib/whatsapp";

const KINDS: WhatsappKind[] = ["pedidos", "orcamentos", "perdidos"];

const KIND_HINT: Record<WhatsappKind, string> = {
  pedidos: "Usado no botão WhatsApp da lista de Pedidos.",
  orcamentos: "Usado no botão WhatsApp da lista de Orçamentos.",
  perdidos: "Usado no botão WhatsApp da lista de Perdidos, para tentar recuperar a venda.",
};

// Textos prontos das mensagens de WhatsApp. Cada tela (Pedidos, Orçamentos, Perdidos) usa o seu; o vendedor
// ainda pode editar o texto na hora de enviar, sem mudar o modelo salvo aqui.
export default function MensagensPage() {
  const [texts, setTexts] = useState<Record<WhatsappKind, string>>({ ...DEFAULT_WHATSAPP_TEMPLATES });
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areas = useRef<Partial<Record<WhatsappKind, HTMLTextAreaElement | null>>>({});

  useEffect(() => {
    apiClient
      .getStoreSettings()
      .then((settings) => {
        const next = { ...DEFAULT_WHATSAPP_TEMPLATES };
        for (const kind of KINDS) {
          const value = settings.whatsappTemplates?.[kind];
          if (value && value.trim()) next[kind] = value;
        }
        setTexts(next);
        setStoreName(settings.siteCopy?.storeName ?? "");
      })
      .catch(() => setError("Não foi possível carregar os textos salvos. Mostrando os padrões."))
      .finally(() => setLoading(false));
  }, []);

  function insertVariable(kind: WhatsappKind, key: string) {
    const token = `{${key}}`;
    const el = areas.current[kind];
    if (!el) {
      setTexts((prev) => ({ ...prev, [kind]: prev[kind] + token }));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    setTexts((prev) => ({ ...prev, [kind]: el.value.slice(0, start) + token + el.value.slice(end) }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiClient.updateStoreSettings({ whatsappTemplates: texts });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Não foi possível salvar. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Mensagens de WhatsApp</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-700">Salvo!</span>}
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="text-sm font-medium bg-brand-600 text-white px-4 py-2 rounded-md hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar textos"}
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Escreva o texto pronto de cada tela. Clique numa variável para inserir no ponto em que o cursor está: na hora de enviar,
        ela é trocada pelos dados do cliente.
      </p>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="space-y-6">
        {KINDS.map((kind) => {
          const variables = WHATSAPP_VARIABLES.filter((v) => v.kinds.includes(kind));
          const preview = renderTemplate(texts[kind], { ...SAMPLE_VARS[kind], empresa: storeName || "Sua loja" });
          return (
            <section key={kind} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-semibold text-slate-900">{WHATSAPP_KIND_LABEL[kind]}</h2>
                  <p className="text-xs text-slate-500">{KIND_HINT[kind]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTexts((prev) => ({ ...prev, [kind]: DEFAULT_WHATSAPP_TEMPLATES[kind] }))}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Restaurar texto padrão
                </button>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <textarea
                    ref={(el) => {
                      areas.current[kind] = el;
                    }}
                    value={texts[kind]}
                    onChange={(e) => setTexts((prev) => ({ ...prev, [kind]: e.target.value }))}
                    rows={9}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {variables.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        title={v.label}
                        onClick={() => insertVariable(kind, v.key)}
                        className="text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded-full px-2.5 py-1 hover:bg-slate-200"
                      >
                        {`{${v.key}}`}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Prévia (com dados de exemplo)</p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-slate-800 whitespace-pre-wrap">
                    {preview}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}

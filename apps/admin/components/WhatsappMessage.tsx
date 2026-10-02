"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@ecommerce/api-client";
import type { Customer } from "@ecommerce/types";
import {
  WHATSAPP_WINDOW_NAME,
  firstName,
  renderTemplate,
  templateFor,
  whatsappAppUrl,
  whatsappPhone,
  whatsappWebUrl,
  type WhatsappKind,
} from "@/lib/whatsapp";

// Textos configurados em Mensagens + nome da loja, carregados 1x por tela.
function useWhatsappSettings() {
  const [state, setState] = useState<{ templates: Partial<Record<WhatsappKind, string>>; storeName: string }>({
    templates: {},
    storeName: "",
  });
  useEffect(() => {
    apiClient
      .getStoreSettings()
      .then((settings) => setState({ templates: settings.whatsappTemplates ?? {}, storeName: settings.siteCopy?.storeName ?? "" }))
      .catch(() => {});
  }, []);
  return state;
}

// Botão pequeno que fica ao lado do valor (R$) da linha.
export function WhatsappButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      title="Mensagem de WhatsApp para o cliente"
      className={`ml-2 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border align-middle ${
        open ? "bg-green-600 text-white border-green-600" : "bg-white text-green-700 border-green-300 hover:bg-green-50"
      }`}
    >
      <span aria-hidden>💬</span> WhatsApp
    </button>
  );
}

// Área que abre embaixo da linha: texto pronto (do modelo configurado), editável antes de enviar.
export function WhatsappPanel({
  kind,
  customer,
  vars,
  onClose,
}: {
  kind: WhatsappKind;
  customer: Customer | undefined;
  vars: Record<string, string>;
  onClose: () => void;
}) {
  const { templates, storeName } = useWhatsappSettings();
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generated = renderTemplate(templateFor(kind, templates), {
    nome: customer?.name ?? "",
    primeiro_nome: firstName(customer?.name) || "tudo bem",
    empresa: storeName || "nossa loja",
    ...vars,
  });
  const text = edited ?? generated;
  const phone = whatsappPhone(customer?.phone);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de área de transferência: o texto continua na caixa, dá pra copiar na mão.
    }
  }

  return (
    <div className="bg-green-50/60 border border-green-200 rounded-lg p-3 text-left">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-800">
          Mensagem para {customer?.name ?? "o cliente"}
          {customer?.phone && <span className="font-normal text-slate-500"> | {customer.phone}</span>}
        </span>
        <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-800">
          Fechar
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setEdited(e.target.value)}
        rows={Math.min(14, Math.max(5, text.split("\n").length + 1))}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
      />
      {!phone && (
        <p className="text-xs text-amber-700 mt-1">Este cliente não tem telefone válido cadastrado — dá para copiar o texto, mas não abrir a conversa.</p>
      )}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <button
          type="button"
          disabled={!phone}
          onClick={() => phone && window.open(whatsappWebUrl(phone, text), WHATSAPP_WINDOW_NAME)}
          className="text-sm font-medium bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Enviar pelo WhatsApp Web
        </button>
        <button
          type="button"
          disabled={!phone}
          onClick={() => phone && (window.location.href = whatsappAppUrl(phone, text))}
          className="text-sm font-medium bg-white text-green-700 border border-green-300 px-3 py-1.5 rounded-md hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Abrir no aplicativo
        </button>
        <button
          type="button"
          onClick={copy}
          className="text-sm font-medium bg-white text-slate-700 border border-slate-300 px-3 py-1.5 rounded-md hover:bg-slate-50"
        >
          {copied ? "Copiado!" : "Copiar texto"}
        </button>
        {edited !== null && (
          <button type="button" onClick={() => setEdited(null)} className="text-xs text-slate-500 hover:text-slate-800 underline">
            Voltar ao texto original
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-2">
        O WhatsApp Web só funciona em uma aba por vez: use sempre este botão, que reaproveita a mesma aba para todos os clientes.
      </p>
    </div>
  );
}

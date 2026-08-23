"use client";

import { useState } from "react";

// Ícone "?" pequeno ao lado de um label — passa o mouse (ou toca, no celular)
// pra ver uma explicação curta. Mesmo padrão usado em formulários de
// pagamento/config em quase todo produto SaaS (Stripe, Notion, etc.).
export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        aria-label="Mais informações"
        className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold leading-none flex items-center justify-center hover:bg-slate-300 shrink-0"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-900 text-white text-xs leading-relaxed rounded-md px-3 py-2 shadow-lg"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </span>
      )}
    </span>
  );
}

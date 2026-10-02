"use client";

import { useEffect, useState, type ReactNode } from "react";

// Evento disparado pela busca de ajuda de Configuracoes (goToSection) pra abrir o bloco de destino antes de rolar ate ele.
export const CONFIG_EXPAND_EVENT = "config-expand";

// Bloco recolhivel das Configuracoes: comeca fechado, so o cabecalho visivel; clicar no titulo abre/fecha.
// O conteudo continua montado quando fechado (so escondido), entao o que a pessoa digitou e ainda nao salvou nao se perde.
export function CollapsibleSection({
  id,
  expandKey,
  title,
  className,
  action,
  children,
  defaultOpen = false,
}: {
  id?: string;
  expandKey?: string;
  title: string;
  className?: string;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const key = expandKey ?? id;

  useEffect(() => {
    if (!key) return;
    const onExpand = (e: Event) => {
      if ((e as CustomEvent<string>).detail === key) setOpen(true);
    };
    window.addEventListener(CONFIG_EXPAND_EVENT, onExpand);
    return () => window.removeEventListener(CONFIG_EXPAND_EVENT, onExpand);
  }, [key]);

  return (
    <section id={id} className={className}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <span aria-hidden className={`text-xs text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}>
            ▶
          </span>
          <h2 className="font-semibold text-slate-900">{title}</h2>
        </button>
        {action}
      </div>
      <div className={open ? "mt-3" : "hidden"}>{children}</div>
    </section>
  );
}

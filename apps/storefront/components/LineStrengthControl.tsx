"use client";

import { useEffect, useState } from "react";

// Intensidade das linhas/contornos: preferencia de cada pessoa, guardada so neste navegador (localStorage).
// 0 = padrao (como sempre foi); quanto maior, mais escuras as linhas. O efeito vem do CSS global (--line-strength em
// globals.css); o layout aplica o valor salvo antes da primeira pintura, entao nao pisca.
const KEY = "ecommerce.lineStrength";

export function LineStrengthControl({ inline = false }: { inline?: boolean }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved !== null) setValue(Math.min(100, Math.max(0, Number(saved) || 0)));
    } catch {}
  }, []);

  function change(next: number) {
    setValue(next);
    document.documentElement.style.setProperty("--line-strength", String(next));
    try {
      localStorage.setItem(KEY, String(next));
    } catch {}
  }

  const slider = (
    <input
      type="range"
      min={0}
      max={100}
      value={value}
      onChange={(e) => change(Number(e.target.value))}
      aria-label="Intensidade das linhas"
      className={inline ? "w-40 accent-white" : "w-full accent-brand-500"}
    />
  );

  if (inline) {
    return (
      <div className="flex items-center gap-3 text-xs text-white/60">
        <span>Aparência · linhas</span>
        <span>Suave</span>
        {slider}
        <span>Forte</span>
        <span className="tabular-nums w-6 text-right">{value}</span>
        <button type="button" onClick={() => change(0)} disabled={value === 0} className="hover:text-white disabled:opacity-40">
          ↺ Padrão
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-3 border-t border-slate-800">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Aparência</p>
      <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
        <span>Linhas</span>
        <span className="tabular-nums">{value}</span>
      </div>
      {slider}
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>Suave</span>
        <span>Forte</span>
      </div>
      <button type="button" onClick={() => change(0)} disabled={value === 0} className="mt-1 text-xs text-slate-400 hover:text-white disabled:opacity-40">
        ↺ Padrão
      </button>
    </div>
  );
}

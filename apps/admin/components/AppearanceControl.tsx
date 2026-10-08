"use client";

import { useEffect, useState } from "react";

// Preferências de aparência de cada pessoa, guardadas só neste navegador (localStorage): modo escuro e intensidade das
// linhas. Os efeitos vêm do CSS global (globals.css: classe "dark" e variável --line-strength no <html>); o layout aplica
// os valores salvos antes da primeira pintura, então não pisca. Linhas: 0 = padrão; quanto maior, mais contraste.
const LINE_KEY = "ecommerce.lineStrength";
const MODE_KEY = "ecommerce.themeMode";

function clamp(n: number): number {
  return Math.min(100, Math.max(0, n));
}

export function AppearanceControl({ inline = false }: { inline?: boolean }) {
  const [value, setValue] = useState(0);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LINE_KEY);
      if (saved !== null) setValue(clamp(Number(saved) || 0));
      setDark(localStorage.getItem(MODE_KEY) === "dark");
    } catch {}
  }, []);

  function changeLine(next: number) {
    setValue(next);
    document.documentElement.style.setProperty("--line-strength", String(next));
    try {
      localStorage.setItem(LINE_KEY, String(next));
    } catch {}
  }

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(MODE_KEY, next ? "dark" : "light");
    } catch {}
  }

  const slider = (
    <input
      type="range"
      min={0}
      max={100}
      value={value}
      onChange={(e) => changeLine(Number(e.target.value))}
      aria-label="Intensidade das linhas"
      className={inline ? "w-40 accent-white" : "w-full accent-brand-500"}
    />
  );

  const modeSwitch = (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={toggleDark}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${dark ? "bg-brand-500" : "bg-slate-500"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${dark ? "translate-x-4.5" : "translate-x-0.5"}`} />
    </button>
  );

  if (inline) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/60">
        <span className="flex items-center gap-2">
          {dark ? "🌙" : "☀️"} Modo escuro {modeSwitch}
        </span>
        <span className="flex items-center gap-3">
          <span>Linhas</span>
          <span>Suave</span>
          {slider}
          <span>Forte</span>
          <span className="tabular-nums w-6 text-right">{value}</span>
          <button type="button" onClick={() => changeLine(0)} disabled={value === 0} className="hover:text-white disabled:opacity-40">
            ↺ Padrão
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="px-5 py-3 border-t border-slate-800">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Aparência</p>
      <div className="flex items-center justify-between text-sm text-slate-300 mb-3">
        <span>{dark ? "🌙 Modo escuro" : "☀️ Modo claro"}</span>
        {modeSwitch}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
        <span>Linhas</span>
        <span className="tabular-nums">{value}</span>
      </div>
      {slider}
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>Suave</span>
        <span>Forte</span>
      </div>
      <button type="button" onClick={() => changeLine(0)} disabled={value === 0} className="mt-1 text-xs text-slate-400 hover:text-white disabled:opacity-40">
        ↺ Padrão
      </button>
    </div>
  );
}

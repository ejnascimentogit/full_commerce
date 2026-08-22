"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@ecommerce/api-client";
import type { StoreSettings } from "@ecommerce/types";

const SOCIAL_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

// Client component pelo mesmo motivo do LogoLink/RegionBar — os dados de
// configuração vêm do mock em localStorage, só existem no navegador.
export function Footer() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    apiClient.getStoreSettings().then(setSettings);
  }, []);

  if (!settings) return null;

  const socialEntries = Object.entries(settings.footer.socialLinks).filter(([, url]) => Boolean(url));

  return (
    <footer className="bg-slate-900 text-slate-300 mt-8">
      <div className="mx-auto max-w-7xl px-4 py-10 grid sm:grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <p className="text-white font-bold text-lg mb-2">{settings.siteCopy.storeName}</p>
          <p className="text-slate-400">B2B por atacado — cadastre-se e compre em poucos cliques.</p>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3">Ajuda</h3>
          <ul className="space-y-2">
            {settings.footer.supportEmail && (
              <li>
                <a href={`mailto:${settings.footer.supportEmail}`} className="hover:text-white">
                  Central de Atendimento
                </a>
              </li>
            )}
            {settings.footer.supportPhone && (
              <li>
                <a href={`tel:${settings.footer.supportPhone}`} className="hover:text-white">
                  {settings.footer.supportPhone}
                </a>
              </li>
            )}
            <li>
              <Link href="/catalogo" className="hover:text-white">
                Política de Entrega
              </Link>
            </li>
            <li>
              <Link href="/catalogo" className="hover:text-white">
                Trocas e Devoluções
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3">Formas de pagamento</h3>
          <ul className="space-y-2">
            <li>Cartão de crédito</li>
            <li>PIX</li>
            <li>Boleto</li>
          </ul>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3">Redes Sociais</h3>
          {socialEntries.length === 0 ? (
            <p className="text-slate-500 text-xs">Cadastre em Configurações no admin.</p>
          ) : (
            <ul className="space-y-2">
              {socialEntries.map(([key, url]) => (
                <li key={key}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    {SOCIAL_LABEL[key] ?? key}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-slate-500 text-center">{settings.footer.legalText}</div>
      </div>
    </footer>
  );
}

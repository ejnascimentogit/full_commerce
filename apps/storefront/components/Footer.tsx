"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@ecommerce/api-client";
import type { StoreSettings } from "@ecommerce/types";

// Client component pelo mesmo motivo do LogoLink/RegionBar — os dados de
// configuração vêm do mock em localStorage, só existem no navegador.
export function Footer() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    apiClient.getStoreSettings().then(setSettings);
  }, []);

  if (!settings) return null;

  const { footer } = settings;

  return (
    <footer className="bg-brand-700 text-white/70 mt-8">
      <div className="mx-auto max-w-7xl px-4 py-10 grid sm:grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <p className="text-white font-bold text-lg mb-2">{settings.siteCopy.storeName}</p>
          <p className="text-white/60">B2B por atacado — cadastre-se e compre em poucos cliques.</p>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3">Ajuda</h3>
          <ul className="space-y-2">
            {footer.supportEmail && (
              <li>
                <a href={`mailto:${footer.supportEmail}`} className="hover:text-white">
                  Central de Atendimento
                </a>
              </li>
            )}
            {footer.supportPhone && (
              <li>
                <a href={`tel:${footer.supportPhone}`} className="hover:text-white">
                  {footer.supportPhone}
                </a>
              </li>
            )}
            {footer.helpLinks.map((link) => (
              <li key={link.id}>
                <Link href={link.url} className="hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
            {!footer.supportEmail && !footer.supportPhone && footer.helpLinks.length === 0 && (
              <li className="text-white/50 text-xs">Cadastre em Configurações no admin.</li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3">Formas de pagamento</h3>
          {footer.paymentMethods.length === 0 ? (
            <p className="text-white/50 text-xs">Cadastre em Configurações no admin.</p>
          ) : (
            <ul className="space-y-2">
              {footer.paymentMethods.map((method) => (
                <li key={method}>{method}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3">Redes Sociais</h3>
          {footer.socialLinks.length === 0 ? (
            <p className="text-white/50 text-xs">Cadastre em Configurações no admin.</p>
          ) : (
            <ul className="space-y-2">
              {footer.socialLinks.map((link) => (
                <li key={link.id}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-white/50 text-center">{footer.legalText}</div>
      </div>
    </footer>
  );
}

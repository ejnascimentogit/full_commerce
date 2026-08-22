"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@ecommerce/api-client";
import type { Banner, FooterSettings, SiteCopy, StoreSettings } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function ConfiguracoesPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [brandColor, setBrandColor] = useState("#1d4ed8");
  const [savingColor, setSavingColor] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingPromotionsToggle, setSavingPromotionsToggle] = useState(false);

  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerLink, setBannerLink] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [siteCopy, setSiteCopy] = useState<SiteCopy | null>(null);
  const [savingCopy, setSavingCopy] = useState(false);

  const [footer, setFooter] = useState<FooterSettings | null>(null);
  const [savingFooter, setSavingFooter] = useState(false);

  useEffect(() => {
    if (user && user.role !== "platformAdmin") router.replace("/");
  }, [user, router]);

  function refresh() {
    apiClient.getStoreSettings().then((s) => {
      setSettings(s);
      setBrandColor(s.brandColor);
      setSiteCopy(s.siteCopy);
      setFooter(s.footer);
    });
  }

  useEffect(refresh, []);

  async function togglePromotionsEnabled() {
    if (!settings) return;
    setSavingPromotionsToggle(true);
    await apiClient.updateStoreSettings({ promotionsEnabled: !settings.promotionsEnabled });
    setSavingPromotionsToggle(false);
    refresh();
  }

  async function handleSaveCopy() {
    if (!siteCopy) return;
    setSavingCopy(true);
    await apiClient.updateStoreSettings({ siteCopy });
    setSavingCopy(false);
    refresh();
  }

  async function handleSaveFooter() {
    if (!footer) return;
    setSavingFooter(true);
    await apiClient.updateStoreSettings({ footer });
    setSavingFooter(false);
    refresh();
  }

  function updateFeatureBullet(index: number, patch: Partial<SiteCopy["featureBullets"][number]>) {
    setSiteCopy((prev) => {
      if (!prev) return prev;
      const featureBullets = prev.featureBullets.map((b, i) => (i === index ? { ...b, ...patch } : b));
      return { ...prev, featureBullets };
    });
  }

  async function handleSaveColor() {
    setSavingColor(true);
    await apiClient.updateStoreSettings({ brandColor });
    setSavingColor(false);
    refresh();
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingLogo(true);
    const url = await apiClient.uploadLogo(file);
    await apiClient.updateStoreSettings({ logoUrl: url });
    setUploadingLogo(false);
    refresh();
  }

  async function removeLogo() {
    await apiClient.updateStoreSettings({ logoUrl: undefined });
    refresh();
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !settings) return;
    setUploadingBanner(true);
    const imageUrl = await apiClient.uploadLogo(file); // mesmo resize/encode, serve pra qualquer imagem
    const banner: Banner = {
      id: `banner-${Date.now()}`,
      imageUrl,
      title: bannerTitle || undefined,
      linkUrl: bannerLink || undefined,
      order: settings.banners.length,
      active: true,
    };
    await apiClient.updateStoreSettings({ banners: [...settings.banners, banner] });
    setBannerTitle("");
    setBannerLink("");
    setUploadingBanner(false);
    refresh();
  }

  async function toggleBannerActive(banner: Banner) {
    if (!settings) return;
    const banners = settings.banners.map((b) => (b.id === banner.id ? { ...b, active: !b.active } : b));
    await apiClient.updateStoreSettings({ banners });
    refresh();
  }

  async function removeBanner(banner: Banner) {
    if (!settings) return;
    const banners = settings.banners.filter((b) => b.id !== banner.id);
    await apiClient.updateStoreSettings({ banners });
    refresh();
  }

  async function moveBanner(banner: Banner, direction: -1 | 1) {
    if (!settings) return;
    const sorted = [...settings.banners].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((b) => b.id === banner.id);
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    const banners = sorted.map((b, i) => ({ ...b, order: i }));
    await apiClient.updateStoreSettings({ banners });
    refresh();
  }

  if (user?.role !== "platformAdmin" || !settings || !siteCopy || !footer) return null;

  const sortedBanners = [...settings.banners].sort((a, b) => a.order - b.order);

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Configurações</h1>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-6 max-w-xl">
        <h2 className="font-semibold text-slate-900 mb-3">Cor da marca</h2>
        <p className="text-sm text-slate-500 mb-3">
          Uma cor só — os outros tons (fundo claro, hover, etc.) são derivados automaticamente.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="w-14 h-10 border border-slate-300 rounded-md cursor-pointer"
          />
          <input
            type="text"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm w-32"
          />
          <button
            type="button"
            onClick={handleSaveColor}
            disabled={savingColor}
            className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {savingColor ? "Salvando..." : "Salvar cor"}
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-6 max-w-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Promoções e cupons</h2>
            <p className="text-sm text-slate-500 mt-1">
              Desligado, nenhum cupom aplica desconto no checkout — mesmo as promoções cadastradas continuam ativas
              (é só um freio geral, não precisa apagar nada).
            </p>
          </div>
          <button
            type="button"
            onClick={togglePromotionsEnabled}
            disabled={savingPromotionsToggle}
            className={`shrink-0 ml-4 relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${settings.promotionsEnabled ? "bg-brand-600" : "bg-slate-300"}`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${settings.promotionsEnabled ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-6 max-w-xl">
        <h2 className="font-semibold text-slate-900 mb-3">Logo</h2>
        <div className="flex items-center gap-4">
          {settings.logoUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- mock data-URI logo */}
              <img src={settings.logoUrl} alt="Logo atual" className="h-14 border border-slate-200 rounded-md px-2" />
              <button
                type="button"
                onClick={removeLogo}
                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs"
              >
                ✕
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sem logo — a loja usa o nome em texto.</p>
          )}
          <label className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 py-2 cursor-pointer hover:bg-brand-50">
            {uploadingLogo ? "Enviando..." : "Trocar logo"}
            <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} className="hidden" />
          </label>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-5 max-w-2xl">
        <h2 className="font-semibold text-slate-900 mb-3">Carrossel da home</h2>

        <div className="space-y-3 mb-4">
          {sortedBanners.map((banner, i) => (
            <div key={banner.id} className="flex items-center gap-3 border border-slate-200 rounded-md p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- mock data-URI banner */}
              <img src={banner.imageUrl} alt={banner.title ?? "Banner"} className="w-24 h-14 object-cover rounded-md shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{banner.title || "(sem título)"}</p>
                <p className="text-xs text-slate-500 truncate">{banner.linkUrl || "sem link"}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => moveBanner(banner, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 px-1">
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveBanner(banner, 1)}
                  disabled={i === sortedBanners.length - 1}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-30 px-1"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => toggleBannerActive(banner)}
                  className={`text-xs px-2 py-0.5 rounded-full ${banner.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                >
                  {banner.active ? "Ativo" : "Inativo"}
                </button>
                <button type="button" onClick={() => removeBanner(banner)} className="text-slate-400 hover:text-red-600 px-1">
                  ✕
                </button>
              </div>
            </div>
          ))}
          {sortedBanners.length === 0 && <p className="text-sm text-slate-500">Nenhum banner ainda.</p>}
        </div>

        <div className="border-t border-slate-100 pt-4 grid sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={bannerTitle}
            onChange={(e) => setBannerTitle(e.target.value)}
            placeholder="Título (opcional)"
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={bannerLink}
            onChange={(e) => setBannerLink(e.target.value)}
            placeholder="Link (opcional, ex: /catalogo)"
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <label className="sm:col-span-2 text-sm text-brand-600 border border-dashed border-brand-300 rounded-md px-3 py-2 text-center cursor-pointer hover:bg-brand-50">
            {uploadingBanner ? "Enviando..." : "+ Adicionar imagem do banner"}
            <input type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploadingBanner} className="hidden" />
          </label>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mt-6 max-w-2xl">
        <h2 className="font-semibold text-slate-900 mb-1">Textos do site</h2>
        <p className="text-sm text-slate-500 mb-4">
          Nome da loja, título de destaque da home e os 3 selos — troque à vontade, sem precisar mexer em código.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da loja</label>
            <input
              type="text"
              value={siteCopy.storeName}
              onChange={(e) => setSiteCopy({ ...siteCopy, storeName: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Título de destaque da home</label>
            <input
              type="text"
              value={siteCopy.heroTitle}
              onChange={(e) => setSiteCopy({ ...siteCopy, heroTitle: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Selos (abaixo do título)</label>
            <div className="space-y-2">
              {siteCopy.featureBullets.map((bullet, i) => (
                <div key={i} className="grid grid-cols-[56px_1fr_2fr] gap-2">
                  <input
                    type="text"
                    value={bullet.icon}
                    onChange={(e) => updateFeatureBullet(i, { icon: e.target.value })}
                    className="border border-slate-300 rounded-md px-2 py-2 text-sm text-center"
                    aria-label={`Ícone do selo ${i + 1}`}
                  />
                  <input
                    type="text"
                    value={bullet.title}
                    onChange={(e) => updateFeatureBullet(i, { title: e.target.value })}
                    placeholder="Título"
                    className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={bullet.text}
                    onChange={(e) => updateFeatureBullet(i, { text: e.target.value })}
                    placeholder="Descrição"
                    className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveCopy}
            disabled={savingCopy}
            className="bg-brand-600 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {savingCopy ? "Salvando..." : "Salvar textos"}
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mt-6 max-w-2xl">
        <h2 className="font-semibold text-slate-900 mb-1">Rodapé</h2>
        <p className="text-sm text-slate-500 mb-4">
          Razão social/CNPJ/endereço, contato de suporte e redes sociais exibidos no rodapé da loja.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Texto legal (razão social, CNPJ, endereço)</label>
            <textarea
              value={footer.legalText}
              onChange={(e) => setFooter({ ...footer, legalText: e.target.value })}
              rows={2}
              placeholder="© 2026 · Sua Empresa Ltda · CNPJ 00.000.000/0001-00 · Rua Exemplo, 123 — Recife/PE"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail de suporte</label>
              <input
                type="email"
                value={footer.supportEmail ?? ""}
                onChange={(e) => setFooter({ ...footer, supportEmail: e.target.value || undefined })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone de suporte</label>
              <input
                type="text"
                value={footer.supportPhone ?? ""}
                onChange={(e) => setFooter({ ...footer, supportPhone: e.target.value || undefined })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Redes sociais (opcional — só aparece o que for preenchido)</label>
            <div className="grid sm:grid-cols-2 gap-3">
              {(["instagram", "facebook", "linkedin", "whatsapp"] as const).map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-20 text-sm text-slate-500 capitalize">{key}</span>
                  <input
                    type="text"
                    value={footer.socialLinks[key] ?? ""}
                    onChange={(e) =>
                      setFooter({ ...footer, socialLinks: { ...footer.socialLinks, [key]: e.target.value || undefined } })
                    }
                    placeholder="https://..."
                    className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveFooter}
            disabled={savingFooter}
            className="bg-brand-600 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {savingFooter ? "Salvando..." : "Salvar rodapé"}
          </button>
        </div>
      </section>
    </AdminShell>
  );
}

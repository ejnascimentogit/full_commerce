"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, PAYMENT_METHOD_LABEL, PAYMENT_METHOD_ORDER } from "@ecommerce/api-client";
import type { Banner, FooterLink, FooterSettings, PaymentMethod, SiteCopy, StoreSettings } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { RegionsSection } from "@/components/RegionsSection";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function ConfiguracoesPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [brandColor, setBrandColor] = useState("#1d4ed8");
  const [savingColor, setSavingColor] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingPromotionsToggle, setSavingPromotionsToggle] = useState(false);
  const [savingDispatchToggle, setSavingDispatchToggle] = useState(false);

  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerLink, setBannerLink] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [siteCopy, setSiteCopy] = useState<SiteCopy | null>(null);
  const [savingCopy, setSavingCopy] = useState(false);

  const [footer, setFooter] = useState<FooterSettings | null>(null);
  const [savingFooter, setSavingFooter] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [newHelpLabel, setNewHelpLabel] = useState("");
  const [newHelpUrl, setNewHelpUrl] = useState("");
  const [newSocialLabel, setNewSocialLabel] = useState("");
  const [newSocialUrl, setNewSocialUrl] = useState("");

  const [minOrderValue, setMinOrderValue] = useState("");
  const [freeShippingForCnpj, setFreeShippingForCnpj] = useState(true);
  const [shippingCost, setShippingCost] = useState("19.90");
  const [savingOrderRules, setSavingOrderRules] = useState(false);

  const [pixKey, setPixKey] = useState("");
  const [pixReceiverName, setPixReceiverName] = useState("");
  const [pixReceiverCity, setPixReceiverCity] = useState("");
  const [maxInstallments, setMaxInstallments] = useState("12");
  const [minInstallmentValue, setMinInstallmentValue] = useState("5");
  const [interestFreeInstallments, setInterestFreeInstallments] = useState("12");
  const [monthlyInterestRate, setMonthlyInterestRate] = useState("0");
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<PaymentMethod[]>(PAYMENT_METHOD_ORDER);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "platformAdmin") router.replace("/");
  }, [user, router]);

  function refresh() {
    apiClient.getStoreSettings().then((s) => {
      setSettings(s);
      setBrandColor(s.brandColor);
      setSiteCopy(s.siteCopy);
      setFooter(s.footer);
      setMinOrderValue(s.minOrderValue?.toString() ?? "");
      setFreeShippingForCnpj(s.freeShippingForCnpj);
      setShippingCost(s.shippingCost.toString());
      setPixKey(s.pixKey ?? "");
      setPixReceiverName(s.pixReceiverName ?? "");
      setPixReceiverCity(s.pixReceiverCity ?? "");
      setMaxInstallments(s.maxInstallments.toString());
      setMinInstallmentValue(s.minInstallmentValue.toString());
      setInterestFreeInstallments(s.interestFreeInstallments.toString());
      setMonthlyInterestRate(s.monthlyInterestRate.toString());
      setEnabledPaymentMethods(s.enabledPaymentMethods ?? PAYMENT_METHOD_ORDER);
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

  async function toggleAllowAdjustmentsAfterDispatch() {
    if (!settings) return;
    setSavingDispatchToggle(true);
    await apiClient.updateStoreSettings({ allowAdjustmentsAfterDispatch: !settings.allowAdjustmentsAfterDispatch });
    setSavingDispatchToggle(false);
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

  function addPaymentMethod() {
    if (!footer || !newPaymentMethod.trim()) return;
    setFooter({ ...footer, paymentMethods: [...footer.paymentMethods, newPaymentMethod.trim()] });
    setNewPaymentMethod("");
  }

  function removePaymentMethod(method: string) {
    if (!footer) return;
    setFooter({ ...footer, paymentMethods: footer.paymentMethods.filter((m) => m !== method) });
  }

  function addHelpLink() {
    if (!footer || !newHelpLabel.trim() || !newHelpUrl.trim()) return;
    setFooter({ ...footer, helpLinks: [...footer.helpLinks, { id: `help-${Date.now()}`, label: newHelpLabel.trim(), url: newHelpUrl.trim() }] });
    setNewHelpLabel("");
    setNewHelpUrl("");
  }

  function removeHelpLink(id: string) {
    if (!footer) return;
    setFooter({ ...footer, helpLinks: footer.helpLinks.filter((l) => l.id !== id) });
  }

  function addSocialLink() {
    if (!footer || !newSocialLabel.trim() || !newSocialUrl.trim()) return;
    setFooter({
      ...footer,
      socialLinks: [...footer.socialLinks, { id: `social-${Date.now()}`, label: newSocialLabel.trim(), url: newSocialUrl.trim() }],
    });
    setNewSocialLabel("");
    setNewSocialUrl("");
  }

  function removeSocialLink(id: string) {
    if (!footer) return;
    setFooter({ ...footer, socialLinks: footer.socialLinks.filter((l) => l.id !== id) });
  }

  async function handleSaveOrderRules() {
    setSavingOrderRules(true);
    await apiClient.updateStoreSettings({
      minOrderValue: minOrderValue ? Number(minOrderValue) : undefined,
      freeShippingForCnpj,
      shippingCost: Number(shippingCost),
    });
    setSavingOrderRules(false);
    refresh();
  }

  function togglePaymentMethod(method: PaymentMethod) {
    setEnabledPaymentMethods((prev) => (prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]));
  }

  async function handleSavePayment() {
    if (enabledPaymentMethods.length === 0) {
      setPaymentError("Deixe pelo menos uma forma de pagamento marcada — sem nenhuma, o checkout trava pro cliente.");
      return;
    }
    setPaymentError(null);
    setSavingPayment(true);
    await apiClient.updateStoreSettings({
      pixKey: pixKey.trim() || undefined,
      pixReceiverName: pixReceiverName.trim() || undefined,
      pixReceiverCity: pixReceiverCity.trim() || undefined,
      maxInstallments: Number(maxInstallments),
      minInstallmentValue: Number(minInstallmentValue),
      interestFreeInstallments: Number(interestFreeInstallments),
      monthlyInterestRate: Number(monthlyInterestRate),
      enabledPaymentMethods,
    });
    setSavingPayment(false);
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

  const COLOR_PRESETS = [
    { name: "Azul", value: "#1d4ed8" },
    { name: "Verde", value: "#16a34a" },
    { name: "Vermelho", value: "#dc2626" },
    { name: "Roxo", value: "#7c3aed" },
    { name: "Laranja", value: "#ea580c" },
    { name: "Rosa", value: "#db2777" },
    { name: "Ciano", value: "#0891b2" },
    { name: "Grafite", value: "#334155" },
  ];

  const sortedBanners = [...settings.banners].sort((a, b) => a.order - b.order);

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Configurações</h1>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-6 max-w-xl">
        <h2 className="font-semibold text-slate-900 mb-3">Cor da marca</h2>
        <p className="text-sm text-slate-500 mb-3">
          Uma cor só — os outros tons (fundo claro, hover, etc.) são derivados automaticamente.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setBrandColor(preset.value)}
              title={preset.name}
              className={`w-9 h-9 rounded-full border-2 ${brandColor.toLowerCase() === preset.value ? "border-slate-900" : "border-transparent"}`}
              style={{ backgroundColor: preset.value }}
            />
          ))}
        </div>
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
            <label className="block text-sm font-medium text-slate-700 mb-2">Formas de pagamento</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {footer.paymentMethods.map((method) => (
                <span key={method} className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  {method}
                  <button type="button" onClick={() => removePaymentMethod(method)} className="text-slate-400 hover:text-red-600">
                    ✕
                  </button>
                </span>
              ))}
              {footer.paymentMethods.length === 0 && <p className="text-xs text-slate-400">Nenhuma cadastrada.</p>}
            </div>
            <div className="flex gap-2 max-w-sm">
              <input
                type="text"
                value={newPaymentMethod}
                onChange={(e) => setNewPaymentMethod(e.target.value)}
                placeholder="Ex: Vale Alimentação"
                className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm"
              />
              <button type="button" onClick={addPaymentMethod} className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 hover:bg-brand-50">
                Adicionar
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Links de Ajuda (coluna &quot;Ajuda&quot; do rodapé)</label>
            <div className="space-y-1.5 mb-2">
              {footer.helpLinks.map((link) => (
                <div key={link.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">
                    {link.label} <span className="text-slate-400">→ {link.url}</span>
                  </span>
                  <button type="button" onClick={() => removeHelpLink(link.id)} className="text-slate-400 hover:text-red-600 shrink-0">
                    ✕
                  </button>
                </div>
              ))}
              {footer.helpLinks.length === 0 && <p className="text-xs text-slate-400">Nenhum cadastrado.</p>}
            </div>
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
              <input
                type="text"
                value={newHelpLabel}
                onChange={(e) => setNewHelpLabel(e.target.value)}
                placeholder="Ex: Política de Privacidade"
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
              />
              <input
                type="text"
                value={newHelpUrl}
                onChange={(e) => setNewHelpUrl(e.target.value)}
                placeholder="/politica-de-privacidade"
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
              />
              <button type="button" onClick={addHelpLink} className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 hover:bg-brand-50">
                Adicionar
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Redes sociais</label>
            <div className="space-y-1.5 mb-2">
              {footer.socialLinks.map((link) => (
                <div key={link.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">
                    {link.label} <span className="text-slate-400">→ {link.url}</span>
                  </span>
                  <button type="button" onClick={() => removeSocialLink(link.id)} className="text-slate-400 hover:text-red-600 shrink-0">
                    ✕
                  </button>
                </div>
              ))}
              {footer.socialLinks.length === 0 && <p className="text-xs text-slate-400">Nenhuma cadastrada.</p>}
            </div>
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
              <input
                type="text"
                value={newSocialLabel}
                onChange={(e) => setNewSocialLabel(e.target.value)}
                placeholder="Ex: Instagram"
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
              />
              <input
                type="text"
                value={newSocialUrl}
                onChange={(e) => setNewSocialUrl(e.target.value)}
                placeholder="https://instagram.com/..."
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
              />
              <button type="button" onClick={addSocialLink} className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 hover:bg-brand-50">
                Adicionar
              </button>
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

      <section className="bg-white border border-slate-200 rounded-lg p-5 mt-6 max-w-xl">
        <h2 className="font-semibold text-slate-900 mb-1">Pedidos e frete</h2>
        <p className="text-sm text-slate-500 mb-4">
          Por padrão a loja não tem pedido mínimo e o frete é grátis pra CNPJ — os dois são só o ponto de partida,
          ajuste como quiser.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pedido mínimo (R$)</label>
            <input
              type="number"
              step="0.01"
              value={minOrderValue}
              onChange={(e) => setMinOrderValue(e.target.value)}
              placeholder="Vazio = sem pedido mínimo"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Frete grátis para CNPJ</p>
              <p className="text-xs text-slate-500 mt-0.5">Desligado, todo cliente paga o frete abaixo — CNPJ ou não.</p>
            </div>
            <button
              type="button"
              onClick={() => setFreeShippingForCnpj((v) => !v)}
              className={`shrink-0 ml-4 relative w-12 h-7 rounded-full transition-colors ${freeShippingForCnpj ? "bg-brand-600" : "bg-slate-300"}`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${freeShippingForCnpj ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="max-w-xs">
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor do frete (R$)</label>
            <input
              type="number"
              step="0.01"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">
              Cobrado de clientes CPF sempre, e de CNPJ também se o frete grátis acima estiver desligado.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Permitir ajustar quantidade após saída para entrega</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Desligado (padrão): depois que o pedido está &quot;Saiu para entrega&quot; ou &quot;Entregue&quot;, a
                mercadoria já saiu do estoque e a nota fiscal já foi emitida — não dá mais pra ajustar quantidade.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleAllowAdjustmentsAfterDispatch}
              disabled={savingDispatchToggle}
              className={`shrink-0 ml-4 relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${settings.allowAdjustmentsAfterDispatch ? "bg-brand-600" : "bg-slate-300"}`}
            >
              <span
                className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${settings.allowAdjustmentsAfterDispatch ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveOrderRules}
            disabled={savingOrderRules}
            className="bg-brand-600 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {savingOrderRules ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mt-6 max-w-xl">
        <h2 className="font-semibold text-slate-900 mb-1">Pagamento</h2>
        <p className="text-sm text-slate-500 mb-4">
          Configure a chave Pix da loja pra gerar o QR Code no checkout, e as regras de parcelamento no cartão.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Formas de pagamento disponíveis para o cliente</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHOD_ORDER.map((method) => {
                const active = enabledPaymentMethods.includes(method);
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => togglePaymentMethod(method)}
                    className={`text-sm font-medium rounded-full px-3 py-1.5 border ${active ? "bg-brand-600 border-brand-600 text-white" : "bg-white border-slate-300 text-slate-500"}`}
                  >
                    {active ? "✓ " : ""}
                    {PAYMENT_METHOD_LABEL[method]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Só o que estiver marcado aqui aparece pro cliente escolher no checkout, nessa mesma ordem. As regras de
              parcelamento abaixo valem só para "Cartão de crédito" — nas outras formas o pagamento é sempre à vista.
            </p>
            {paymentError && <p className="text-xs text-red-600 mt-1.5">{paymentError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Chave Pix</label>
            <input
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">
              Sem chave configurada, o checkout não consegue gerar o QR Code do Pix.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do recebedor</label>
              <input
                type="text"
                value={pixReceiverName}
                onChange={(e) => setPixReceiverName(e.target.value)}
                maxLength={25}
                placeholder="Nome que aparece no QR (máx. 25 caracteres)"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cidade do recebedor</label>
              <input
                type="text"
                value={pixReceiverCity}
                onChange={(e) => setPixReceiverCity(e.target.value)}
                maxLength={15}
                placeholder="Cidade (máx. 15 caracteres)"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Máximo de parcelas</label>
              <input
                type="number"
                min={1}
                value={maxInstallments}
                onChange={(e) => setMaxInstallments(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor mínimo da parcela (R$)</label>
              <input
                type="number"
                step="0.01"
                value={minInstallmentValue}
                onChange={(e) => setMinInstallmentValue(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Parcelas sem juros até</label>
              <input
                type="number"
                min={1}
                value={interestFreeInstallments}
                onChange={(e) => setInterestFreeInstallments(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">Acima dessa quantidade, aplica a taxa de juros abaixo.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Juros ao mês acima disso (%)</label>
              <input
                type="number"
                step="0.01"
                value={monthlyInterestRate}
                onChange={(e) => setMonthlyInterestRate(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSavePayment}
            disabled={savingPayment}
            className="bg-brand-600 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {savingPayment ? "Salvando..." : "Salvar pagamento"}
          </button>
        </div>
      </section>

      <RegionsSection />
    </AdminShell>
  );
}

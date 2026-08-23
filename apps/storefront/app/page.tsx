"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@ecommerce/api-client";
import type { Category, Product, StoreSettings, Vendor } from "@ecommerce/types";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";
import { ProductCard } from "@/components/ProductCard";
import { VendorShowcase } from "@/components/VendorShowcase";
import { BannerCarousel } from "@/components/BannerCarousel";
import { useAuth } from "@/lib/auth-context";

// Client component: os dados (produtos/vitrines/config) vêm do mock em
// localStorage, que só existe no navegador — uma page Server Component nunca
// veria criações/edições feitas no admin. Ver nota em orders-store.ts.
export default function HomePage() {
  const { customer } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredVendors, setFeaturedVendors] = useState<Vendor[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    apiClient.getCategories().then(setCategories);
    apiClient.getVendors({ featured: true }).then(setFeaturedVendors);
    apiClient.getProducts({ pageSize: 100 }).then((r) => setAllProducts(r.items));
    apiClient.getBestSellingProducts(6).then(setBestSellers);
    apiClient.getStoreSettings().then(setSettings);
  }, []);

  const weeklyOffers = allProducts.filter((p) => p.salePrice != null);
  const seasonalProducts = allProducts.filter((p) => p.isSeasonal);

  return (
    <>
      <RegionBar />
      <Header categories={categories} />

      <section className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-10 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">
              {settings?.siteCopy.heroTitle ?? "A melhor forma de abastecer o seu negócio."}
            </h1>
            <div className="mt-6 grid sm:grid-cols-3 gap-4">
              {settings?.siteCopy.featureBullets.map((f) => (
                <Feature key={f.title} icon={f.icon} title={f.title} text={f.text} />
              ))}
            </div>
            {!customer && (
              <div className="mt-6 flex items-center gap-4">
                <a href="/conta/criar" className="bg-brand-600 text-white font-semibold px-5 py-2.5 rounded-md hover:bg-brand-700">
                  Criar uma conta
                </a>
                <a href="/conta/entrar" className="font-semibold text-brand-600 hover:underline">
                  Entrar
                </a>
              </div>
            )}
          </div>
          {settings && <BannerCarousel banners={settings.banners} />}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-slate-900">Ofertas da Semana</h2>
          <a href="/catalogo?promo=semana" className="text-brand-600 text-sm font-medium hover:underline">
            Ver todos
          </a>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {weeklyOffers.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {bestSellers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8">
          <h2 className="text-xl font-bold text-slate-900 mb-3">🔥 Mais vendidos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {bestSellers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {seasonalProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8">
          <h2 className="text-xl font-bold text-slate-900 mb-3">🎁 Produtos Sazonais</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {seasonalProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {featuredVendors.map((vendor) => (
        <VendorShowcase key={vendor.id} vendor={vendor} products={allProducts.filter((p) => p.vendorId === vendor.id)} />
      ))}
    </>
  );
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="text-2xl leading-none" aria-hidden>
        {icon}
      </span>
      <div>
        <p className="font-semibold text-sm text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{text}</p>
      </div>
    </div>
  );
}

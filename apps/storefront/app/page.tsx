import { apiClient } from "@ecommerce/api-client";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";
import { ProductCard } from "@/components/ProductCard";
import { VendorShowcase } from "@/components/VendorShowcase";

export default async function HomePage() {
  const [regions, categories, featuredVendors, allProducts] = await Promise.all([
    apiClient.getRegions(),
    apiClient.getCategories(),
    apiClient.getVendors({ featured: true }),
    apiClient.getProducts({ pageSize: 100 }),
  ]);

  const region = regions[0];
  const weeklyOffers = allProducts.items.filter((p) => p.salePrice != null);

  return (
    <>
      <RegionBar region={region} />
      <Header categories={categories} />

      <section className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-10 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">
              A melhor forma de abastecer o seu negócio.
            </h1>
            <div className="mt-6 grid sm:grid-cols-3 gap-4">
              <Feature icon="🛒" title="Sem pedido mínimo" text="Seu pedido não precisa ser grande para ser importante." />
              <Feature icon="🚚" title="Frete grátis para CNPJ" text="Faça quantos pedidos desejar, o frete é por nossa conta." />
              <Feature icon="⏱️" title={`Entrega em ${region.estimatedDeliveryHours}h`} text={`Peça até ${region.cutoffTime} e receba amanhã!`} />
            </div>
            <div className="mt-6 flex items-center gap-4">
              <a href="/conta/criar" className="bg-brand-600 text-white font-semibold px-5 py-2.5 rounded-md hover:bg-brand-700">
                Criar uma conta
              </a>
              <a href="/conta/entrar" className="font-semibold text-brand-600 hover:underline">
                Entrar
              </a>
            </div>
          </div>
          <div className="hidden md:block aspect-video bg-brand-50 rounded-2xl" aria-hidden />
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

      {featuredVendors.map((vendor) => (
        <VendorShowcase
          key={vendor.id}
          vendor={vendor}
          products={allProducts.items.filter((p) => p.vendorId === vendor.id)}
        />
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

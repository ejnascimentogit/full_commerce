import { apiClient } from "@ecommerce/api-client";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";
import { ProductCard } from "@/components/ProductCard";

interface CatalogoPageProps {
  searchParams: Promise<{ categoria?: string; fornecedor?: string; q?: string }>;
}

export default async function CatalogoPage({ searchParams }: CatalogoPageProps) {
  const params = await searchParams;
  const [regions, categories, vendors] = await Promise.all([
    apiClient.getRegions(),
    apiClient.getCategories(),
    apiClient.getVendors(),
  ]);

  const activeCategory = categories.find((c) => c.slug === params.categoria);
  const { items: products, total } = await apiClient.getProducts({
    categoryId: activeCategory?.id,
    vendorId: params.fornecedor,
    q: params.q,
    pageSize: 60,
  });

  return (
    <>
      <RegionBar region={regions[0]} />
      <Header categories={categories} />

      <div className="mx-auto max-w-7xl px-4 py-6 grid md:grid-cols-[220px_1fr] gap-6">
        <aside className="space-y-6">
          <div>
            <h2 className="font-semibold text-sm text-slate-900 mb-2">Departamentos</h2>
            <ul className="space-y-1 text-sm">
              <li>
                <a
                  href="/catalogo"
                  className={`block px-2 py-1 rounded ${!activeCategory ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  Todos
                </a>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <a
                    href={`/catalogo?categoria=${c.slug}`}
                    className={`block px-2 py-1 rounded ${activeCategory?.id === c.id ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-sm text-slate-900 mb-2">Fornecedores</h2>
            <ul className="space-y-1 text-sm">
              {vendors.map((v) => (
                <li key={v.id}>
                  <a
                    href={`/catalogo?fornecedor=${v.id}`}
                    className={`block px-2 py-1 rounded ${params.fornecedor === v.id ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    {v.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main>
          <h1 className="text-lg font-bold text-slate-900 mb-4">
            {activeCategory?.name ?? "Todos os produtos"}{" "}
            <span className="font-normal text-sm text-slate-500">({total})</span>
          </h1>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {products.length === 0 && (
            <p className="text-slate-500 text-sm">Nenhum produto encontrado com esse filtro.</p>
          )}
        </main>
      </div>
    </>
  );
}

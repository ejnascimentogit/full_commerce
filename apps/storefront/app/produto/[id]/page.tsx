import { notFound } from "next/navigation";
import { apiClient, packageLabels } from "@ecommerce/api-client";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";
import { AddToCartBar } from "@/components/AddToCartBar";

const unitSuffix: Record<string, string> = { un: "un", kg: "kg", cx: "cx" };

export default async function ProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [categories, vendors] = await Promise.all([apiClient.getCategories(), apiClient.getVendors()]);

  let product;
  try {
    product = await apiClient.getProduct(id);
  } catch {
    notFound();
  }

  const vendor = vendors.find((v) => v.id === product.vendorId);
  const category = categories.find((c) => c.id === product.categoryId);
  const hasDiscount = product.salePrice != null && product.salePrice < product.basePrice;
  const displayPrice = product.salePrice ?? product.basePrice;
  const packageLabel = packageLabels[product.id];

  return (
    <>
      <RegionBar />
      <Header categories={categories} />

      <div className="mx-auto max-w-5xl px-4 py-8 grid md:grid-cols-2 gap-10">
        <div className="bg-white rounded-lg border border-slate-200 aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data-URI placeholder */}
          <img src={product.photos[0]} alt={product.name} className="w-full h-full object-cover rounded-lg" />
        </div>

        <div>
          {vendor && (
            <p className="text-sm text-brand-600 font-medium mb-1">{vendor.name}</p>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
          {category && <p className="text-sm text-slate-500 mt-1">{category.name}</p>}

          <div className="mt-4 flex items-center gap-3">
            {packageLabel && (
              <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded">
                {packageLabel}
              </span>
            )}
            {product.isVariableWeight && (
              <span className="text-xs text-slate-500">Peso aproximado — valor final ajustado no fornecimento</span>
            )}
          </div>

          <div className="mt-4">
            {hasDiscount && (
              <p className="text-slate-400 line-through text-sm">
                R$ {product.basePrice.toFixed(2).replace(".", ",")}
              </p>
            )}
            <p className="text-3xl font-extrabold text-slate-900">
              R$ {displayPrice.toFixed(2).replace(".", ",")}
              <span className="text-base font-normal text-slate-500">/{unitSuffix[product.unitType]}</span>
            </p>
            {product.boxQuantity && (
              <p className="text-sm text-slate-500">Caixa com {product.boxQuantity} unidades</p>
            )}
          </div>

          <div className="mt-6">
            <AddToCartBar product={product} />
          </div>

          <p className="mt-6 text-sm text-slate-600 leading-relaxed">{product.description}</p>
        </div>
      </div>
    </>
  );
}

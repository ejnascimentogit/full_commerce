"use client";

import Link from "next/link";
import { useStoreBrand } from "@/lib/use-store-brand";

// Client component (not the Header itself) so this works whether Header is
// rendered from a Server Component page or a "use client" page -- async
// Server Components can't be imported into Client Component modules.
export function LogoLink() {
  // Enquanto a configuracao da empresa nao chega, o espaco da marca fica vazio (invisivel): nunca mostra o nome padrao.
  const brand = useStoreBrand("storefront");

  return (
    <Link href="/" className="flex flex-col justify-center shrink-0">
      {!brand ? (
        <span className="invisible text-2xl font-bold tracking-tight leading-tight">.</span>
      ) : brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logo (mock: data URI)
        <img src={brand.logoUrl} alt={brand.storeName} className="h-9 w-auto" />
      ) : (
        <span className="text-2xl font-bold tracking-tight leading-tight">{brand.storeName}</span>
      )}
      {/* Marca da plataforma -- sempre aparece, seja qual for a loja/cliente rodando nela. */}
      <span className="text-[10px] text-white/50 leading-none mt-0.5">powered by fullcommerce</span>
    </Link>
  );
}

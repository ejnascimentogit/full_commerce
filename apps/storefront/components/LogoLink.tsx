"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@ecommerce/api-client";

// Client component (not the Header itself) so this works whether Header is
// rendered from a Server Component page or a "use client" page — async
// Server Components can't be imported into Client Component modules.
export function LogoLink() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getStoreSettings().then((s) => setLogoUrl(s.logoUrl ?? null));
  }, []);

  return (
    <Link href="/" className="flex items-center shrink-0 h-9">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logo (mock: data URI)
        <img src={logoUrl} alt="Logo da loja" className="h-9 w-auto" />
      ) : (
        <span className="text-2xl font-bold tracking-tight">
          full<span className="text-brand-100">commerce</span>
        </span>
      )}
    </Link>
  );
}

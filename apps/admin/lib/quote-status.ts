import type { QuoteStatus } from "@ecommerce/types";

// Mesmo helper local que existe em apps/storefront/lib/quote-status.ts --
// duplicado de proposito (cada app ja tem seus proprios pequenos helpers,
// ex: apps/admin/lib/order-pdf.ts) em vez de mexer em @ecommerce/api-client
// so pra rotulo/cor de badge.
export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  requested: "Aguardando resposta",
  quoted: "Cotado",
  accepted: "Aceito",
  rejected: "Recusado",
  expired: "Expirado",
  converted: "Convertido em pedido",
};

export const QUOTE_STATUS_BADGE: Record<QuoteStatus, string> = {
  requested: "bg-slate-100 text-slate-600",
  quoted: "bg-amber-100 text-amber-700",
  accepted: "bg-brand-50 text-brand-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-slate-100 text-slate-500",
  converted: "bg-green-100 text-green-700",
};

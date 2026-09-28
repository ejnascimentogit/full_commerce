import type { QuoteStatus } from "@ecommerce/types";

// Pequeno helper local (nao faz parte de @ecommerce/api-client -- o pacote
// compartilhado nao deveria mudar como parte da UI de orcamentos, ver
// .claude/skills/ecommerce/references/orcamento-implementacao.md) so pra nao
// repetir o mesmo rotulo/cor nas duas telas de orcamento da loja.
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

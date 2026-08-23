import type { Customer, DeliveryRegion, Order, OrderItem, OrderStatus, Product, Promotion } from "@ecommerce/types";

// Pure business-rule functions — no React, no fetch, no storage. Shared by every
// app (storefront, mobile, admin) so the rules from the ecommerce skill (frete
// grátis para CNPJ, sem pedido mínimo, preço variável por peso) live in exactly
// one place instead of being reimplemented per platform.

export function unitPriceOf(product: Product): number {
  return product.salePrice && product.salePrice > 0 ? product.salePrice : product.basePrice;
}

export function buildOrderItem(product: Product, quantity: number): OrderItem {
  const unitPrice = unitPriceOf(product);
  const estimatedSubtotal = product.isVariableWeight
    ? unitPrice * (product.avgWeight ?? 1) * quantity
    : unitPrice * quantity;
  return {
    productId: product.id,
    vendorId: product.vendorId,
    name: product.name,
    sku: product.sku,
    unitType: product.unitType,
    unitPrice,
    quantity,
    estimatedSubtotal,
  };
}

// Roteirização: a região do cliente não é escolhida por ele — é o resultado de
// casar o bairro do endereço contra as zonas que o admin cadastrou. Sem match,
// o cliente fica sem regionId (undefined) até o admin criar/ajustar uma zona.
export function matchRegionByNeighborhood(regions: DeliveryRegion[], neighborhood: string): DeliveryRegion | undefined {
  const target = neighborhood.trim().toLowerCase();
  if (!target) return undefined;
  return regions.find((r) => r.active && r.neighborhoods.some((n) => n.trim().toLowerCase() === target));
}

export interface ShippingSettings {
  /** Regra padrão (herdada do Praso) é `true`. Configurável em Configurações no admin. */
  freeShippingForCnpj: boolean;
  shippingCost: number;
}

export function calculateShipping(customer: Pick<Customer, "documentType">, settings: ShippingSettings): number {
  if (customer.documentType === "cnpj" && settings.freeShippingForCnpj) return 0;
  return settings.shippingCost;
}

// `shipping` já vem calculado por quem chama (via calculateShipping, ou 0 se um
// cupom freeShipping foi aplicado) — calculateOrderTotals só soma, não decide frete.
export function calculateOrderTotals(items: OrderItem[], shipping: number, options?: { discount?: number }) {
  const subtotal = items.reduce((sum, item) => sum + item.estimatedSubtotal, 0);
  const discount = options?.discount ?? 0;
  return { subtotal, discount, shipping, total: Math.max(0, subtotal - discount) + shipping };
}

// Cupons/promoções automáticas — regidas pelo interruptor StoreSettings.promotionsEnabled
// (checado por quem chama, não aqui: essas funções são puras e não sabem de settings).
export function isPromotionActive(
  promotion: Pick<Promotion, "startsAt" | "endsAt" | "maxUses" | "currentUses">,
  at: string = new Date().toISOString(),
): boolean {
  if (promotion.startsAt > at || promotion.endsAt < at) return false;
  if (promotion.maxUses != null && promotion.currentUses >= promotion.maxUses) return false;
  return true;
}

export function findPromotionByCoupon(promotions: Promotion[], code: string): Promotion | undefined {
  const target = code.trim().toUpperCase();
  if (!target) return undefined;
  return promotions.find((p) => p.couponCode && p.couponCode.toUpperCase() === target && isPromotionActive(p));
}

export interface PromotionCartLine {
  product: Product;
  subtotal: number;
}

// Desconto em R$ que a promoção tira do subtotal — não mexe em frete (freeShipping
// é aplicado à parte, via freeShippingOverride em calculateOrderTotals) nem valida
// vigência/usos (isso é isPromotionActive, chamado antes).
export function calculatePromotionDiscount(promotion: Promotion, lines: PromotionCartLine[], orderSubtotal: number): number {
  if (promotion.rules.minOrderValue && orderSubtotal < promotion.rules.minOrderValue) return 0;
  const eligible = lines.filter((line) => {
    if (promotion.rules.categoryIds && !promotion.rules.categoryIds.includes(line.product.categoryId)) return false;
    if (promotion.rules.vendorId && line.product.vendorId !== promotion.rules.vendorId) return false;
    if (promotion.rules.productIds && !promotion.rules.productIds.includes(line.product.id)) return false;
    return true;
  });
  const eligibleSubtotal = eligible.reduce((sum, line) => sum + line.subtotal, 0);
  if (eligibleSubtotal <= 0) return 0;
  if (promotion.type === "percentage") return Math.round(eligibleSubtotal * (promotion.value / 100) * 100) / 100;
  if (promotion.type === "fixed" || promotion.type === "coupon") return Math.min(promotion.value, eligibleSubtotal);
  return 0;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pagamento confirmado",
  PREPARING: "Em preparo",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "PENDING",
  "AWAITING_PAYMENT",
  "PAID",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

// "Itens mais vendidos" é calculado de verdade a partir dos pedidos (soma de
// quantidade por produto), não é curadoria manual — ao contrário de "sazonais",
// que é um flag do admin porque não dá pra inferir estação do ano dos dados.
export function getBestSellingProducts(orders: Order[], products: Product[], limit = 12): Product[] {
  const quantityByProduct = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "CANCELLED" || order.status === "REFUNDED") continue;
    for (const item of order.items) {
      quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
    }
  }
  return [...quantityByProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([productId]) => products.find((p) => p.id === productId))
    .filter((p): p is Product => Boolean(p));
}

// Deriva a paleta de 5 tons (50/100/500/600/700) a partir de uma única cor base
// escolhida pelo admin, ajustando luminosidade em HSL — assim a tela de
// configurações só precisa de um color picker, não cinco.
function hexToHsl(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export interface BrandPalette {
  50: string;
  100: string;
  500: string;
  600: string;
  700: string;
}

export function deriveBrandPalette(baseHex: string): BrandPalette {
  const [h, s] = hexToHsl(baseHex);
  return {
    50: hslToHex(h, Math.min(s, 60), 96),
    100: hslToHex(h, Math.min(s, 70), 90),
    500: hslToHex(h, s, 55),
    600: baseHex,
    700: hslToHex(h, s, 32),
  };
}

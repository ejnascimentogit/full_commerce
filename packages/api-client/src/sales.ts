import type { Customer, PaymentMethod, SalesOrderLine, SalesProduct } from "@ecommerce/types";
import { calculateShipping, type ShippingSettings } from "./domain";

// Regras puras da força de vendas (Novo pedido digitado pelo vendedor). A tela usa pra mostrar totais e alertas na hora;
// o servidor (supabase/functions/api/index.ts, POST /admin/orders) confere as mesmas regras de novo, então nada daqui é
// a última palavra: é o que deixa o vendedor ver o problema antes de enviar.

const round2 = (n: number) => Math.round(n * 100) / 100;
const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

/** Preço que o pedido cobra antes do desconto do vendedor: a promoção automática, se houver; senão o preço de tabela. */
export function salesBasePrice(product: Pick<SalesProduct, "listPrice" | "promoPrice">): number {
  return product.promoPrice != null && product.promoPrice > 0 && product.promoPrice < product.listPrice ? product.promoPrice : product.listPrice;
}

/** Preço unitário líquido depois do desconto do vendedor (%). Desconto fora de 0..100 é limitado. */
export function netUnitPrice(basePrice: number, discountPercent: number): number {
  const pct = Math.max(0, Math.min(100, Number.isFinite(discountPercent) ? discountPercent : 0));
  return round2(basePrice * (1 - pct / 100));
}

/** Menor preço unitário que o vendedor pode digitar, dado o limite de desconto dele. */
export function minUnitPrice(basePrice: number, maxDiscountPercent: number): number {
  return netUnitPrice(basePrice, maxDiscountPercent);
}

/** Desconto (%) equivalente a um preço digitado, com 2 casas. Preço acima da tabela dá negativo (acréscimo). */
export function discountFromPrice(basePrice: number, unitPrice: number): number {
  if (!(basePrice > 0)) return 0;
  return round2((1 - unitPrice / basePrice) * 100);
}

/** Preço líquido de uma linha: o digitado pelo vendedor, se houver; senão o calculado pelo %. */
export function lineNetPrice(product: Pick<SalesProduct, "listPrice" | "promoPrice">, line: Pick<SalesOrderLine, "discountPercent" | "unitPrice">): number {
  return line.unitPrice != null ? round2(line.unitPrice) : netUnitPrice(salesBasePrice(product), line.discountPercent);
}

/** Desconto efetivo (%) de uma linha, tenha o vendedor digitado o preço ou o %. */
export function lineDiscountPercent(product: Pick<SalesProduct, "listPrice" | "promoPrice">, line: Pick<SalesOrderLine, "discountPercent" | "unitPrice">): number {
  return line.unitPrice != null ? discountFromPrice(salesBasePrice(product), line.unitPrice) : line.discountPercent;
}

/** Subtotal da linha a partir do preço líquido (peso variável usa o peso médio). */
export function lineSubtotal(
  product: Pick<SalesProduct, "listPrice" | "promoPrice" | "isVariableWeight" | "avgWeight">,
  line: Pick<SalesOrderLine, "quantity" | "discountPercent" | "unitPrice">,
): number {
  const weight = product.isVariableWeight ? product.avgWeight ?? 1 : 1;
  return round2(lineNetPrice(product, line) * weight * line.quantity);
}

/** Subtotal estimado da linha, igual ao servidor: produto de peso variável usa o peso médio. */
export function salesLineSubtotal(
  product: Pick<SalesProduct, "listPrice" | "promoPrice" | "isVariableWeight" | "avgWeight">,
  quantity: number,
  discountPercent: number,
): number {
  const unit = netUnitPrice(salesBasePrice(product), discountPercent);
  const weight = product.isVariableWeight ? product.avgWeight ?? 1 : 1;
  return round2(unit * weight * quantity);
}

export interface SalesOrderTotals {
  /** Soma das linhas com promoção, antes do desconto do vendedor. */
  grossSubtotal: number;
  /** Quanto o vendedor deu de desconto, somando todas as linhas. */
  sellerDiscount: number;
  /** Subtotal que vai pro pedido (já com o desconto do vendedor). */
  subtotal: number;
  shipping: number;
  total: number;
}

export function salesOrderTotals(
  lines: SalesOrderLine[],
  productsById: Map<string, SalesProduct> | Record<string, SalesProduct>,
  customer: Pick<Customer, "documentType">,
  settings: ShippingSettings,
): SalesOrderTotals {
  const get = (id: string) => (productsById instanceof Map ? productsById.get(id) : productsById[id]);
  let grossSubtotal = 0;
  let subtotal = 0;
  for (const line of lines) {
    const product = get(line.productId);
    if (!product) continue;
    grossSubtotal += salesLineSubtotal(product, line.quantity, 0);
    subtotal += lineSubtotal(product, line);
  }
  grossSubtotal = round2(grossSubtotal);
  subtotal = round2(subtotal);
  const shipping = lines.length ? calculateShipping(customer, settings) : 0;
  return { grossSubtotal, sellerDiscount: round2(grossSubtotal - subtotal), subtotal, shipping, total: round2(subtotal + shipping) };
}

export type SalesAlertLevel = "error" | "warning" | "info";

export interface SalesAlert {
  /** error: impede enviar · warning: dá pra enviar, mas confira · info: só aviso. Mesmos níveis do maxPedido. */
  level: SalesAlertLevel;
  code: string;
  message: string;
  productId?: string;
}

export interface SalesAlertInput {
  customer: Pick<Customer, "status" | "regionId" | "preferredPaymentMethod">;
  addressId?: string;
  paymentMethod?: PaymentMethod;
  enabledPaymentMethods: PaymentMethod[];
  /** O vendedor tem a permissão pedidos.alterar_plano? */
  canChangePlan: boolean;
  lines: SalesOrderLine[];
  productsById: Map<string, SalesProduct>;
  maxDiscountPercent: number;
  subtotal: number;
  minOrderValue?: number;
}

export function salesOrderAlerts(input: SalesAlertInput): SalesAlert[] {
  const alerts: SalesAlert[] = [];
  const { customer } = input;
  if (customer.status !== "active") alerts.push({ level: "error", code: "CUSTOMER_INACTIVE", message: "Cliente inativo: não dá pra enviar pedido." });
  if (!input.addressId) alerts.push({ level: "error", code: "NO_ADDRESS", message: "Escolha o endereço de entrega." });
  if (!customer.regionId) alerts.push({ level: "warning", code: "NO_REGION", message: "O bairro do cliente não está em nenhuma rota de entrega." });

  if (!input.paymentMethod) {
    alerts.push({ level: "error", code: "NO_PAYMENT", message: "Escolha o plano de pagamento." });
  } else {
    if (!input.enabledPaymentMethods.includes(input.paymentMethod)) {
      alerts.push({ level: "error", code: "PAYMENT_METHOD_DISABLED", message: "Essa forma de pagamento está desligada na loja." });
    }
    const plan = customer.preferredPaymentMethod;
    if (plan && plan !== input.paymentMethod) {
      alerts.push(
        input.canChangePlan
          ? { level: "info", code: "PLAN_CHANGED", message: "Plano de pagamento diferente do cadastro do cliente." }
          : { level: "error", code: "PLAN_CHANGE_FORBIDDEN", message: "Você não pode trocar o plano de pagamento do cadastro do cliente." },
      );
    }
  }
  if (!customer.preferredPaymentMethod) {
    alerts.push({ level: "warning", code: "NO_PLAN", message: "Cliente sem plano de pagamento no cadastro." });
  }

  if (input.lines.length === 0) alerts.push({ level: "error", code: "NO_ITEMS", message: "Inclua pelo menos um item." });
  for (const line of input.lines) {
    const product = input.productsById.get(line.productId);
    if (!product) {
      alerts.push({ level: "error", code: "PRODUCT_UNAVAILABLE", message: "Um item não está mais disponível. Tire do pedido.", productId: line.productId });
      continue;
    }
    if (!(line.quantity > 0)) alerts.push({ level: "error", code: "INVALID_QUANTITY", message: `Quantidade inválida em ${product.name}.`, productId: product.id });
    const base = salesBasePrice(product);
    if (line.unitPrice != null && round2(line.unitPrice) > base) {
      alerts.push({
        level: "error",
        code: "PRICE_ABOVE_TABLE",
        message: `${product.name}: preço digitado acima da tabela (${brl(base)}).`,
        productId: product.id,
      });
    } else if (line.unitPrice != null ? round2(line.unitPrice) < minUnitPrice(base, input.maxDiscountPercent) : line.discountPercent > input.maxDiscountPercent) {
      alerts.push({
        level: "error",
        code: "DISCOUNT_ABOVE_LIMIT",
        message: `${product.name}: desconto de ${lineDiscountPercent(product, line)}% passa do seu limite (${input.maxDiscountPercent}%, preço mínimo ${brl(minUnitPrice(base, input.maxDiscountPercent))}).`,
        productId: product.id,
      });
    }
    if (line.quantity > product.stock) {
      alerts.push({ level: "warning", code: "LOW_STOCK", message: `${product.name}: pedido ${line.quantity}, estoque ${product.stock}.`, productId: product.id });
    }
    if (product.isVariableWeight) {
      alerts.push({ level: "info", code: "VARIABLE_WEIGHT", message: `${product.name} tem peso variável: o valor é estimado e pode mudar na separação.`, productId: product.id });
    }
  }
  if (input.lines.length && input.minOrderValue && input.subtotal < input.minOrderValue) {
    alerts.push({
      level: "error",
      code: "BELOW_MIN_ORDER_VALUE",
      message: `Pedido abaixo do mínimo da loja (R$ ${input.minOrderValue.toFixed(2).replace(".", ",")}).`,
    });
  }
  const order: Record<SalesAlertLevel, number> = { error: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

/** Carteira do vendedor (usado no modo mock; no real quem filtra é o servidor). null = vê todos. */
export function customersInPortfolio<T extends Pick<Customer, "assignedStaffId">>(customers: T[], portfolio: string[] | null): T[] {
  if (portfolio === null) return customers;
  return customers.filter((c) => !!c.assignedStaffId && portfolio.includes(c.assignedStaffId));
}

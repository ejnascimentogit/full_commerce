import type { Customer, OrderItem, OrderStatus, Product } from "@ecommerce/types";

// Pure business-rule functions — no React, no fetch, no storage. Shared by every
// app (storefront, mobile, admin) so the rules from the ecommerce skill (frete
// grátis para CNPJ, sem pedido mínimo, preço variável por peso) live in exactly
// one place instead of being reimplemented per platform.

export function unitPriceOf(product: Product): number {
  return product.salePrice ?? product.basePrice;
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

export function calculateShipping(customer: Pick<Customer, "documentType">): number {
  // Regra da skill: frete grátis para CNPJ, cobrado normalmente para CPF.
  return customer.documentType === "cnpj" ? 0 : 19.9;
}

export function calculateOrderTotals(items: OrderItem[], customer: Pick<Customer, "documentType">) {
  const subtotal = items.reduce((sum, item) => sum + item.estimatedSubtotal, 0);
  const shipping = calculateShipping(customer);
  const discount = 0;
  return { subtotal, discount, shipping, total: subtotal - discount + shipping };
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

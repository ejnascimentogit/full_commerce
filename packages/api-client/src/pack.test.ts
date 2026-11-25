import { describe, expect, it } from "vitest";
import type { Product, QuoteItem } from "@ecommerce/types";
import { buildOrderItem, buildOrderItemFromQuoteItem, formatItemQuantity, formatPackQuantity, packSizeOf, packUnitLabel, productLineSubtotal } from "./domain";
import { lineSubtotal, salesOrderAlerts } from "./sales";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    vendorId: "v1",
    name: "Filé de Peito de Frango Friato",
    description: "",
    sku: "100011",
    categoryId: "c1",
    photos: [],
    unitType: "kg",
    basePrice: 15,
    stock: 1000,
    variants: [],
    status: "active",
    boxQuantity: 20,
    masterUnit: "CX",
    packaging: "CX 20KG",
    ...overrides,
  } as Product;
}

describe("venda por embalagem (CX 20KG)", () => {
  it("só multiplica produto padrão un/kg com quant. master > 1", () => {
    expect(packSizeOf(product())).toBe(20);
    expect(packSizeOf(product({ unitType: "un", boxQuantity: 12 }))).toBe(12);
    expect(packSizeOf(product({ boxQuantity: 1 }))).toBe(1);
    expect(packSizeOf(product({ boxQuantity: undefined }))).toBe(1);
    expect(packSizeOf(product({ isVariableWeight: true }))).toBe(1);
    expect(packSizeOf(product({ unitType: "cx" }))).toBe(1);
  });

  it("2 CX de 20 kg a R$ 15/kg = 40 kg = R$ 600", () => {
    const item = buildOrderItem(product(), 2);
    expect(item.estimatedSubtotal).toBe(600);
    expect(item).toMatchObject({ quantity: 2, unitPrice: 15, packSize: 20, packUnit: "CX", packaging: "CX 20KG" });
    expect(productLineSubtotal(product(), 2)).toBe(600);
  });

  it("produto sem embalagem continua igual", () => {
    const item = buildOrderItem(product({ boxQuantity: undefined }), 3);
    expect(item.estimatedSubtotal).toBe(45);
    expect(item.packSize).toBeUndefined();
  });

  it("orçamento convertido usa a quant. master congelada", () => {
    const qi: QuoteItem = { productId: "p1", vendorId: "v1", name: "x", sku: "1", unitType: "kg", quantity: 2, packSize: 20, packUnit: "CX", referenceUnitPrice: 15 };
    expect(buildOrderItemFromQuoteItem(qi).estimatedSubtotal).toBe(600);
  });

  it("textos: 2 CX (40 kg)", () => {
    expect(formatPackQuantity(2, "kg", 20, "CX")).toBe("2 CX (40 kg)");
    expect(formatPackQuantity(3, "un")).toBe("3 un");
    expect(formatItemQuantity({ quantity: 1.5, unitType: "kg", packSize: 20, packaging: "SC 20KG" })).toBe("1,5 SC (30 kg)");
    expect(packUnitLabel(undefined, "fd 6x1l")).toBe("FD");
    expect(packUnitLabel()).toBe("emb.");
  });

  it("Novo pedido: linha multiplica e o estoque compara em kg", () => {
    const p = { ...product(), listPrice: 15, priceLimits: { maxDiscountPercent: 10, maxSurchargePercent: 0 } };
    expect(lineSubtotal(p, { quantity: 2, discountPercent: 0, unitPrice: 14 })).toBe(560);
    const alerts = salesOrderAlerts({
      customer: { status: "active", regionId: "r1", preferredPaymentMethod: "pix" },
      addressId: "a1",
      paymentMethod: "pix",
      enabledPaymentMethods: ["pix"],
      canChangePlan: false,
      lines: [{ productId: "p1", quantity: 60, discountPercent: 0 }],
      productsById: new Map([["p1", { ...p, stock: 1000 }]]),
      subtotal: 18000,
    });
    expect(alerts.map((a) => a.code)).toEqual(["LOW_STOCK"]);
  });
});

import { describe, expect, it } from "vitest";
import type { SalesProduct } from "@ecommerce/types";
import { customersInPortfolio, netUnitPrice, salesBasePrice, salesLineSubtotal, salesOrderAlerts, salesOrderTotals } from "./sales";

function product(overrides: Partial<SalesProduct> = {}): SalesProduct {
  return {
    id: "p1",
    vendorId: "v1",
    name: "Arroz 5kg",
    description: "",
    sku: "100001",
    categoryId: "c1",
    brand: "",
    photos: [],
    unitType: "un",
    basePrice: 20,
    stock: 10,
    variants: [],
    status: "active",
    weight: 5,
    dimensions: { length: 0, width: 0, height: 0 },
    listPrice: 20,
    ...overrides,
  } as SalesProduct;
}

describe("preço do item no Novo pedido", () => {
  it("usa a promoção automática só quando ela é menor que a tabela", () => {
    expect(salesBasePrice({ listPrice: 20, promoPrice: 18 })).toBe(18);
    expect(salesBasePrice({ listPrice: 20 })).toBe(20);
    expect(salesBasePrice({ listPrice: 20, promoPrice: 25 })).toBe(20);
  });
  it("aplica o desconto do vendedor e arredonda em centavos", () => {
    expect(netUnitPrice(20, 10)).toBe(18);
    expect(netUnitPrice(9.99, 3)).toBe(9.69);
    expect(netUnitPrice(20, 150)).toBe(0);
    expect(netUnitPrice(20, -5)).toBe(20);
  });
  it("peso variável usa o peso médio", () => {
    expect(salesLineSubtotal(product({ listPrice: 40, isVariableWeight: true, avgWeight: 1.5 }), 2, 0)).toBe(120);
    expect(salesLineSubtotal(product({ listPrice: 20, promoPrice: 18 }), 3, 10)).toBe(48.6);
  });
});

describe("totais do Novo pedido", () => {
  it("separa o desconto do vendedor e soma o frete da regra da loja", () => {
    const products = new Map([["p1", product()]]);
    const totals = salesOrderTotals([{ productId: "p1", quantity: 2, discountPercent: 5 }], products, { documentType: "cpf" }, {
      freeShippingForCnpj: true,
      shippingCost: 10,
    });
    expect(totals).toEqual({ grossSubtotal: 40, sellerDiscount: 2, subtotal: 38, shipping: 10, total: 48 });
  });
  it("CNPJ com frete grátis ligado não paga frete; pedido vazio não tem frete", () => {
    const products = new Map([["p1", product()]]);
    const settings = { freeShippingForCnpj: true, shippingCost: 10 };
    expect(salesOrderTotals([{ productId: "p1", quantity: 1, discountPercent: 0 }], products, { documentType: "cnpj" }, settings).shipping).toBe(0);
    expect(salesOrderTotals([], products, { documentType: "cpf" }, settings).total).toBe(0);
  });
});

describe("alertas do Novo pedido", () => {
  const base = {
    customer: { status: "active" as const, regionId: "r1", preferredPaymentMethod: "pix" as const },
    addressId: "a1",
    paymentMethod: "pix" as const,
    enabledPaymentMethods: ["pix", "credit"] as ("pix" | "credit")[],
    canChangePlan: false,
    lines: [{ productId: "p1", quantity: 2, discountPercent: 0 }],
    productsById: new Map([["p1", product()]]),
    maxDiscountPercent: 5,
    subtotal: 40,
  };
  const codes = (input: Parameters<typeof salesOrderAlerts>[0]) => salesOrderAlerts(input).map((a) => a.code);

  it("pedido certinho não tem alerta", () => {
    expect(salesOrderAlerts(base)).toEqual([]);
  });
  it("desconto acima do limite do vendedor bloqueia", () => {
    const alerts = salesOrderAlerts({ ...base, lines: [{ productId: "p1", quantity: 2, discountPercent: 6 }] });
    expect(alerts[0]).toMatchObject({ level: "error", code: "DISCOUNT_ABOVE_LIMIT" });
  });
  it("trocar o plano do cliente: bloqueia sem permissão, só avisa com permissão", () => {
    expect(salesOrderAlerts({ ...base, paymentMethod: "credit" })[0]).toMatchObject({ level: "error", code: "PLAN_CHANGE_FORBIDDEN" });
    expect(salesOrderAlerts({ ...base, paymentMethod: "credit", canChangePlan: true })[0]).toMatchObject({ level: "info", code: "PLAN_CHANGED" });
  });
  it("estoque baixo e sem rota avisam mas não bloqueiam", () => {
    const alerts = salesOrderAlerts({ ...base, customer: { ...base.customer, regionId: undefined }, lines: [{ productId: "p1", quantity: 11, discountPercent: 0 }] });
    expect(alerts.every((a) => a.level !== "error")).toBe(true);
    expect(alerts.map((a) => a.code).sort()).toEqual(["LOW_STOCK", "NO_REGION"]);
  });
  it("bloqueia sem item, sem endereço, cliente inativo e abaixo do mínimo; erros vêm primeiro", () => {
    expect(codes({ ...base, lines: [] })).toContain("NO_ITEMS");
    expect(codes({ ...base, addressId: undefined })).toContain("NO_ADDRESS");
    expect(codes({ ...base, customer: { ...base.customer, status: "inactive" } })).toContain("CUSTOMER_INACTIVE");
    expect(codes({ ...base, minOrderValue: 50 })).toEqual(["BELOW_MIN_ORDER_VALUE"]);
    const mixed = salesOrderAlerts({ ...base, addressId: undefined, customer: { ...base.customer, regionId: undefined } });
    expect(mixed.map((a) => a.level)).toEqual(["error", "warning"]);
  });
  it("forma de pagamento desligada na loja bloqueia", () => {
    expect(codes({ ...base, enabledPaymentMethods: ["credit"] })).toContain("PAYMENT_METHOD_DISABLED");
  });
});

describe("carteira do vendedor", () => {
  const customers = [{ id: "1", assignedStaffId: "s1" }, { id: "2", assignedStaffId: "s2" }, { id: "3" }];
  it("null vê todos; senão só os vinculados", () => {
    expect(customersInPortfolio(customers, null)).toHaveLength(3);
    expect(customersInPortfolio(customers, ["s1"]).map((c) => c.id)).toEqual(["1"]);
  });
});

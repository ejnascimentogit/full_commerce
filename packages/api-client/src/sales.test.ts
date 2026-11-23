import { describe, expect, it } from "vitest";
import type { SalesProduct } from "@ecommerce/types";
import {
  customersInPortfolio,
  discountFromPrice,
  lineDiscountPercent,
  lineNetPrice,
  lineSubtotal,
  maxUnitPrice,
  minUnitPrice,
  netUnitPrice,
  salesBasePrice,
  salesLineSubtotal,
  salesOrderAlerts,
  salesOrderTotals,
  salesPriceRange,
} from "./sales";

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
    priceLimits: { maxDiscountPercent: 5, maxSurchargePercent: 0 },
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
    expect(netUnitPrice(20, -5)).toBe(21);
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
    subtotal: 40,
  };
  const codes = (input: Parameters<typeof salesOrderAlerts>[0]) => salesOrderAlerts(input).map((a) => a.code);

  it("pedido certinho não tem alerta", () => {
    expect(salesOrderAlerts(base)).toEqual([]);
  });
  it("desconto acima do máximo do produto bloqueia; acréscimo sem permissão do produto também", () => {
    expect(salesOrderAlerts({ ...base, lines: [{ productId: "p1", quantity: 2, discountPercent: 6 }] })[0]).toMatchObject({ level: "error", code: "PRICE_BELOW_MIN" });
    expect(salesOrderAlerts({ ...base, lines: [{ productId: "p1", quantity: 2, discountPercent: -1 }] })[0]).toMatchObject({ level: "error", code: "PRICE_ABOVE_MAX" });
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

describe("preço digitado pelo vendedor", () => {
  it("o preço digitado vale e o % acompanha", () => {
    const p = product({ listPrice: 52.47 });
    const line = { productId: "p1", quantity: 2, discountPercent: 0, unitPrice: 49 };
    expect(lineNetPrice(p, line)).toBe(49);
    expect(lineDiscountPercent(p, line)).toBe(6.61);
    expect(lineSubtotal(p, line)).toBe(98);
    expect(discountFromPrice(20, 21)).toBe(-5);
  });
  it("sem preço digitado, usa o %", () => {
    expect(lineNetPrice(product(), { discountPercent: 10 })).toBe(18);
  });
  it("faixa de preço: desconto e acréscimo máximos do produto", () => {
    expect(minUnitPrice(52.47, 5)).toBe(49.85);
    expect(maxUnitPrice(52.47, 10)).toBe(57.72);
    expect(salesPriceRange(product({ listPrice: 20, promoPrice: 18, priceLimits: { maxDiscountPercent: 10, maxSurchargePercent: 5 } }))).toEqual({
      base: 18,
      min: 16.2,
      max: 18.9,
    });
    expect(salesPriceRange(product({ priceLimits: { maxDiscountPercent: 0, maxSurchargePercent: 0 } }))).toEqual({ base: 20, min: 20, max: 20 });
  });
  it("alertas: fora da faixa bloqueia; nas pontas exatas passa", () => {
    const base = {
      customer: { status: "active" as const, regionId: "r1", preferredPaymentMethod: "pix" as const },
      addressId: "a1",
      paymentMethod: "pix" as const,
      enabledPaymentMethods: ["pix"] as "pix"[],
      canChangePlan: false,
      productsById: new Map([["p1", product({ listPrice: 52.47, priceLimits: { maxDiscountPercent: 5, maxSurchargePercent: 10 } })]]),
      subtotal: 100,
    };
    const at = (unitPrice: number) => salesOrderAlerts({ ...base, lines: [{ productId: "p1", quantity: 1, discountPercent: 0, unitPrice }] }).map((a) => a.code);
    expect(at(49.84)).toEqual(["PRICE_BELOW_MIN"]);
    expect(at(49.85)).toEqual([]);
    expect(at(57.72)).toEqual([]);
    expect(at(57.73)).toEqual(["PRICE_ABOVE_MAX"]);
  });
  it("totais usam o preço digitado", () => {
    const products = new Map([["p1", product({ listPrice: 20 })]]);
    const totals = salesOrderTotals([{ productId: "p1", quantity: 3, discountPercent: 0, unitPrice: 19 }], products, { documentType: "cnpj" }, {
      freeShippingForCnpj: true,
      shippingCost: 10,
    });
    expect(totals).toMatchObject({ grossSubtotal: 60, sellerDiscount: 3, subtotal: 57, total: 57 });
  });
});

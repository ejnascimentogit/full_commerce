import { describe, expect, it } from "vitest";
import type { DeliveryRegion, Product, Promotion } from "@ecommerce/types";
import {
  calculateOrderTotals,
  calculatePromotionDiscount,
  calculateShipping,
  findPromotionByCoupon,
  isPromotionActive,
  matchRegionByNeighborhood,
} from "./domain";
import type { PromotionCartLine, ShippingSettings } from "./domain";

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    vendorId: "vendor-1",
    name: "Produto Teste",
    description: "",
    sku: "100001",
    categoryId: "cat-1",
    photos: [],
    unitType: "un",
    basePrice: 10,
    isVariableWeight: false,
    stock: 100,
    variants: [],
    status: "active",
    ...overrides,
  };
}

function buildPromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: "promo-1",
    type: "percentage",
    rules: {},
    value: 10,
    isFeatured: false,
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2026-12-31T23:59:59.000Z",
    currentUses: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Frete
// ---------------------------------------------------------------------------

describe("calculateShipping", () => {
  const settings: ShippingSettings = { freeShippingForCnpj: true, shippingCost: 25 };

  it("é grátis para CNPJ quando a configuração permite", () => {
    expect(calculateShipping({ documentType: "cnpj" }, settings)).toBe(0);
  });

  it("cobra o valor configurado para CNPJ quando o frete grátis está desligado", () => {
    expect(calculateShipping({ documentType: "cnpj" }, { ...settings, freeShippingForCnpj: false })).toBe(25);
  });

  it("cobra o valor configurado para CPF, mesmo com frete grátis para CNPJ ligado", () => {
    expect(calculateShipping({ documentType: "cpf" }, settings)).toBe(25);
  });
});

describe("calculateOrderTotals", () => {
  it("soma subtotal dos itens + frete, sem desconto", () => {
    // usa objetos mínimos compatíveis com OrderItem apenas no campo relevante (estimatedSubtotal)
    const totals = calculateOrderTotals(
      [{ estimatedSubtotal: 50 } as any, { estimatedSubtotal: 30 } as any],
      15,
    );
    expect(totals).toEqual({ subtotal: 80, discount: 0, shipping: 15, total: 95 });
  });

  it("aplica o desconto antes de somar o frete", () => {
    const totals = calculateOrderTotals([{ estimatedSubtotal: 100 } as any], 20, { discount: 30 });
    expect(totals).toEqual({ subtotal: 100, discount: 30, shipping: 20, total: 90 });
  });

  it("nunca deixa o total negativo, mesmo com desconto maior que o subtotal", () => {
    const totals = calculateOrderTotals([{ estimatedSubtotal: 10 } as any], 0, { discount: 999 });
    expect(totals.total).toBe(0);
  });

  it("frete grátis (shipping = 0) não é somado", () => {
    const totals = calculateOrderTotals([{ estimatedSubtotal: 50 } as any], 0);
    expect(totals.total).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Roteirização (região de entrega por bairro) — parte da regra de frete
// ---------------------------------------------------------------------------

describe("matchRegionByNeighborhood", () => {
  const regions: DeliveryRegion[] = [
    { id: "r1", name: "Centro", active: true, cutoffTime: "19:00", estimatedDeliveryHours: 24, neighborhoods: ["Centro", "Bela Vista"] },
    { id: "r2", name: "Zona Sul", active: false, cutoffTime: "18:00", estimatedDeliveryHours: 48, neighborhoods: ["Moema"] },
  ];

  it("encontra a região cujo bairro bate, ignorando maiúsculas/minúsculas e espaços", () => {
    expect(matchRegionByNeighborhood(regions, "  bela vista  ")?.id).toBe("r1");
    expect(matchRegionByNeighborhood(regions, "CENTRO")?.id).toBe("r1");
  });

  it("ignora região inativa mesmo que o bairro bata", () => {
    expect(matchRegionByNeighborhood(regions, "Moema")).toBeUndefined();
  });

  it("retorna undefined quando nenhum bairro cadastrado bate", () => {
    expect(matchRegionByNeighborhood(regions, "Bairro Inexistente")).toBeUndefined();
  });

  it("retorna undefined para bairro vazio", () => {
    expect(matchRegionByNeighborhood(regions, "   ")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Cupom / promoções
// ---------------------------------------------------------------------------

describe("isPromotionActive", () => {
  const now = "2026-06-15T12:00:00.000Z";

  it("está ativa dentro do período de vigência e sem limite de usos atingido", () => {
    const promo = buildPromotion({ startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-31T00:00:00.000Z" });
    expect(isPromotionActive(promo, now)).toBe(true);
  });

  it("está expirada (cupom vencido) quando `now` é depois de endsAt", () => {
    const promo = buildPromotion({ endsAt: "2026-01-01T00:00:00.000Z" });
    expect(isPromotionActive(promo, now)).toBe(false);
  });

  it("ainda não começou quando `now` é antes de startsAt", () => {
    const promo = buildPromotion({ startsAt: "2027-01-01T00:00:00.000Z" });
    expect(isPromotionActive(promo, now)).toBe(false);
  });

  it("está inativa quando o limite de usos (maxUses) já foi atingido", () => {
    const promo = buildPromotion({ maxUses: 5, currentUses: 5 });
    expect(isPromotionActive(promo, now)).toBe(false);
  });

  it("continua ativa quando currentUses ainda não chegou em maxUses", () => {
    const promo = buildPromotion({ maxUses: 5, currentUses: 4 });
    expect(isPromotionActive(promo, now)).toBe(true);
  });

  it("sem maxUses definido, currentUses alto não desativa a promoção", () => {
    const promo = buildPromotion({ maxUses: undefined, currentUses: 999 });
    expect(isPromotionActive(promo, now)).toBe(true);
  });
});

describe("findPromotionByCoupon", () => {
  // findPromotionByCoupon delega a checagem de vigência para isPromotionActive usando
  // a data/hora real (não recebe `at` como parâmetro) — por isso "expired" usa uma
  // data no passado bem distante, válida em qualquer momento em que o teste rodar.
  const active = buildPromotion({ id: "p-active", couponCode: "VERAO10" });
  const expired = buildPromotion({ id: "p-expired", couponCode: "EXPIRADO", endsAt: "2020-01-01T00:00:00.000Z" });
  const promotions = [active, expired];

  it("acha o cupom ativo casando o código sem diferenciar maiúsculas/minúsculas", () => {
    expect(findPromotionByCoupon(promotions, "verao10")?.id).toBe("p-active");
    expect(findPromotionByCoupon(promotions, "  VERAO10  ".trim())?.id).toBe("p-active");
  });

  it("não retorna cupom expirado, mesmo com o código certo", () => {
    expect(findPromotionByCoupon(promotions, "EXPIRADO")).toBeUndefined();
  });

  it("retorna undefined para código que não existe", () => {
    expect(findPromotionByCoupon(promotions, "NAOEXISTE")).toBeUndefined();
  });

  it("retorna undefined para código vazio", () => {
    expect(findPromotionByCoupon(promotions, "")).toBeUndefined();
  });
});

describe("calculatePromotionDiscount", () => {
  const productA = buildProduct({ id: "a", categoryId: "cat-bebidas", vendorId: "vendor-1" });
  const productB = buildProduct({ id: "b", categoryId: "cat-limpeza", vendorId: "vendor-2" });

  it("desconto percentual aplica só sobre o subtotal elegível, arredondado a centavos", () => {
    const promo = buildPromotion({ type: "percentage", value: 10 });
    const lines: PromotionCartLine[] = [{ product: productA, subtotal: 33.33 }];
    // 33.33 * 10% = 3.333 -> arredonda para 3.33
    expect(calculatePromotionDiscount(promo, lines, 33.33)).toBe(3.33);
  });

  it("desconto fixo nunca ultrapassa o subtotal elegível", () => {
    const promo = buildPromotion({ type: "fixed", value: 50 });
    const lines: PromotionCartLine[] = [{ product: productA, subtotal: 20 }];
    expect(calculatePromotionDiscount(promo, lines, 20)).toBe(20);
  });

  it("cupom (type coupon) segue a mesma regra de desconto fixo, limitado ao subtotal elegível", () => {
    const promo = buildPromotion({ type: "coupon", value: 15 });
    const lines: PromotionCartLine[] = [{ product: productA, subtotal: 100 }];
    expect(calculatePromotionDiscount(promo, lines, 100)).toBe(15);
  });

  it("não aplica desconto quando o pedido não atinge o valor mínimo (minOrderValue)", () => {
    const promo = buildPromotion({ type: "fixed", value: 10, rules: { minOrderValue: 100 } });
    const lines: PromotionCartLine[] = [{ product: productA, subtotal: 50 }];
    expect(calculatePromotionDiscount(promo, lines, 50)).toBe(0);
  });

  it("filtra por categoria: itens de outra categoria não entram no cálculo", () => {
    const promo = buildPromotion({ type: "fixed", value: 100, rules: { categoryIds: ["cat-bebidas"] } });
    const lines: PromotionCartLine[] = [
      { product: productA, subtotal: 30 }, // cat-bebidas, elegível
      { product: productB, subtotal: 70 }, // cat-limpeza, não elegível
    ];
    // desconto fixo de 100, mas limitado ao subtotal elegível (só productA = 30)
    expect(calculatePromotionDiscount(promo, lines, 100)).toBe(30);
  });

  it("filtra por fornecedor (vendorId)", () => {
    const promo = buildPromotion({ type: "fixed", value: 100, rules: { vendorId: "vendor-2" } });
    const lines: PromotionCartLine[] = [
      { product: productA, subtotal: 30 },
      { product: productB, subtotal: 70 },
    ];
    expect(calculatePromotionDiscount(promo, lines, 100)).toBe(70);
  });

  it("filtra por lista de produtos (productIds)", () => {
    const promo = buildPromotion({ type: "fixed", value: 100, rules: { productIds: ["a"] } });
    const lines: PromotionCartLine[] = [
      { product: productA, subtotal: 30 },
      { product: productB, subtotal: 70 },
    ];
    expect(calculatePromotionDiscount(promo, lines, 100)).toBe(30);
  });

  it("retorna 0 quando nenhum item do carrinho é elegível", () => {
    const promo = buildPromotion({ type: "fixed", value: 100, rules: { categoryIds: ["cat-inexistente"] } });
    const lines: PromotionCartLine[] = [{ product: productA, subtotal: 30 }];
    expect(calculatePromotionDiscount(promo, lines, 30)).toBe(0);
  });

  it("retorna 0 para um tipo de promoção que não concede desconto direto (freeShipping)", () => {
    const promo = buildPromotion({ type: "freeShipping", value: 0 });
    const lines: PromotionCartLine[] = [{ product: productA, subtotal: 30 }];
    expect(calculatePromotionDiscount(promo, lines, 30)).toBe(0);
  });
});

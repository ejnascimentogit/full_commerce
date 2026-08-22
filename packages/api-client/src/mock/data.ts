import type { Category, Customer, DeliveryRegion, Product, Promotion, Vendor } from "@ecommerce/types";
import { placeholderPhoto } from "./placeholder";

export const regions: DeliveryRegion[] = [
  {
    id: "reg-recife",
    name: "Recife — Zona Sul",
    active: true,
    cutoffTime: "19:00",
    estimatedDeliveryHours: 24,
    neighborhoods: ["Boa Viagem", "Pina", "Imbiribeira", "Ipsep"],
  },
  {
    id: "reg-recife-centro",
    name: "Recife — Centro",
    active: true,
    cutoffTime: "18:00",
    estimatedDeliveryHours: 24,
    neighborhoods: ["Boa Vista", "Santo Antônio", "Recife", "São José"],
  },
];

export const categories: Category[] = [
  { id: "cat-confeitaria", name: "Confeitaria", slug: "confeitaria", icon: "🍪" },
  { id: "cat-acougue", name: "Açougue", slug: "acougue", icon: "🥩" },
  { id: "cat-mercearia", name: "Mercearia", slug: "mercearia" },
  { id: "cat-laticinios", name: "Laticínios Secos", slug: "laticinios-secos" },
  { id: "cat-frios", name: "Frios e Queijos", slug: "frios-e-queijos" },
  { id: "cat-snacks", name: "Snacks e Doces", slug: "snacks-e-doces" },
  { id: "cat-bebidas", name: "Bebidas Não-Alcoólicas", slug: "bebidas-nao-alcoolicas" },
  { id: "cat-limpeza", name: "Limpeza", slug: "limpeza" },
];

export const vendors: Vendor[] = [
  { id: "vendor-seara", name: "Seara Distribuidora", cnpj: "12.345.678/0001-01", active: true, isFeatured: true, description: "Carnes e congelados direto de fábrica." },
  { id: "vendor-brilux", name: "Brilux Simplifica!", cnpj: "23.456.789/0001-02", active: true, isFeatured: true, description: "Linha completa de limpeza." },
  { id: "vendor-uniao", name: "União Alimentos", cnpj: "34.567.890/0001-03", active: true, isFeatured: false },
];

interface SeedProduct {
  id: string;
  vendorId: string;
  categoryId: string;
  name: string;
  unitType: Product["unitType"];
  basePrice: number;
  salePrice?: number;
  boxQuantity?: number;
  isVariableWeight?: boolean;
  avgWeight?: number;
  label: string; // shown on the mock package/weight badge, e.g. "750g"
}

const seed: SeedProduct[] = [
  { id: "p-linguica-calabresa", vendorId: "vendor-seara", categoryId: "cat-acougue", name: "Linguiça Calabresa Seara 2,5kg", unitType: "kg", basePrice: 57.47, salePrice: 52.47, isVariableWeight: true, avgWeight: 2.5, label: "Aprox. 2.5kg" },
  { id: "p-leite-po-ninho", vendorId: "vendor-uniao", categoryId: "cat-laticinios", name: "Leite em Pó Ninho Integral 750g", unitType: "un", basePrice: 42.19, salePrice: 32.99, label: "750g" },
  { id: "p-farinha-trigo", vendorId: "vendor-uniao", categoryId: "cat-mercearia", name: "Farinha de Trigo Finna TP1 1kg", unitType: "cx", basePrice: 46.9, salePrice: 43.9, boxQuantity: 10, label: "CAIXA 10un" },
  { id: "p-file-peito-frango", vendorId: "vendor-seara", categoryId: "cat-acougue", name: "Filé de Peito de Frango Congelado Friato", unitType: "kg", basePrice: 16.24, salePrice: 14.74, isVariableWeight: true, avgWeight: 0.8, label: "Aprox. 0.8kg" },
  { id: "p-requeijao-tirolez", vendorId: "vendor-uniao", categoryId: "cat-frios", name: "Requeijão Cremoso Tirolez Bisnaga 1,5kg", unitType: "un", basePrice: 53.9, salePrice: 51.99, label: "1.5kg" },
  { id: "p-agua-sanitaria", vendorId: "vendor-brilux", categoryId: "cat-limpeza", name: "Água Sanitária Olimpo 1L", unitType: "un", basePrice: 2.85, salePrice: 2.29, label: "1L" },
  { id: "p-detergente-neutro", vendorId: "vendor-brilux", categoryId: "cat-limpeza", name: "Detergente Neutro Brilux 500ml", unitType: "un", basePrice: 2.55, salePrice: 2.25, label: "500ml" },
  { id: "p-cafe-pilao", vendorId: "vendor-uniao", categoryId: "cat-mercearia", name: "Café Tradicional Vácuo Pilão 250g", unitType: "un", basePrice: 13.89, salePrice: 12.99, label: "250g" },
  { id: "p-leite-condensado", vendorId: "vendor-uniao", categoryId: "cat-laticinios", name: "Leite Condensado Integral Camponesa 395g", unitType: "cx", basePrice: 175.23, salePrice: 167.13, boxQuantity: 27, label: "CAIXA 27un" },
  { id: "p-ovomaltine", vendorId: "vendor-uniao", categoryId: "cat-snacks", name: "Ovomaltine Flocos Extra Crocantes 750g", unitType: "un", basePrice: 35.9, salePrice: 32.9, label: "750g" },
  { id: "p-refrigerante-cola", vendorId: "vendor-uniao", categoryId: "cat-bebidas", name: "Refrigerante Cola 2L (Pack c/ 6)", unitType: "cx", basePrice: 47.4, salePrice: 43.9, boxQuantity: 6, label: "CAIXA 6un" },
  { id: "p-mussarela-natville", vendorId: "vendor-seara", categoryId: "cat-frios", name: "Queijo Mussarela Natville (Peça)", unitType: "kg", basePrice: 42.0, salePrice: 38.5, isVariableWeight: true, avgWeight: 4, label: "Aprox. 4kg" },
];

export const products: Product[] = seed.map((s) => ({
  id: s.id,
  vendorId: s.vendorId,
  name: s.name,
  description: `${s.name} — produto de linha profissional, ideal para revenda e uso em food service.`,
  sku: s.id.toUpperCase(),
  categoryId: s.categoryId,
  photos: [placeholderPhoto(s.id, s.name)],
  unitType: s.unitType,
  basePrice: s.basePrice,
  salePrice: s.salePrice,
  boxQuantity: s.boxQuantity,
  isVariableWeight: Boolean(s.isVariableWeight),
  avgWeight: s.avgWeight,
  stock: 500,
  variants: [],
  status: "active",
}));

// Package label ("750g", "CAIXA 10un", "Aprox. 2.5kg") isn't part of the shared Product
// type (it's presentation, not domain data) — keep it here, keyed by product id.
export const packageLabels: Record<string, string> = Object.fromEntries(seed.map((s) => [s.id, s.label]));

// Sem tela de login de verdade ainda (isso é trabalho de backend/auth) — este é o
// cliente "logado" fixo usado em todo o modo mock, já como CNPJ para exercitar a
// regra de frete grátis definida na skill.
export const mockCustomer: Customer = {
  id: "customer-mock-1",
  name: "Restaurante Sabor & Cia",
  email: "compras@saborecia.com.br",
  documentType: "cnpj",
  document: "45.678.901/0001-04",
  businessName: "Sabor & Cia Alimentação Ltda",
  phone: "(81) 99876-5432",
  regionId: "reg-recife",
  createdAt: "2026-01-10T00:00:00Z",
  status: "active",
  addresses: [
    {
      id: "addr-1",
      street: "Rua das Palmeiras",
      number: "245",
      complement: "Fundos",
      neighborhood: "Boa Viagem",
      city: "Recife",
      state: "PE",
      zipCode: "51020-000",
      isDefault: true,
    },
  ],
};

export const promotions: Promotion[] = [
  {
    id: "promo-semana",
    type: "percentage",
    rules: {},
    value: 0,
    isFeatured: true,
    startsAt: "2026-08-18T00:00:00Z",
    endsAt: "2026-08-25T23:59:59Z",
    currentUses: 0,
  },
];

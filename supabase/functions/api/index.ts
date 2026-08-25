// Backend real do full-commerce — Supabase Edge Function (Deno) implementando o
// contrato documentado em .claude/skills/ecommerce/references/api-contract.md.
// Espelha as regras de packages/api-client/src/domain.ts (mesma lógica, runtime
// diferente) para que mock e rest se comportem de forma idêntica.
//
// Autenticação: Supabase Auth (auth.users) — sem senha em texto puro em lugar
// nenhum. Login/registro retornam {token, ...}; o cliente manda esse token como
// "Authorization: Bearer <token>" nas chamadas autenticadas.
//
// verify_jwt=false no deploy: este arquivo faz sua própria verificação (rotas
// públicas como catálogo e login não têm token ainda).

import { Hono, type Context } from "npm:hono@4";
import { cors } from "npm:hono/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function db(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}
function eco() {
  return db().schema("ecommerce");
}

class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

const ALLOWED_ORIGINS = [
  "https://fullcommerce-storefront.ejnascimento1.workers.dev",
  "https://fullcommerce-admin.ejnascimento1.workers.dev",
  "http://localhost:3000",
  "http://localhost:3001",
];

// O Supabase remove só "/functions/v1" antes de invocar esta function — o slug
// "api" continua fazendo parte do caminho (confirmado via debug), por isso o
// basePath aqui é "/api" e as rotas abaixo (ex: "/settings") ficam relativas a ele.
const app = new Hono().basePath("/api");

app.use(
  "*",
  cors({
    origin: (origin) => (origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]),
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Rota inexistente" } }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: { code: err.code, message: err.message } }, err.status as 400);
  console.error(err);
  return c.json({ error: { code: "INTERNAL_ERROR", message: String(err) } }, 500);
});

// ---------- Auth helpers ----------

async function bearerUser(c: Context) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const { data, error } = await db().auth.getUser(header.slice(7));
  if (error || !data.user) return null;
  return data.user;
}

async function requireCustomer(c: Context) {
  const user = await bearerUser(c);
  if (!user) throw new ApiError(401, "UNAUTHENTICATED");
  const { data } = await eco().from("customers").select("*").eq("auth_user_id", user.id).maybeSingle();
  if (!data) throw new ApiError(401, "UNAUTHENTICATED");
  return data;
}

async function requireAdmin(c: Context) {
  const user = await bearerUser(c);
  if (!user) throw new ApiError(401, "UNAUTHENTICATED");
  const { data } = await eco().from("admin_users").select("*").eq("auth_user_id", user.id).maybeSingle();
  if (!data) throw new ApiError(401, "UNAUTHENTICATED");
  return data;
}

async function signInAndGetToken(email: string, password: string) {
  const { data, error } = await db().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new ApiError(401, "INVALID_CREDENTIALS");
  return data.session.access_token;
}

// Empresa 1 é o "fullcommerce" original, virado ambiente de demonstração —
// toda origem sem domínio próprio configurado cai aqui (hoje é sempre o caso,
// já que nenhum cliente configurou domínio ainda).
const DEMO_COMPANY_ID = "00000000-0000-0000-0000-000000000001";

// Rotas públicas (catálogo, cadastro) ainda não têm usuário logado pra saber
// a empresa — descobrem pelo domínio de onde veio a requisição (Origin do
// CORS). Cliente autenticado (admin ou customer) já carrega o company_id
// direto na própria linha (ver requireAdmin/requireCustomer), não precisa
// disso.
async function resolveCompanyId(c: Context): Promise<string> {
  const origin = c.req.header("Origin");
  if (!origin) return DEMO_COMPANY_ID;
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return DEMO_COMPANY_ID;
  }
  const { data } = await eco().from("companies").select("id").eq("domain", hostname).eq("active", true).maybeSingle();
  return data?.id ?? DEMO_COMPANY_ID;
}

// ---------- Mappers (snake_case do banco -> camelCase do contrato) ----------

function mapAddress(a: Record<string, unknown>) {
  return {
    id: a.id,
    street: a.street,
    number: a.number,
    complement: a.complement ?? undefined,
    neighborhood: a.neighborhood,
    city: a.city,
    state: a.state,
    zipCode: a.zip_code,
    isDefault: a.is_default,
    label: a.label ?? undefined,
  };
}

function mapCustomer(c: Record<string, unknown>, addresses: Record<string, unknown>[]) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    documentType: c.document_type,
    document: c.document,
    businessName: c.business_name ?? undefined,
    phone: c.phone,
    addresses: addresses.map(mapAddress),
    regionId: c.region_id ?? undefined,
    code: c.code ?? undefined,
    referenceCode: c.reference_code ?? undefined,
    createdAt: c.created_at,
    status: c.status,
  };
}

function mapAdminUser(u: Record<string, unknown>) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, vendorId: u.vendor_id ?? undefined };
}

function mapVendor(v: Record<string, unknown>) {
  return {
    id: v.id,
    name: v.name,
    cnpj: v.cnpj,
    logoUrl: v.logo_url ?? undefined,
    description: v.description ?? undefined,
    active: v.active,
    isFeatured: v.is_featured,
    code: v.code ?? undefined,
    referenceCode: v.reference_code ?? undefined,
  };
}

function mapCategory(c: Record<string, unknown>) {
  return { id: c.id, name: c.name, slug: c.slug, icon: c.icon ?? undefined, parentCategoryId: c.parent_category_id ?? undefined };
}

function mapRegion(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    active: r.active,
    cutoffTime: r.cutoff_time,
    estimatedDeliveryHours: r.estimated_delivery_hours,
    neighborhoods: r.neighborhoods ?? [],
  };
}

function mapVariant(v: Record<string, unknown>) {
  return { id: v.id, sku: v.sku, name: v.name, stock: v.stock, priceOverride: v.price_override ?? undefined };
}

function mapProduct(p: Record<string, unknown>, variants: Record<string, unknown>[] = [], autoPromotions: Record<string, unknown>[] = []) {
  const promoPrice = bestPromoPrice(p, autoPromotions);
  return {
    id: p.id,
    vendorId: p.vendor_id,
    name: p.name,
    description: p.description,
    sku: p.sku,
    customerReferenceCode: p.customer_reference_code ?? undefined,
    categoryId: p.category_id,
    brand: p.brand ?? undefined,
    photos: p.photos ?? [],
    unitType: p.unit_type,
    basePrice: Number(p.base_price),
    salePrice: promoPrice ?? (p.sale_price != null && Number(p.sale_price) > 0 ? Number(p.sale_price) : undefined),
    promotionActive: promoPrice != null,
    boxQuantity: p.box_quantity ?? undefined,
    isVariableWeight: p.is_variable_weight,
    avgWeight: p.avg_weight != null ? Number(p.avg_weight) : undefined,
    isSeasonal: p.is_seasonal ?? false,
    stock: p.stock,
    variants: variants.map(mapVariant),
    status: p.status,
    weight: p.weight != null ? Number(p.weight) : undefined,
  };
}

function mapPromotion(p: Record<string, unknown>) {
  return {
    id: p.id,
    type: p.type,
    rules: {
      productIds: p.product_ids?.length ? p.product_ids : undefined,
      categoryIds: p.category_ids?.length ? p.category_ids : undefined,
      vendorId: p.vendor_id ?? undefined,
      minOrderValue: p.min_order_value != null ? Number(p.min_order_value) : undefined,
    },
    value: Number(p.value),
    isFeatured: p.is_featured,
    startsAt: p.starts_at,
    endsAt: p.ends_at,
    couponCode: p.coupon_code ?? undefined,
    maxUses: p.max_uses ?? undefined,
    currentUses: p.current_uses,
  };
}

function mapSettings(s: Record<string, unknown>) {
  return {
    brandColor: s.brand_color,
    logoUrl: s.logo_url ?? undefined,
    banners: s.banners ?? [],
    promotionsEnabled: s.promotions_enabled,
    siteCopy: s.site_copy,
    footer: s.footer,
    minOrderValue: s.min_order_value != null ? Number(s.min_order_value) : undefined,
    freeShippingForCnpj: s.free_shipping_for_cnpj,
    shippingCost: Number(s.shipping_cost),
    pixKey: s.pix_key ?? undefined,
    pixReceiverName: s.pix_receiver_name ?? undefined,
    pixReceiverCity: s.pix_receiver_city ?? undefined,
    maxInstallments: s.max_installments,
    minInstallmentValue: Number(s.min_installment_value),
    interestFreeInstallments: s.interest_free_installments,
    monthlyInterestRate: Number(s.monthly_interest_rate),
    allowAdjustmentsAfterDispatch: s.allow_adjustments_after_dispatch,
  };
}

function mapOrder(o: Record<string, unknown>, items: Record<string, unknown>[], adjustments: Record<string, unknown>[] = []) {
  return {
    id: o.id,
    orderNumber: o.order_number,
    customerId: o.customer_id,
    items: items.map((i) => ({
      productId: i.product_id,
      vendorId: i.vendor_id,
      name: i.name,
      sku: i.sku,
      unitType: i.unit_type,
      unitPrice: Number(i.unit_price),
      quantity: Number(i.quantity),
      estimatedSubtotal: Number(i.estimated_subtotal),
      finalSubtotal: i.final_subtotal != null ? Number(i.final_subtotal) : undefined,
    })),
    shippingAddress: o.shipping_address,
    regionId: o.region_id ?? undefined,
    paymentMethod: o.payment_method,
    installments: o.installments ?? undefined,
    subtotal: Number(o.subtotal),
    discount: Number(o.discount),
    shipping: Number(o.shipping),
    total: Number(o.total),
    status: o.status,
    statusHistory: (o.order_status_history ?? []).map((h: Record<string, unknown>) => ({ status: h.status, changedAt: h.changed_at })),
    tracking: o.tracking ?? undefined,
    createdAt: o.created_at,
    itemAdjustments: adjustments.map((a) => ({
      productId: a.product_id,
      productName: a.product_name,
      previousSubtotal: Number(a.previous_subtotal),
      newSubtotal: Number(a.new_subtotal),
      adminName: a.admin_name,
      changedAt: a.changed_at,
    })),
  };
}

async function fetchOrderAdjustments(orderId: string) {
  const { data } = await eco().from("order_item_adjustments").select("*").eq("order_id", orderId).order("changed_at", { ascending: true });
  return data ?? [];
}

function mapQuote(q: Record<string, unknown>, items: Record<string, unknown>[]) {
  return {
    id: q.id,
    quoteNumber: q.quote_number,
    customerId: q.customer_id,
    status: q.status,
    note: q.note ?? undefined,
    quotedTotal: q.quoted_total != null ? Number(q.quoted_total) : undefined,
    quotedAt: q.quoted_at ?? undefined,
    responseNote: q.response_note ?? undefined,
    createdAt: q.created_at,
    items: items.map((i) => ({
      productId: i.product_id,
      vendorId: i.vendor_id,
      name: i.name,
      sku: i.sku,
      unitType: i.unit_type,
      quantity: Number(i.quantity),
      referenceUnitPrice: i.reference_unit_price != null ? Number(i.reference_unit_price) : undefined,
    })),
  };
}

// ---------- Domain (portado de packages/api-client/src/domain.ts) ----------

function unitPriceOf(p: Record<string, unknown>): number {
  return p.sale_price != null && Number(p.sale_price) > 0 ? Number(p.sale_price) : Number(p.base_price);
}

function buildOrderItem(p: Record<string, unknown>, quantity: number, autoPromotions: Record<string, unknown>[] = []) {
  const unitPrice = bestPromoPrice(p, autoPromotions) ?? unitPriceOf(p);
  const estimatedSubtotal = p.is_variable_weight ? unitPrice * Number(p.avg_weight ?? 1) * quantity : unitPrice * quantity;
  return {
    product_id: p.id,
    vendor_id: p.vendor_id,
    name: p.name,
    sku: p.sku,
    unit_type: p.unit_type,
    unit_price: unitPrice,
    quantity,
    estimated_subtotal: estimatedSubtotal,
  };
}

function matchRegionByNeighborhood(regions: Record<string, unknown>[], neighborhood: string) {
  const target = neighborhood.trim().toLowerCase();
  if (!target) return undefined;
  return regions.find((r) => r.active && (r.neighborhoods as string[]).some((n) => n.trim().toLowerCase() === target));
}

// A região só é resolvida uma vez, no cadastro. Se o admin cria a zona de entrega
// DEPOIS que o cliente já existia, o cliente ficaria "fora de zona" pra sempre sem
// isso — então toda vez que carregamos o cliente, tentamos casar de novo com o
// bairro do endereço padrão e persistimos se achar.
async function resolveCustomerRegion(customer: Record<string, unknown>) {
  if (customer.region_id) return customer;
  const { data: addresses } = await eco().from("addresses").select("*").eq("customer_id", customer.id);
  const defaultAddress = (addresses ?? []).find((a) => a.is_default) ?? addresses?.[0];
  if (!defaultAddress) return customer;
  const { data: regions } = await eco().from("delivery_regions").select("*").eq("company_id", customer.company_id);
  const region = matchRegionByNeighborhood(regions ?? [], defaultAddress.neighborhood as string);
  if (!region) return customer;
  const { data: updated } = await eco().from("customers").update({ region_id: region.id }).eq("id", customer.id).select("*").single();
  return updated ?? customer;
}

function calculateShipping(documentType: string, settings: Record<string, unknown>): number {
  if (documentType === "cnpj" && settings.free_shipping_for_cnpj) return 0;
  return Number(settings.shipping_cost);
}

function isPromotionActive(p: Record<string, unknown>, at: string = new Date().toISOString()): boolean {
  if ((p.starts_at as string) > at || (p.ends_at as string) < at) return false;
  if (p.max_uses != null && (p.current_uses as number) >= (p.max_uses as number)) return false;
  return true;
}

function calculatePromotionDiscount(
  promotion: Record<string, unknown>,
  lines: { product: Record<string, unknown>; subtotal: number }[],
  orderSubtotal: number,
): number {
  if (promotion.min_order_value && orderSubtotal < Number(promotion.min_order_value)) return 0;
  const categoryIds = (promotion.category_ids as string[]) ?? [];
  const productIds = (promotion.product_ids as string[]) ?? [];
  const eligible = lines.filter((line) => {
    if (categoryIds.length && !categoryIds.includes(line.product.category_id as string)) return false;
    if (promotion.vendor_id && line.product.vendor_id !== promotion.vendor_id) return false;
    if (productIds.length && !productIds.includes(line.product.id as string)) return false;
    return true;
  });
  const eligibleSubtotal = eligible.reduce((sum, l) => sum + l.subtotal, 0);
  if (eligibleSubtotal <= 0) return 0;
  if (promotion.type === "percentage") return Math.round(eligibleSubtotal * (Number(promotion.value) / 100) * 100) / 100;
  if (promotion.type === "fixed" || promotion.type === "coupon") return Math.min(Number(promotion.value), eligibleSubtotal);
  return 0;
}

// Promoções sem código de cupom são "automáticas": aplicam sozinhas, sem o
// cliente digitar nada — tanto no preço mostrado no catálogo quanto no total
// do pedido. Promoções com couponCode continuam exigindo que o cliente
// digite o código no checkout (ver calculatePromotionDiscount).
function activeAutoPromotions(promotions: Record<string, unknown>[]): Record<string, unknown>[] {
  return promotions.filter(
    (p) => isPromotionActive(p) && !p.coupon_code && (p.type === "percentage" || p.type === "fixed"),
  );
}

function bestPromoPrice(product: Record<string, unknown>, autoPromotions: Record<string, unknown>[]): number | null {
  const base = unitPriceOf(product);
  let best: number | null = null;
  for (const promo of autoPromotions) {
    const categoryIds = (promo.category_ids as string[]) ?? [];
    const productIds = (promo.product_ids as string[]) ?? [];
    if (categoryIds.length && !categoryIds.includes(product.category_id as string)) continue;
    if (promo.vendor_id && product.vendor_id !== promo.vendor_id) continue;
    if (productIds.length && !productIds.includes(product.id as string)) continue;
    const discounted = promo.type === "percentage" ? base * (1 - Number(promo.value) / 100) : Math.max(0, base - Number(promo.value));
    if (best === null || discounted < best) best = discounted;
  }
  if (best === null) return null;
  const rounded = Math.round(best * 100) / 100;
  return rounded < base ? rounded : null;
}

function isValidCPF(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const checkDigit = (base: string) => {
    let sum = 0;
    let weight = base.length + 1;
    for (const digit of base) {
      sum += Number(digit) * weight;
      weight--;
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  const d1 = checkDigit(cpf.slice(0, 9));
  const d2 = checkDigit(cpf.slice(0, 9) + d1);
  return cpf === cpf.slice(0, 9) + String(d1) + String(d2);
}

function isValidCNPJ(value: string): boolean {
  const cnpj = value.replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const checkDigit = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = checkDigit(cnpj.slice(0, 12), w1);
  const d2 = checkDigit(cnpj.slice(0, 12) + d1, w2);
  return cnpj === cnpj.slice(0, 12) + String(d1) + String(d2);
}

// ---------- Rotas públicas (catálogo) ----------

app.get("/regions", async (c) => {
  const companyId = await resolveCompanyId(c);
  const includeInactive = c.req.query("includeInactive") === "true";
  let query = eco().from("delivery_regions").select("*").eq("company_id", companyId);
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json((data ?? []).map(mapRegion));
});

app.get("/categories", async (c) => {
  const companyId = await resolveCompanyId(c);
  const { data, error } = await eco().from("categories").select("*").eq("company_id", companyId).order("name");
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json((data ?? []).map(mapCategory));
});

app.get("/vendors", async (c) => {
  const companyId = await resolveCompanyId(c);
  const featured = c.req.query("featured") === "true";
  const includeInactive = c.req.query("includeInactive") === "true";
  let query = eco().from("vendors").select("*").eq("company_id", companyId);
  if (!includeInactive) query = query.eq("active", true);
  if (featured) query = query.eq("is_featured", true);
  const { data, error } = await query;
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json((data ?? []).map(mapVendor));
});

async function getActiveAutoPromotions(companyId: string): Promise<Record<string, unknown>[]> {
  const { data } = await eco().from("promotions").select("*").eq("company_id", companyId);
  return activeAutoPromotions(data ?? []);
}

app.get("/products", async (c) => {
  const companyId = await resolveCompanyId(c);
  const categoryId = c.req.query("categoryId");
  const vendorId = c.req.query("vendorId");
  const q = c.req.query("q");
  const page = Number(c.req.query("page") ?? "1");
  const pageSize = Number(c.req.query("pageSize") ?? "24");
  let query = eco().from("products").select("*", { count: "exact" }).eq("company_id", companyId).eq("status", "active");
  if (categoryId) query = query.eq("category_id", categoryId);
  if (vendorId) query = query.eq("vendor_id", vendorId);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  const from = (page - 1) * pageSize;
  const [{ data, error, count }, autoPromotions] = await Promise.all([
    query.range(from, from + pageSize - 1),
    getActiveAutoPromotions(companyId),
  ]);
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json({ items: (data ?? []).map((p) => mapProduct(p, [], autoPromotions)), total: count ?? 0, page, pageSize });
});

app.get("/products/best-sellers", async (c) => {
  const companyId = await resolveCompanyId(c);
  const limit = Number(c.req.query("limit") ?? "12");
  const { data: items, error } = await eco()
    .from("order_items")
    .select("product_id, quantity, orders!inner(status, company_id)")
    .eq("orders.company_id", companyId)
    .not("orders.status", "in", "(CANCELLED,REFUNDED)");
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  const totals = new Map<string, number>();
  for (const i of items ?? []) totals.set(i.product_id as string, (totals.get(i.product_id as string) ?? 0) + Number(i.quantity));
  const topIds = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  if (topIds.length === 0) return c.json([]);
  const [{ data: products }, autoPromotions] = await Promise.all([
    eco().from("products").select("*").eq("company_id", companyId).in("id", topIds).eq("status", "active"),
    getActiveAutoPromotions(companyId),
  ]);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  return c.json(topIds.map((id) => byId.get(id)).filter(Boolean).map((p) => mapProduct(p!, [], autoPromotions)));
});

app.get("/products/:id", async (c) => {
  const companyId = await resolveCompanyId(c);
  const { data: product, error } = await eco().from("products").select("*").eq("id", c.req.param("id")).eq("company_id", companyId).maybeSingle();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  if (!product) throw new ApiError(404, "NOT_FOUND");
  const [{ data: variants }, autoPromotions] = await Promise.all([
    eco().from("product_variants").select("*").eq("product_id", product.id),
    getActiveAutoPromotions(companyId),
  ]);
  return c.json(mapProduct(product, variants ?? [], autoPromotions));
});

app.get("/settings", async (c) => {
  const companyId = await resolveCompanyId(c);
  const { data, error } = await eco().from("store_settings").select("*").eq("company_id", companyId).maybeSingle();
  if (error || !data) throw new ApiError(500, "DB_ERROR", error?.message);
  return c.json(mapSettings(data));
});

app.get("/promotions/active", async (c) => {
  const companyId = await resolveCompanyId(c);
  const featuredOnly = c.req.query("featured") === "true";
  let query = eco().from("promotions").select("*").eq("company_id", companyId);
  if (featuredOnly) query = query.eq("is_featured", true);
  const { data, error } = await query;
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json((data ?? []).filter((p) => isPromotionActive(p)).map(mapPromotion));
});

app.get("/promotions/coupon/:code", async (c) => {
  const companyId = await resolveCompanyId(c);
  const { data: settings } = await eco().from("store_settings").select("promotions_enabled").eq("company_id", companyId).maybeSingle();
  if (!settings?.promotions_enabled) return c.json(null);
  const code = c.req.param("code").trim().toUpperCase();
  const { data } = await eco().from("promotions").select("*").eq("company_id", companyId).ilike("coupon_code", code).maybeSingle();
  if (!data || !isPromotionActive(data)) return c.json(null);
  return c.json(mapPromotion(data));
});

// ---------- Auth do cliente ----------

app.post("/auth/register", async (c) => {
  const companyId = await resolveCompanyId(c);
  const body = await c.req.json();
  const { name, email, password, documentType, document, businessName, phone, address, businessAddress, referenceCode } = body;
  const isValidDoc = documentType === "cpf" ? isValidCPF(document) : isValidCNPJ(document);
  if (!isValidDoc) throw new ApiError(422, "INVALID_DOCUMENT");

  const { data: created, error: createError } = await db().auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) throw new ApiError(422, "EMAIL_IN_USE", createError?.message);

  const { data: regions } = await eco().from("delivery_regions").select("*").eq("company_id", companyId);
  const region = matchRegionByNeighborhood(regions ?? [], address.neighborhood);
  const { data: codeRow } = await eco().rpc("next_customer_code");

  const { data: customer, error: insertError } = await eco()
    .from("customers")
    .insert({
      company_id: companyId,
      auth_user_id: created.user.id,
      name,
      email,
      document_type: documentType,
      document,
      business_name: businessName ?? null,
      phone,
      region_id: region?.id ?? null,
      code: codeRow,
      reference_code: referenceCode ?? null,
      status: "active",
    })
    .select("*")
    .single();
  if (insertError) {
    await db().auth.admin.deleteUser(created.user.id);
    throw new ApiError(500, "DB_ERROR", insertError.message);
  }

  const addressRows = [
    { company_id: companyId, customer_id: customer.id, ...toAddressRow(address), is_default: true, label: address.label ?? "Entrega" },
  ];
  if (businessAddress) {
    addressRows.push({
      company_id: companyId,
      customer_id: customer.id,
      ...toAddressRow(businessAddress),
      is_default: false,
      label: businessAddress.label ?? "Endereço",
    });
  }
  const { data: insertedAddresses } = await eco().from("addresses").insert(addressRows).select("*");

  const token = await signInAndGetToken(email, password);
  return c.json({ token, customer: mapCustomer(customer, insertedAddresses ?? []) });
});

function toAddressRow(a: Record<string, unknown>) {
  return {
    street: a.street,
    number: a.number,
    complement: a.complement ?? null,
    neighborhood: a.neighborhood,
    city: a.city,
    state: a.state,
    zip_code: a.zipCode,
  };
}

app.post("/auth/login", async (c) => {
  const { email, password } = await c.req.json();
  const token = await signInAndGetToken(email, password);
  const { data: user } = await db().auth.getUser(token);
  const { data: customer } = await eco().from("customers").select("*").eq("auth_user_id", user.user!.id).maybeSingle();
  if (!customer) throw new ApiError(401, "INVALID_CREDENTIALS");
  const resolved = await resolveCustomerRegion(customer);
  const { data: addresses } = await eco().from("addresses").select("*").eq("customer_id", resolved.id);
  return c.json({ token, customer: mapCustomer(resolved, addresses ?? []) });
});

app.post("/auth/reset-password", async (c) => {
  const { email, newPassword } = await c.req.json();
  const { data, error } = await db().auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.user) throw new ApiError(404, "EMAIL_NOT_FOUND");
  const { error: updateError } = await db().auth.admin.updateUserById(data.user.id, { password: newPassword });
  if (updateError) throw new ApiError(500, "DB_ERROR", updateError.message);
  return c.body(null, 204);
});

app.post("/auth/logout", (c) => c.body(null, 204));

app.get("/customers/me", async (c) => {
  const user = await bearerUser(c);
  if (!user) return c.json(null);
  const { data: customer } = await eco().from("customers").select("*").eq("auth_user_id", user.id).maybeSingle();
  if (!customer) return c.json(null);
  const resolved = await resolveCustomerRegion(customer);
  const { data: addresses } = await eco().from("addresses").select("*").eq("customer_id", resolved.id);
  return c.json(mapCustomer(resolved, addresses ?? []));
});

// ---------- Pedidos (cliente) ----------

app.post("/orders", async (c) => {
  const customer = await requireCustomer(c);
  const input = await c.req.json();

  const { data: address } = await eco().from("addresses").select("*").eq("id", input.addressId).eq("customer_id", customer.id).maybeSingle();
  if (!address) throw new ApiError(422, "ADDRESS_NOT_FOUND");

  const productIds = input.items.map((i: { productId: string }) => i.productId);
  const [{ data: products }, autoPromotions] = await Promise.all([
    eco().from("products").select("*").eq("company_id", customer.company_id).in("id", productIds),
    getActiveAutoPromotions(customer.company_id),
  ]);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  const items = input.items.map((i: { productId: string; quantity: number }) => {
    const product = productById.get(i.productId);
    if (!product) throw new ApiError(422, "PRODUCT_NOT_FOUND");
    return buildOrderItem(product, i.quantity, autoPromotions);
  });
  const subtotal = items.reduce((sum: number, i: { estimated_subtotal: number }) => sum + i.estimated_subtotal, 0);

  const { data: settings } = await eco().from("store_settings").select("*").eq("company_id", customer.company_id).single();
  if (settings.min_order_value && subtotal < Number(settings.min_order_value)) throw new ApiError(422, "BELOW_MIN_ORDER_VALUE");

  let discount = 0;
  let shipping = calculateShipping(customer.document_type, settings);
  let appliedPromotion: Record<string, unknown> | null = null;
  if (input.couponCode && settings.promotions_enabled) {
    const { data: promotion } = await eco()
      .from("promotions")
      .select("*")
      .eq("company_id", customer.company_id)
      .ilike("coupon_code", input.couponCode.trim())
      .maybeSingle();
    if (promotion && isPromotionActive(promotion)) {
      appliedPromotion = promotion;
      if (promotion.type === "freeShipping") shipping = 0;
      else {
        const lines = items.map((it: { product_id: string; estimated_subtotal: number }) => ({
          product: productById.get(it.product_id)!,
          subtotal: it.estimated_subtotal,
        }));
        discount = calculatePromotionDiscount(promotion, lines, subtotal);
      }
    }
  }
  const total = Math.max(0, subtotal - discount) + shipping;

  const { data: orderNumberRow } = await eco().rpc("next_order_number");
  const orderNumber = orderNumberRow as unknown as string;
  const now = new Date().toISOString();

  const { data: order, error: orderError } = await eco()
    .from("orders")
    .insert({
      company_id: customer.company_id,
      order_number: orderNumber,
      customer_id: customer.id,
      shipping_address: mapAddress(address),
      region_id: customer.region_id,
      payment_method: input.paymentMethod,
      installments: input.paymentMethod === "card" ? input.installments ?? null : null,
      subtotal,
      discount,
      shipping,
      total,
      status: "PAID",
      coupon_code: appliedPromotion ? input.couponCode : null,
    })
    .select("*")
    .single();
  if (orderError) throw new ApiError(500, "DB_ERROR", orderError.message);

  await eco()
    .from("order_items")
    .insert(items.map((i: Record<string, unknown>) => ({ ...i, company_id: customer.company_id, order_id: order.id })));
  await eco()
    .from("order_status_history")
    .insert([
      { company_id: customer.company_id, order_id: order.id, status: "PENDING", changed_at: now },
      { company_id: customer.company_id, order_id: order.id, status: "PAID", changed_at: now },
    ]);
  if (appliedPromotion) {
    await eco()
      .from("promotions")
      .update({ current_uses: (appliedPromotion.current_uses as number) + 1 })
      .eq("id", appliedPromotion.id);
  }

  const { data: fullItems } = await eco().from("order_items").select("*").eq("order_id", order.id);
  const { data: history } = await eco().from("order_status_history").select("*").eq("order_id", order.id);
  return c.json(mapOrder({ ...order, order_status_history: history }, fullItems ?? [], await fetchOrderAdjustments(order.id)));
});

app.get("/orders", async (c) => {
  const customer = await requireCustomer(c);
  const { data: orders } = await eco().from("orders").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false });
  const results = await Promise.all(
    (orders ?? []).map(async (o) => {
      const { data: items } = await eco().from("order_items").select("*").eq("order_id", o.id);
      const { data: history } = await eco().from("order_status_history").select("*").eq("order_id", o.id);
      return mapOrder({ ...o, order_status_history: history }, items ?? [], await fetchOrderAdjustments(o.id));
    }),
  );
  return c.json(results);
});

app.get("/orders/:id", async (c) => {
  const customer = await requireCustomer(c);
  const { data: order } = await eco().from("orders").select("*").eq("id", c.req.param("id")).maybeSingle();
  if (!order || order.customer_id !== customer.id) throw new ApiError(404, "NOT_FOUND");
  const { data: items } = await eco().from("order_items").select("*").eq("order_id", order.id);
  const { data: history } = await eco().from("order_status_history").select("*").eq("order_id", order.id);
  return c.json(mapOrder({ ...order, order_status_history: history }, items ?? [], await fetchOrderAdjustments(order.id)));
});

// ---------- Orçamentos (cliente) ----------

app.post("/quotes", async (c) => {
  const customer = await requireCustomer(c);
  const input = await c.req.json();
  const productIds = input.items.map((i: { productId: string }) => i.productId);
  const { data: products } = await eco().from("products").select("*").eq("company_id", customer.company_id).in("id", productIds);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  const { data: quoteNumberRow } = await eco().rpc("next_quote_number");
  const { data: quote, error } = await eco()
    .from("quotes")
    .insert({ company_id: customer.company_id, quote_number: quoteNumberRow, customer_id: customer.id, note: input.note ?? null })
    .select("*")
    .single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);

  const itemRows = input.items.map((i: { productId: string; quantity: number }) => {
    const p = productById.get(i.productId);
    if (!p) throw new ApiError(422, "PRODUCT_NOT_FOUND");
    return {
      company_id: customer.company_id,
      quote_id: quote.id,
      product_id: p.id,
      vendor_id: p.vendor_id,
      name: p.name,
      sku: p.sku,
      unit_type: p.unit_type,
      quantity: i.quantity,
      reference_unit_price: unitPriceOf(p),
    };
  });
  await eco().from("quote_items").insert(itemRows);
  const { data: fullItems } = await eco().from("quote_items").select("*").eq("quote_id", quote.id);
  return c.json(mapQuote(quote, fullItems ?? []));
});

app.get("/quotes", async (c) => {
  const customer = await requireCustomer(c);
  const { data: quotes } = await eco().from("quotes").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false });
  const results = await Promise.all(
    (quotes ?? []).map(async (q) => {
      const { data: items } = await eco().from("quote_items").select("*").eq("quote_id", q.id);
      return mapQuote(q, items ?? []);
    }),
  );
  return c.json(results);
});

// ---------- Auth do admin ----------

app.post("/admin/auth/register", async (c) => {
  const companyId = await resolveCompanyId(c);
  const { name, email, password } = await c.req.json();
  const { data: created, error: createError } = await db().auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) throw new ApiError(422, "EMAIL_IN_USE", createError?.message);
  const { data: adminUser, error } = await eco()
    .from("admin_users")
    .insert({ company_id: companyId, auth_user_id: created.user.id, name, email, role: "platformAdmin" })
    .select("*")
    .single();
  if (error) {
    await db().auth.admin.deleteUser(created.user.id);
    throw new ApiError(500, "DB_ERROR", error.message);
  }
  const token = await signInAndGetToken(email, password);
  return c.json({ token, adminUser: mapAdminUser(adminUser) });
});

app.post("/admin/auth/login", async (c) => {
  const { email, password } = await c.req.json();
  const token = await signInAndGetToken(email, password);
  const { data: user } = await db().auth.getUser(token);
  const { data: adminUser } = await eco().from("admin_users").select("*").eq("auth_user_id", user.user!.id).maybeSingle();
  if (!adminUser) throw new ApiError(401, "INVALID_CREDENTIALS");
  return c.json({ token, adminUser: mapAdminUser(adminUser) });
});

app.post("/admin/auth/reset-password", async (c) => {
  const { email, newPassword } = await c.req.json();
  const { data, error } = await db().auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.user) throw new ApiError(404, "EMAIL_NOT_FOUND");
  const { error: updateError } = await db().auth.admin.updateUserById(data.user.id, { password: newPassword });
  if (updateError) throw new ApiError(500, "DB_ERROR", updateError.message);
  return c.body(null, 204);
});

app.post("/admin/auth/logout", (c) => c.body(null, 204));

app.get("/admin/auth/me", async (c) => {
  const user = await bearerUser(c);
  if (!user) return c.json(null);
  const { data: adminUser } = await eco().from("admin_users").select("*").eq("auth_user_id", user.id).maybeSingle();
  return c.json(adminUser ? mapAdminUser(adminUser) : null);
});

// ---------- Admin: produtos ----------

app.post("/products", async (c) => {
  const admin = await requireAdmin(c);
  const input = await c.req.json();
  const vendorId = admin.role === "vendorAdmin" ? admin.vendor_id : input.vendorId;
  const { data, error } = await eco()
    .from("products")
    .insert({
      company_id: admin.company_id,
      vendor_id: vendorId,
      category_id: input.categoryId,
      name: input.name,
      description: input.description ?? "",
      sku: input.sku,
      customer_reference_code: input.customerReferenceCode ?? null,
      brand: input.brand ?? null,
      photos: input.photos ?? [],
      unit_type: input.unitType,
      base_price: input.basePrice,
      sale_price: input.salePrice && input.salePrice > 0 ? input.salePrice : null,
      box_quantity: input.boxQuantity ?? null,
      is_variable_weight: input.isVariableWeight ?? false,
      avg_weight: input.avgWeight ?? null,
      is_seasonal: input.isSeasonal ?? false,
      stock: input.stock ?? 0,
      status: input.status ?? "active",
      weight: input.weight ?? null,
    })
    .select("*")
    .single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json(mapProduct(data));
});

app.patch("/products/:id", async (c) => {
  const admin = await requireAdmin(c);
  const patch = await c.req.json();
  const { data: existing } = await eco().from("products").select("vendor_id, company_id").eq("id", c.req.param("id")).maybeSingle();
  if (!existing || existing.company_id !== admin.company_id) throw new ApiError(404, "NOT_FOUND");
  if (admin.role === "vendorAdmin" && existing.vendor_id !== admin.vendor_id) throw new ApiError(403, "FORBIDDEN");

  const row: Record<string, unknown> = {};
  const map: Record<string, string> = {
    vendorId: "vendor_id",
    categoryId: "category_id",
    name: "name",
    description: "description",
    sku: "sku",
    customerReferenceCode: "customer_reference_code",
    brand: "brand",
    photos: "photos",
    unitType: "unit_type",
    basePrice: "base_price",
    salePrice: "sale_price",
    boxQuantity: "box_quantity",
    isVariableWeight: "is_variable_weight",
    avgWeight: "avg_weight",
    isSeasonal: "is_seasonal",
    stock: "stock",
    status: "status",
    weight: "weight",
  };
  for (const [k, v] of Object.entries(patch)) if (map[k]) row[map[k]] = v;
  if ("vendor_id" in row && admin.role !== "platformAdmin") delete row.vendor_id;
  if ("sale_price" in row && (!row.sale_price || Number(row.sale_price) <= 0)) row.sale_price = null;

  const { data, error } = await eco().from("products").update(row).eq("id", c.req.param("id")).eq("company_id", admin.company_id).select("*").single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json(mapProduct(data));
});

app.post("/products/:id/photos", async (c) => {
  await requireAdmin(c);
  const form = await c.req.formData();
  const file = form.get("file") as File;
  if (!file) throw new ApiError(422, "FILE_REQUIRED");
  const path = `${c.req.param("id")}/${Date.now()}-${file.name}`;
  const { error } = await db().storage.from("ecommerce-product-photos").upload(path, file, { contentType: file.type });
  if (error) throw new ApiError(500, "STORAGE_ERROR", error.message);
  const { data } = db().storage.from("ecommerce-product-photos").getPublicUrl(path);
  return c.json({ url: data.publicUrl });
});

app.get("/admin/products", async (c) => {
  const admin = await requireAdmin(c);
  let query = eco().from("products").select("*").eq("company_id", admin.company_id).order("name");
  if (admin.role === "vendorAdmin") query = query.eq("vendor_id", admin.vendor_id);
  const { data, error } = await query;
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json((data ?? []).map((p) => mapProduct(p)));
});

// Sem aplicar bestPromoPrice de propósito: o admin precisa ver/editar o
// preço promocional de verdade que está gravado no produto, não o preço já
// misturado com uma Promoção de campanha (isso é só pra exibição pública).
app.get("/admin/products/:id", async (c) => {
  const admin = await requireAdmin(c);
  const { data: product, error } = await eco().from("products").select("*").eq("id", c.req.param("id")).eq("company_id", admin.company_id).maybeSingle();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  if (!product) throw new ApiError(404, "NOT_FOUND");
  if (admin.role === "vendorAdmin" && product.vendor_id !== admin.vendor_id) throw new ApiError(403, "FORBIDDEN");
  const { data: variants } = await eco().from("product_variants").select("*").eq("product_id", product.id);
  return c.json(mapProduct(product, variants ?? []));
});

// ---------- Admin: fornecedores ----------

app.post("/vendors", async (c) => {
  const admin = await requireAdmin(c);
  const input = await c.req.json();
  const { data, error } = await eco()
    .from("vendors")
    .insert({
      company_id: admin.company_id,
      name: input.name,
      cnpj: input.cnpj,
      logo_url: input.logoUrl ?? null,
      description: input.description ?? null,
      active: input.active ?? true,
      is_featured: input.isFeatured ?? false,
      code: input.code ?? null,
      reference_code: input.referenceCode ?? null,
    })
    .select("*")
    .single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json(mapVendor(data));
});

app.patch("/vendors/:id", async (c) => {
  const admin = await requireAdmin(c);
  const patch = await c.req.json();
  const row: Record<string, unknown> = {};
  if ("name" in patch) row.name = patch.name;
  if ("cnpj" in patch) row.cnpj = patch.cnpj;
  if ("logoUrl" in patch) row.logo_url = patch.logoUrl;
  if ("description" in patch) row.description = patch.description;
  if ("active" in patch) row.active = patch.active;
  if ("isFeatured" in patch) row.is_featured = patch.isFeatured;
  if ("code" in patch) row.code = patch.code;
  if ("referenceCode" in patch) row.reference_code = patch.referenceCode;
  const { data, error } = await eco().from("vendors").update(row).eq("id", c.req.param("id")).eq("company_id", admin.company_id).select("*").single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json(mapVendor(data));
});

// ---------- Admin: roteirização ----------

app.post("/regions", async (c) => {
  const admin = await requireAdmin(c);
  const input = await c.req.json();
  const { data, error } = await eco()
    .from("delivery_regions")
    .insert({
      company_id: admin.company_id,
      name: input.name,
      active: input.active ?? true,
      cutoff_time: input.cutoffTime,
      estimated_delivery_hours: input.estimatedDeliveryHours,
      neighborhoods: input.neighborhoods ?? [],
    })
    .select("*")
    .single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json(mapRegion(data));
});

app.patch("/regions/:id", async (c) => {
  const admin = await requireAdmin(c);
  const patch = await c.req.json();
  const row: Record<string, unknown> = {};
  if ("name" in patch) row.name = patch.name;
  if ("active" in patch) row.active = patch.active;
  if ("cutoffTime" in patch) row.cutoff_time = patch.cutoffTime;
  if ("estimatedDeliveryHours" in patch) row.estimated_delivery_hours = patch.estimatedDeliveryHours;
  if ("neighborhoods" in patch) row.neighborhoods = patch.neighborhoods;
  const { data, error } = await eco().from("delivery_regions").update(row).eq("id", c.req.param("id")).eq("company_id", admin.company_id).select("*").single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json(mapRegion(data));
});

// ---------- Admin: clientes ----------

app.get("/admin/customers", async (c) => {
  const admin = await requireAdmin(c);
  const { data: customers, error } = await eco().from("customers").select("*").eq("company_id", admin.company_id).order("created_at", { ascending: false });
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  const results = await Promise.all(
    (customers ?? []).map(async (cust) => {
      const { data: addresses } = await eco().from("addresses").select("*").eq("customer_id", cust.id);
      return mapCustomer(cust, addresses ?? []);
    }),
  );
  return c.json(results);
});

app.patch("/admin/customers/:id", async (c) => {
  const admin = await requireAdmin(c);
  const patch = await c.req.json();
  const row: Record<string, unknown> = {};
  if ("name" in patch) row.name = patch.name;
  if ("phone" in patch) row.phone = patch.phone;
  if ("businessName" in patch) row.business_name = patch.businessName;
  if ("regionId" in patch) row.region_id = patch.regionId;
  if ("referenceCode" in patch) row.reference_code = patch.referenceCode;
  if ("status" in patch) row.status = patch.status;
  const { data: customer, error } = await eco()
    .from("customers")
    .update(row)
    .eq("id", c.req.param("id"))
    .eq("company_id", admin.company_id)
    .select("*")
    .single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  const { data: addresses } = await eco().from("addresses").select("*").eq("customer_id", customer.id);
  return c.json(mapCustomer(customer, addresses ?? []));
});

// ---------- Admin: pedidos e orçamentos ----------

app.get("/admin/orders", async (c) => {
  const admin = await requireAdmin(c);
  const status = c.req.query("status");
  let query = eco()
    .from("orders")
    .select("*, order_items!inner(vendor_id)")
    .eq("company_id", admin.company_id)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (admin.role === "vendorAdmin") query = query.eq("order_items.vendor_id", admin.vendor_id);
  const { data: orders } = await query;
  const uniqueOrders = [...new Map((orders ?? []).map((o) => [o.id, o])).values()];
  const results = await Promise.all(
    uniqueOrders.map(async (o) => {
      const { data: items } = await eco().from("order_items").select("*").eq("order_id", o.id);
      const { data: history } = await eco().from("order_status_history").select("*").eq("order_id", o.id);
      return mapOrder({ ...o, order_status_history: history }, items ?? [], await fetchOrderAdjustments(o.id));
    }),
  );
  return c.json(results);
});

app.get("/admin/orders/:id", async (c) => {
  const admin = await requireAdmin(c);
  const { data: order } = await eco().from("orders").select("*").eq("id", c.req.param("id")).eq("company_id", admin.company_id).maybeSingle();
  if (!order) throw new ApiError(404, "NOT_FOUND");
  const { data: items } = await eco().from("order_items").select("*").eq("order_id", order.id);
  if (admin.role === "vendorAdmin" && !(items ?? []).some((i) => i.vendor_id === admin.vendor_id)) throw new ApiError(403, "FORBIDDEN");
  const { data: history } = await eco().from("order_status_history").select("*").eq("order_id", order.id);
  return c.json(mapOrder({ ...order, order_status_history: history }, items ?? [], await fetchOrderAdjustments(order.id)));
});

// Ajuste feito na separação (peso variável, falta de estoque): grava a
// quantidade realmente enviada por item. estimated_subtotal original nunca
// é sobrescrito — cliente e loja precisam poder comparar antes x depois.
const DISPATCHED_STATUSES = new Set(["OUT_FOR_DELIVERY", "DELIVERED"]);

app.patch("/admin/orders/:id/items", async (c) => {
  const admin = await requireAdmin(c);
  const { items } = await c.req.json();
  const { data: order } = await eco().from("orders").select("*").eq("id", c.req.param("id")).eq("company_id", admin.company_id).maybeSingle();
  if (!order) throw new ApiError(404, "NOT_FOUND");

  if (DISPATCHED_STATUSES.has(order.status as string)) {
    const { data: settings } = await eco().from("store_settings").select("allow_adjustments_after_dispatch").eq("company_id", admin.company_id).maybeSingle();
    if (!settings?.allow_adjustments_after_dispatch) {
      throw new ApiError(422, "ORDER_ALREADY_DISPATCHED", "Pedido já saiu para entrega ou foi entregue — mercadoria já baixada do estoque e nota fiscal emitida.");
    }
  }

  const { data: orderItems } = await eco().from("order_items").select("*").eq("order_id", order.id);
  const auditRows: Record<string, unknown>[] = [];
  for (const adj of items as { productId: string; finalQuantity: number }[]) {
    const item = (orderItems ?? []).find((i) => i.product_id === adj.productId);
    if (!item) continue;
    if (admin.role === "vendorAdmin" && item.vendor_id !== admin.vendor_id) continue;
    const previousSubtotal = item.final_subtotal != null ? Number(item.final_subtotal) : Number(item.estimated_subtotal);
    const newSubtotal = Math.round(Number(item.unit_price) * adj.finalQuantity * 100) / 100;
    if (newSubtotal === previousSubtotal) continue;
    await eco().from("order_items").update({ final_subtotal: newSubtotal }).eq("id", item.id);
    auditRows.push({
      company_id: admin.company_id,
      order_id: order.id,
      order_item_id: item.id,
      product_id: item.product_id,
      product_name: item.name,
      previous_subtotal: previousSubtotal,
      new_subtotal: newSubtotal,
      admin_id: admin.id,
      admin_name: admin.name,
    });
  }
  if (auditRows.length) await eco().from("order_item_adjustments").insert(auditRows);

  const { data: updatedItems } = await eco().from("order_items").select("*").eq("order_id", order.id);
  const newSubtotal =
    Math.round(
      (updatedItems ?? []).reduce((sum, i) => sum + (i.final_subtotal != null ? Number(i.final_subtotal) : Number(i.estimated_subtotal)), 0) * 100,
    ) / 100;
  const newTotal = Math.round((Math.max(0, newSubtotal - Number(order.discount)) + Number(order.shipping)) * 100) / 100;
  const { data: updatedOrder, error } = await eco()
    .from("orders")
    .update({ subtotal: newSubtotal, total: newTotal })
    .eq("id", order.id)
    .select("*")
    .single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);

  const { data: history } = await eco().from("order_status_history").select("*").eq("order_id", order.id);
  return c.json(mapOrder({ ...updatedOrder, order_status_history: history }, updatedItems ?? [], await fetchOrderAdjustments(order.id)));
});

app.patch("/orders/:id/status", async (c) => {
  const admin = await requireAdmin(c);
  const { status } = await c.req.json();
  const { data: order, error } = await eco()
    .from("orders")
    .update({ status })
    .eq("id", c.req.param("id"))
    .eq("company_id", admin.company_id)
    .select("*")
    .single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  await eco()
    .from("order_status_history")
    .insert({ company_id: admin.company_id, order_id: order.id, status, changed_at: new Date().toISOString() });
  const { data: items } = await eco().from("order_items").select("*").eq("order_id", order.id);
  const { data: history } = await eco().from("order_status_history").select("*").eq("order_id", order.id);
  return c.json(mapOrder({ ...order, order_status_history: history }, items ?? [], await fetchOrderAdjustments(order.id)));
});

app.get("/admin/quotes", async (c) => {
  const admin = await requireAdmin(c);
  const { data: quotes } = await eco().from("quotes").select("*").eq("company_id", admin.company_id).order("created_at", { ascending: false });
  const results = await Promise.all(
    (quotes ?? []).map(async (q) => {
      const { data: items } = await eco().from("quote_items").select("*").eq("quote_id", q.id);
      return mapQuote(q, items ?? []);
    }),
  );
  return c.json(results);
});

app.patch("/admin/quotes/:id", async (c) => {
  const admin = await requireAdmin(c);
  const patch = await c.req.json();
  const row: Record<string, unknown> = {};
  if ("status" in patch) row.status = patch.status;
  if ("quotedTotal" in patch) row.quoted_total = patch.quotedTotal;
  if ("responseNote" in patch) row.response_note = patch.responseNote;
  if (patch.status === "quoted") row.quoted_at = new Date().toISOString();
  const { data: quote, error } = await eco()
    .from("quotes")
    .update(row)
    .eq("id", c.req.param("id"))
    .eq("company_id", admin.company_id)
    .select("*")
    .single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  const { data: items } = await eco().from("quote_items").select("*").eq("quote_id", quote.id);
  return c.json(mapQuote(quote, items ?? []));
});

// ---------- Admin: configurações ----------

app.patch("/settings", async (c) => {
  const admin = await requireAdmin(c);
  const patch = await c.req.json();
  const row: Record<string, unknown> = {};
  if ("brandColor" in patch) row.brand_color = patch.brandColor;
  if ("logoUrl" in patch) row.logo_url = patch.logoUrl;
  if ("banners" in patch) row.banners = patch.banners;
  if ("promotionsEnabled" in patch) row.promotions_enabled = patch.promotionsEnabled;
  if ("siteCopy" in patch) row.site_copy = patch.siteCopy;
  if ("footer" in patch) row.footer = patch.footer;
  if ("minOrderValue" in patch) row.min_order_value = patch.minOrderValue;
  if ("freeShippingForCnpj" in patch) row.free_shipping_for_cnpj = patch.freeShippingForCnpj;
  if ("shippingCost" in patch) row.shipping_cost = patch.shippingCost;
  if ("pixKey" in patch) row.pix_key = patch.pixKey;
  if ("pixReceiverName" in patch) row.pix_receiver_name = patch.pixReceiverName;
  if ("pixReceiverCity" in patch) row.pix_receiver_city = patch.pixReceiverCity;
  if ("maxInstallments" in patch) row.max_installments = patch.maxInstallments;
  if ("minInstallmentValue" in patch) row.min_installment_value = patch.minInstallmentValue;
  if ("interestFreeInstallments" in patch) row.interest_free_installments = patch.interestFreeInstallments;
  if ("monthlyInterestRate" in patch) row.monthly_interest_rate = patch.monthlyInterestRate;
  if ("allowAdjustmentsAfterDispatch" in patch) row.allow_adjustments_after_dispatch = patch.allowAdjustmentsAfterDispatch;
  row.updated_at = new Date().toISOString();
  const { data, error } = await eco().from("store_settings").update(row).eq("company_id", admin.company_id).select("*").single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json(mapSettings(data));
});

app.post("/settings/logo", async (c) => {
  await requireAdmin(c);
  const form = await c.req.formData();
  const file = form.get("file") as File;
  if (!file) throw new ApiError(422, "FILE_REQUIRED");
  const path = `logo-${Date.now()}-${file.name}`;
  const { error } = await db().storage.from("ecommerce-site-assets").upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new ApiError(500, "STORAGE_ERROR", error.message);
  const { data } = db().storage.from("ecommerce-site-assets").getPublicUrl(path);
  return c.json({ url: data.publicUrl });
});

// ---------- Admin: promoções ----------

app.get("/admin/promotions", async (c) => {
  const admin = await requireAdmin(c);
  let query = eco().from("promotions").select("*").eq("company_id", admin.company_id);
  if (admin.role === "vendorAdmin") query = query.eq("vendor_id", admin.vendor_id);
  const { data, error } = await query;
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json((data ?? []).map(mapPromotion));
});

app.post("/admin/promotions", async (c) => {
  const admin = await requireAdmin(c);
  const input = await c.req.json();
  const vendorId = admin.role === "vendorAdmin" ? admin.vendor_id : input.rules?.vendorId ?? null;
  const { data, error } = await eco()
    .from("promotions")
    .insert({
      company_id: admin.company_id,
      type: input.type,
      product_ids: input.rules?.productIds ?? [],
      category_ids: input.rules?.categoryIds ?? [],
      vendor_id: vendorId,
      min_order_value: input.rules?.minOrderValue ?? null,
      value: input.value,
      is_featured: input.isFeatured ?? false,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      coupon_code: input.couponCode ?? null,
      max_uses: input.maxUses ?? null,
    })
    .select("*")
    .single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json(mapPromotion(data));
});

app.patch("/admin/promotions/:id", async (c) => {
  const admin = await requireAdmin(c);
  const patch = await c.req.json();
  const row: Record<string, unknown> = {};
  if ("type" in patch) row.type = patch.type;
  if (patch.rules) {
    if ("productIds" in patch.rules) row.product_ids = patch.rules.productIds ?? [];
    if ("categoryIds" in patch.rules) row.category_ids = patch.rules.categoryIds ?? [];
    if ("vendorId" in patch.rules) row.vendor_id = patch.rules.vendorId;
    if ("minOrderValue" in patch.rules) row.min_order_value = patch.rules.minOrderValue;
  }
  if ("value" in patch) row.value = patch.value;
  if ("isFeatured" in patch) row.is_featured = patch.isFeatured;
  if ("startsAt" in patch) row.starts_at = patch.startsAt;
  if ("endsAt" in patch) row.ends_at = patch.endsAt;
  if ("couponCode" in patch) row.coupon_code = patch.couponCode;
  if ("maxUses" in patch) row.max_uses = patch.maxUses;
  if ("currentUses" in patch) row.current_uses = patch.currentUses;
  const { data, error } = await eco().from("promotions").update(row).eq("id", c.req.param("id")).eq("company_id", admin.company_id).select("*").single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json(mapPromotion(data));
});

// ---------- Admin: departamentos ----------

app.post("/categories", async (c) => {
  const admin = await requireAdmin(c);
  const input = await c.req.json();
  const { data, error } = await eco()
    .from("categories")
    .insert({
      company_id: admin.company_id,
      name: input.name,
      slug: input.slug,
      icon: input.icon ?? null,
      parent_category_id: input.parentCategoryId ?? null,
    })
    .select("*")
    .single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json(mapCategory(data));
});

app.patch("/categories/:id", async (c) => {
  const admin = await requireAdmin(c);
  const patch = await c.req.json();
  const row: Record<string, unknown> = {};
  if ("name" in patch) row.name = patch.name;
  if ("slug" in patch) row.slug = patch.slug;
  if ("icon" in patch) row.icon = patch.icon;
  if ("parentCategoryId" in patch) row.parent_category_id = patch.parentCategoryId;
  const { data, error } = await eco().from("categories").update(row).eq("id", c.req.param("id")).eq("company_id", admin.company_id).select("*").single();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.json(mapCategory(data));
});

app.delete("/categories/:id", async (c) => {
  const admin = await requireAdmin(c);
  const { error } = await eco().from("categories").delete().eq("id", c.req.param("id")).eq("company_id", admin.company_id);
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  return c.body(null, 204);
});

Deno.serve(app.fetch);

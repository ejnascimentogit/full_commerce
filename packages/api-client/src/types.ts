import type {
  AdminUser,
  Category,
  Customer,
  DeliveryRegion,
  DocumentType,
  Order,
  OrderStatus,
  Product,
  Promotion,
  StoreSettings,
  Vendor,
} from "@ecommerce/types";

export interface RegisterAddressInput {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductQuery {
  categoryId?: string;
  vendorId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  customerId: string;
  items: CreateOrderItemInput[];
  addressId: string;
  paymentMethod: "card" | "pix" | "boleto";
  installments?: number;
  /** Revalidado no backend (defesa em profundidade) — o desconto exibido no checkout é só uma prévia. */
  couponCode?: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  documentType: DocumentType;
  document: string;
  businessName?: string;
  phone: string;
  /** Vira o primeiro endereço (padrão) do cliente. regionId é resolvido automaticamente pelo bairro — não é escolhido no cadastro. */
  address: RegisterAddressInput;
  /** Código que o próprio cliente usa para nos identificar no sistema dele — opcional, digitado por ele no cadastro. */
  referenceCode?: string;
}

export type CreateProductInput = Omit<Product, "id">;
export type UpdateProductInput = Partial<Omit<Product, "id" | "vendorId">>;
export type CreatePromotionInput = Omit<Promotion, "id" | "currentUses">;
export type UpdatePromotionInput = Partial<Omit<Promotion, "id">>;

// Mirrors references/api-contract.md in the ecommerce skill.
// UI components depend only on this interface, never on mock/ or rest/ directly —
// that's what lets NEXT_PUBLIC_API_MODE swap implementations with zero UI changes.
export interface ApiClient {
  getRegions(params?: { includeInactive?: boolean }): Promise<DeliveryRegion[]>;
  getCategories(): Promise<Category[]>;
  getVendors(params?: { featured?: boolean; includeInactive?: boolean }): Promise<Vendor[]>;
  getProducts(params?: ProductQuery): Promise<Paginated<Product>>;
  getProduct(id: string): Promise<Product>;
  getFeaturedPromotions(): Promise<Promotion[]>;
  getBestSellingProducts(limit?: number): Promise<Product[]>;
  getStoreSettings(): Promise<StoreSettings>;
  /** null se não existe, expirou, esgotou usos, ou StoreSettings.promotionsEnabled é false. */
  getPromotionByCoupon(code: string): Promise<Promotion | null>;

  // Cliente (loja)
  register(input: RegisterInput): Promise<Customer>;
  login(email: string, password: string): Promise<Customer>;
  /** Sem verificação por e-mail no mock (não há envio real) — troca a senha direto se o e-mail existir. Backend real deve exigir um token enviado por e-mail antes de aceitar a nova senha. */
  resetPassword(email: string, newPassword: string): Promise<void>;
  logout(): Promise<void>;
  getCurrentCustomer(): Promise<Customer | null>;
  createOrder(input: CreateOrderInput): Promise<Order>;
  getOrder(id: string): Promise<Order>;
  getCustomerOrders(customerId: string): Promise<Order[]>;
  /** Só existe em mock por enquanto — no backend real isso é o painel de entregas do admin (PATCH /api/orders/:id/status). */
  advanceOrderStatus(id: string, status: OrderStatus): Promise<Order>;

  // Admin (painel) — platformAdmin enxerga tudo, vendorAdmin só o próprio vendorId
  /** Autocadastro do dono da loja como platformAdmin — separado das contas demo do seed. */
  registerAdmin(input: { name: string; email: string; password: string }): Promise<AdminUser>;
  adminLogin(email: string, password: string): Promise<AdminUser>;
  /** Mesma ressalva de resetPassword: sem verificação por e-mail no mock. */
  resetAdminPassword(email: string, newPassword: string): Promise<void>;
  adminLogout(): Promise<void>;
  getCurrentAdminUser(): Promise<AdminUser | null>;
  createProduct(input: CreateProductInput): Promise<Product>;
  updateProduct(id: string, patch: UpdateProductInput): Promise<Product>;
  /** Mock: resize/encode do lado do cliente. Real: POST /api/products/:id/photos (multipart) — precisa do produto já existir. */
  uploadProductPhoto(productId: string | null, file: File): Promise<string>;
  getAdminOrders(params?: { status?: OrderStatus; vendorId?: string }): Promise<Order[]>;
  createVendor(input: Omit<Vendor, "id">): Promise<Vendor>;
  updateVendor(id: string, patch: Partial<Omit<Vendor, "id">>): Promise<Vendor>;
  /** Roteirização: cria/edita uma zona de entrega e os bairros que ela cobre. */
  createRegion(input: Omit<DeliveryRegion, "id">): Promise<DeliveryRegion>;
  updateRegion(id: string, patch: Partial<Omit<DeliveryRegion, "id">>): Promise<DeliveryRegion>;
  /** Cor de marca, logo, carrossel de banners da home. */
  updateStoreSettings(patch: Partial<StoreSettings>): Promise<StoreSettings>;
  /** Mock: mesmo resize/encode do upload de foto de produto. Real: POST /api/settings/logo (multipart). */
  uploadLogo(file: File): Promise<string>;
  /** platformAdmin: todas · vendorAdmin: só as com rules.vendorId === o próprio. */
  getAdminPromotions(params?: { vendorId?: string }): Promise<Promotion[]>;
  createPromotion(input: CreatePromotionInput): Promise<Promotion>;
  updatePromotion(id: string, patch: UpdatePromotionInput): Promise<Promotion>;
  /** Departamentos — só platformAdmin, é estrutura global do catálogo. */
  createCategory(input: Omit<Category, "id">): Promise<Category>;
  updateCategory(id: string, patch: Partial<Omit<Category, "id">>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
}

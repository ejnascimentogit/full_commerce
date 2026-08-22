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
}

export type CreateProductInput = Omit<Product, "id">;
export type UpdateProductInput = Partial<Omit<Product, "id" | "vendorId">>;

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

  // Cliente (loja)
  register(input: RegisterInput): Promise<Customer>;
  login(email: string, password: string): Promise<Customer>;
  logout(): Promise<void>;
  getCurrentCustomer(): Promise<Customer | null>;
  createOrder(input: CreateOrderInput): Promise<Order>;
  getOrder(id: string): Promise<Order>;
  getCustomerOrders(customerId: string): Promise<Order[]>;
  /** Só existe em mock por enquanto — no backend real isso é o painel de entregas do admin (PATCH /api/orders/:id/status). */
  advanceOrderStatus(id: string, status: OrderStatus): Promise<Order>;

  // Admin (painel) — platformAdmin enxerga tudo, vendorAdmin só o próprio vendorId
  adminLogin(email: string, password: string): Promise<AdminUser>;
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
}

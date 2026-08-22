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
  Vendor,
} from "@ecommerce/types";

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
  regionId: string;
}

export type CreateProductInput = Omit<Product, "id">;
export type UpdateProductInput = Partial<Omit<Product, "id" | "vendorId">>;

// Mirrors references/api-contract.md in the ecommerce skill.
// UI components depend only on this interface, never on mock/ or rest/ directly —
// that's what lets NEXT_PUBLIC_API_MODE swap implementations with zero UI changes.
export interface ApiClient {
  getRegions(): Promise<DeliveryRegion[]>;
  getCategories(): Promise<Category[]>;
  getVendors(params?: { featured?: boolean }): Promise<Vendor[]>;
  getProducts(params?: ProductQuery): Promise<Paginated<Product>>;
  getProduct(id: string): Promise<Product>;
  getFeaturedPromotions(): Promise<Promotion[]>;

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
}

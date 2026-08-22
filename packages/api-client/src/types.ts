import type { Category, Customer, DeliveryRegion, Order, OrderStatus, Product, Promotion, Vendor } from "@ecommerce/types";

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
  getCurrentCustomer(): Promise<Customer>;
  createOrder(input: CreateOrderInput): Promise<Order>;
  getOrder(id: string): Promise<Order>;
  getCustomerOrders(customerId: string): Promise<Order[]>;
  /** Só existe em mock por enquanto — no backend real isso é o painel de entregas do admin (PATCH /api/orders/:id/status). */
  advanceOrderStatus(id: string, status: OrderStatus): Promise<Order>;
}

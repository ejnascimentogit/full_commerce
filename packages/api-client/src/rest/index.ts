import type { AdminUser, Category, Customer, DeliveryRegion, Order, OrderStatus, Product, Promotion, StoreSettings, Vendor } from "@ecommerce/types";
import type {
  ApiClient,
  CreateOrderInput,
  CreatePromotionInput,
  CreateProductInput,
  Paginated,
  ProductQuery,
  RegisterInput,
  UpdatePromotionInput,
  UpdateProductInput,
} from "../types";

// Implements the same ApiClient interface as mock/, calling the endpoints
// documented in the ecommerce skill's references/api-contract.md.
// Swap in via NEXT_PUBLIC_API_MODE=rest — no UI code needs to change.
function createRestApiClient(baseUrl: string): ApiClient {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (res.status === 401) return null as T;
    if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  return {
    getRegions: (params) => request<DeliveryRegion[]>(`/api/regions${params?.includeInactive ? "?includeInactive=true" : ""}`),
    getCategories: () => request<Category[]>("/api/categories"),
    getVendors: (params) => {
      const qs = new URLSearchParams();
      if (params?.featured) qs.set("featured", "true");
      if (params?.includeInactive) qs.set("includeInactive", "true");
      const query = qs.toString();
      return request<Vendor[]>(`/api/vendors${query ? `?${query}` : ""}`);
    },
    getProducts: (params: ProductQuery = {}) => {
      const qs = new URLSearchParams();
      if (params.categoryId) qs.set("categoryId", params.categoryId);
      if (params.vendorId) qs.set("vendorId", params.vendorId);
      if (params.q) qs.set("q", params.q);
      if (params.page) qs.set("page", String(params.page));
      if (params.pageSize) qs.set("pageSize", String(params.pageSize));
      const query = qs.toString();
      return request<Paginated<Product>>(`/api/products${query ? `?${query}` : ""}`);
    },
    getProduct: (id: string) => request<Product>(`/api/products/${id}`),
    getFeaturedPromotions: () => request<Promotion[]>("/api/promotions/active?featured=true"),
    getBestSellingProducts: (limit = 12) => request<Product[]>(`/api/products/best-sellers?limit=${limit}`),
    getStoreSettings: () => request<StoreSettings>("/api/settings"),
    getPromotionByCoupon: (code: string) => request<Promotion | null>(`/api/promotions/coupon/${encodeURIComponent(code)}`),

    register: (input: RegisterInput) => request<Customer>("/api/auth/register", { method: "POST", body: JSON.stringify(input) }),
    login: (email: string, password: string) =>
      request<Customer>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    resetPassword: (email: string, newPassword: string) =>
      request<void>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ email, newPassword }) }),
    logout: () => request<void>("/api/auth/logout", { method: "POST" }),
    getCurrentCustomer: () => request<Customer | null>("/api/customers/me"),
    createOrder: (input: CreateOrderInput) => request<Order>("/api/orders", { method: "POST", body: JSON.stringify(input) }),
    getOrder: (id: string) => request<Order>(`/api/orders/${id}`),
    getCustomerOrders: () => request<Order[]>("/api/orders"),
    advanceOrderStatus: (id: string, status: OrderStatus) =>
      request<Order>(`/api/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

    registerAdmin: (input: { name: string; email: string; password: string }) =>
      request<AdminUser>("/api/admin/auth/register", { method: "POST", body: JSON.stringify(input) }),
    adminLogin: (email: string, password: string) =>
      request<AdminUser>("/api/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    resetAdminPassword: (email: string, newPassword: string) =>
      request<void>("/api/admin/auth/reset-password", { method: "POST", body: JSON.stringify({ email, newPassword }) }),
    adminLogout: () => request<void>("/api/admin/auth/logout", { method: "POST" }),
    getCurrentAdminUser: () => request<AdminUser | null>("/api/admin/auth/me"),
    createProduct: (input: CreateProductInput) => request<Product>("/api/products", { method: "POST", body: JSON.stringify(input) }),
    updateProduct: (id: string, patch: UpdateProductInput) =>
      request<Product>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    uploadProductPhoto: async (productId: string | null, file: File) => {
      if (!productId) throw new Error("Salve o produto antes de enviar fotos.");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${baseUrl}/api/products/${productId}/photos`, { method: "POST", body: form, credentials: "include" });
      if (!res.ok) throw new Error(`API error ${res.status} on /api/products/${productId}/photos`);
      const data = (await res.json()) as { url: string };
      return data.url;
    },
    getAdminOrders: (params) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.vendorId) qs.set("vendorId", params.vendorId);
      const query = qs.toString();
      return request<Order[]>(`/api/admin/orders${query ? `?${query}` : ""}`);
    },
    createVendor: (input: Omit<Vendor, "id">) => request<Vendor>("/api/vendors", { method: "POST", body: JSON.stringify(input) }),
    updateVendor: (id: string, patch: Partial<Omit<Vendor, "id">>) =>
      request<Vendor>(`/api/vendors/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    createRegion: (input: Omit<DeliveryRegion, "id">) => request<DeliveryRegion>("/api/regions", { method: "POST", body: JSON.stringify(input) }),
    updateRegion: (id: string, patch: Partial<Omit<DeliveryRegion, "id">>) =>
      request<DeliveryRegion>(`/api/regions/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    updateStoreSettings: (patch: Partial<StoreSettings>) =>
      request<StoreSettings>("/api/settings", { method: "PATCH", body: JSON.stringify(patch) }),
    uploadLogo: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${baseUrl}/api/settings/logo`, { method: "POST", body: form, credentials: "include" });
      if (!res.ok) throw new Error(`API error ${res.status} on /api/settings/logo`);
      const data = (await res.json()) as { url: string };
      return data.url;
    },
    getAdminPromotions: (params) =>
      request<Promotion[]>(`/api/admin/promotions${params?.vendorId ? `?vendorId=${params.vendorId}` : ""}`),
    createPromotion: (input: CreatePromotionInput) =>
      request<Promotion>("/api/admin/promotions", { method: "POST", body: JSON.stringify(input) }),
    updatePromotion: (id: string, patch: UpdatePromotionInput) =>
      request<Promotion>(`/api/admin/promotions/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    createCategory: (input: Omit<Category, "id">) => request<Category>("/api/categories", { method: "POST", body: JSON.stringify(input) }),
    updateCategory: (id: string, patch: Partial<Omit<Category, "id">>) =>
      request<Category>(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    deleteCategory: (id: string) => request<void>(`/api/categories/${id}`, { method: "DELETE" }),
  };
}

export { createRestApiClient };

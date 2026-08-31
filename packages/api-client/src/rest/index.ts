import type {
  Activity,
  ActivityClient,
  ActivityOutcome,
  Address,
  AdminUser,
  Category,
  Company,
  Customer,
  DeliveryRegion,
  EcommerceType,
  Order,
  OrderStatus,
  Product,
  Promotion,
  StaffSector,
  StoreSettings,
  Vendor,
} from "@ecommerce/types";
import type {
  ApiClient,
  CreateOrderInput,
  CreatePromotionInput,
  CreateProductInput,
  CreateTeamMemberInput,
  Paginated,
  ProductQuery,
  RegisterInput,
  UpdatePromotionInput,
  UpdateProductInput,
  UpdateTeamMemberInput,
} from "../types";

const CUSTOMER_TOKEN_KEY = "ecommerce.rest.customerToken";
const ADMIN_TOKEN_KEY = "ecommerce.rest.adminToken";

// Implementa a mesma interface ApiClient do mock/, chamando o backend real
// (Supabase Edge Function) documentado em references/api-contract.md.
// Autenticação por token: login/registro retornam {token, ...}; guardamos esse
// token em localStorage e mandamos "Authorization: Bearer <token>" nas chamadas
// autenticadas — não usamos cookies porque loja/admin/função ficam em domínios
// diferentes (cross-site cookies exigiriam SameSite=None e trariam mais atrito).
function createRestApiClient(baseUrl: string): ApiClient {
  function getToken(key: string): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(key);
  }
  function setToken(key: string, token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, token);
  }
  function clearToken(key: string): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
  }

  async function request<T>(path: string, init?: RequestInit & { tokenKey?: string }): Promise<T> {
    const { tokenKey, ...rest } = init ?? {};
    const token = tokenKey ? getToken(tokenKey) : null;
    const res = await fetch(`${baseUrl}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...rest.headers,
      },
    });
    if (res.status === 401) return null as T;
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error?.code ?? `API error ${res.status} on ${path}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  async function upload<T>(path: string, file: File, tokenKey: string): Promise<T> {
    const form = new FormData();
    form.append("file", file);
    const token = getToken(tokenKey);
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error?.code ?? `API error ${res.status} on ${path}`);
    }
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

    register: async (input: RegisterInput) => {
      const { token, customer } = await request<{ token: string; customer: Customer }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setToken(CUSTOMER_TOKEN_KEY, token);
      return customer;
    },
    login: async (email: string, password: string) => {
      const result = await request<{ token: string; customer: Customer } | null>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!result) throw new Error("INVALID_CREDENTIALS");
      setToken(CUSTOMER_TOKEN_KEY, result.token);
      return result.customer;
    },
    resetPassword: (email: string) =>
      request<void>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
    logout: async () => {
      await request<void>("/api/auth/logout", { method: "POST", tokenKey: CUSTOMER_TOKEN_KEY });
      clearToken(CUSTOMER_TOKEN_KEY);
    },
    getCurrentCustomer: () => request<Customer | null>("/api/customers/me", { tokenKey: CUSTOMER_TOKEN_KEY }),
    createOrder: (input: CreateOrderInput) =>
      request<Order>("/api/orders", { method: "POST", body: JSON.stringify(input), tokenKey: CUSTOMER_TOKEN_KEY }),
    getOrder: (id: string) => request<Order>(`/api/orders/${id}`, { tokenKey: CUSTOMER_TOKEN_KEY }),
    getCustomerOrders: () => request<Order[]>("/api/orders", { tokenKey: CUSTOMER_TOKEN_KEY }),
    advanceOrderStatus: (id: string, status: OrderStatus) =>
      request<Order>(`/api/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }), tokenKey: ADMIN_TOKEN_KEY }),
    updateOrderItems: (id: string, adjustments: { productId: string; finalQuantity: number }[]) =>
      request<Order>(`/api/admin/orders/${id}/items`, { method: "PATCH", body: JSON.stringify({ items: adjustments }), tokenKey: ADMIN_TOKEN_KEY }),

    registerAdmin: async (input: { name: string; email: string; password: string }) => {
      const { token, adminUser } = await request<{ token: string; adminUser: AdminUser }>("/api/admin/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setToken(ADMIN_TOKEN_KEY, token);
      return adminUser;
    },
    adminLogin: async (email: string, password: string) => {
      const result = await request<{ token: string; adminUser: AdminUser } | null>("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!result) throw new Error("INVALID_CREDENTIALS");
      setToken(ADMIN_TOKEN_KEY, result.token);
      return result.adminUser;
    },
    resetAdminPassword: (email: string) =>
      request<void>("/api/admin/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
    adminLogout: async () => {
      await request<void>("/api/admin/auth/logout", { method: "POST", tokenKey: ADMIN_TOKEN_KEY });
      clearToken(ADMIN_TOKEN_KEY);
    },
    getCurrentAdminUser: () => request<AdminUser | null>("/api/admin/auth/me", { tokenKey: ADMIN_TOKEN_KEY }),
    createProduct: (input: CreateProductInput) =>
      request<Product>("/api/products", { method: "POST", body: JSON.stringify(input), tokenKey: ADMIN_TOKEN_KEY }),
    getAdminProducts: () => request<Product[]>("/api/admin/products", { tokenKey: ADMIN_TOKEN_KEY }),
    getAdminProduct: (id) => request<Product>(`/api/admin/products/${id}`, { tokenKey: ADMIN_TOKEN_KEY }),
    updateProduct: (id: string, patch: UpdateProductInput) =>
      request<Product>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(patch), tokenKey: ADMIN_TOKEN_KEY }),
    uploadProductPhoto: async (productId: string | null, file: File) => {
      if (!productId) throw new Error("Salve o produto antes de enviar fotos.");
      const data = await upload<{ url: string }>(`/api/products/${productId}/photos`, file, ADMIN_TOKEN_KEY);
      return data.url;
    },
    getAdminOrders: (params) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.vendorId) qs.set("vendorId", params.vendorId);
      const query = qs.toString();
      return request<Order[]>(`/api/admin/orders${query ? `?${query}` : ""}`, { tokenKey: ADMIN_TOKEN_KEY });
    },
    getAdminOrder: (id) => {
      return request<Order>(`/api/admin/orders/${id}`, { tokenKey: ADMIN_TOKEN_KEY });
    },
    getAdminCustomers: () => request<Customer[]>("/api/admin/customers", { tokenKey: ADMIN_TOKEN_KEY }),
    updateCustomer: (id, patch) =>
      request<Customer>(`/api/admin/customers/${id}`, { method: "PATCH", body: JSON.stringify(patch), tokenKey: ADMIN_TOKEN_KEY }),
    createCustomerAddress: (customerId: string, input: Omit<Address, "id">) =>
      request<Address>(`/api/admin/customers/${customerId}/addresses`, { method: "POST", body: JSON.stringify(input), tokenKey: ADMIN_TOKEN_KEY }),
    updateCustomerAddress: (addressId: string, patch: Partial<Omit<Address, "id">>) =>
      request<Address>(`/api/admin/addresses/${addressId}`, { method: "PATCH", body: JSON.stringify(patch), tokenKey: ADMIN_TOKEN_KEY }),
    createVendor: (input: Omit<Vendor, "id">) =>
      request<Vendor>("/api/vendors", { method: "POST", body: JSON.stringify(input), tokenKey: ADMIN_TOKEN_KEY }),
    updateVendor: (id: string, patch: Partial<Omit<Vendor, "id">>) =>
      request<Vendor>(`/api/vendors/${id}`, { method: "PATCH", body: JSON.stringify(patch), tokenKey: ADMIN_TOKEN_KEY }),
    createRegion: (input: Omit<DeliveryRegion, "id">) =>
      request<DeliveryRegion>("/api/regions", { method: "POST", body: JSON.stringify(input), tokenKey: ADMIN_TOKEN_KEY }),
    updateRegion: (id: string, patch: Partial<Omit<DeliveryRegion, "id">>) =>
      request<DeliveryRegion>(`/api/regions/${id}`, { method: "PATCH", body: JSON.stringify(patch), tokenKey: ADMIN_TOKEN_KEY }),
    updateStoreSettings: (patch: Partial<StoreSettings>) =>
      request<StoreSettings>("/api/settings", { method: "PATCH", body: JSON.stringify(patch), tokenKey: ADMIN_TOKEN_KEY }),
    getCompanies: () => request<Company[]>("/api/admin/companies", { tokenKey: ADMIN_TOKEN_KEY }),
    createCompany: (input: { name: string; slug: string; ecommerceType?: EcommerceType }) =>
      request<Company>("/api/admin/companies", { method: "POST", body: JSON.stringify(input), tokenKey: ADMIN_TOKEN_KEY }),
    updateCompany: (id: string, patch: { name?: string; domain?: string; adminDomain?: string; active?: boolean }) =>
      request<Company>(`/api/admin/companies/${id}`, { method: "PATCH", body: JSON.stringify(patch), tokenKey: ADMIN_TOKEN_KEY }),
    getTeamMembers: () => request<AdminUser[]>("/api/admin/team-members", { tokenKey: ADMIN_TOKEN_KEY }),
    createTeamMember: (input: CreateTeamMemberInput) =>
      request<AdminUser>("/api/admin/team-members", { method: "POST", body: JSON.stringify(input), tokenKey: ADMIN_TOKEN_KEY }),
    updateTeamMember: (id: string, patch: UpdateTeamMemberInput) =>
      request<AdminUser>(`/api/admin/team-members/${id}`, { method: "PATCH", body: JSON.stringify(patch), tokenKey: ADMIN_TOKEN_KEY }),
    getStaffSectors: () => request<StaffSector[]>("/api/admin/staff-sectors", { tokenKey: ADMIN_TOKEN_KEY }),
    createStaffSector: (name: string) =>
      request<StaffSector>("/api/admin/staff-sectors", { method: "POST", body: JSON.stringify({ name }), tokenKey: ADMIN_TOKEN_KEY }),
    deleteStaffSector: (id: string) =>
      request<void>(`/api/admin/staff-sectors/${id}`, { method: "DELETE", tokenKey: ADMIN_TOKEN_KEY }),

    getActivityClients: () => request<ActivityClient[]>("/api/admin/activity-clients", { tokenKey: ADMIN_TOKEN_KEY }),
    createActivityClient: (input) =>
      request<ActivityClient>("/api/admin/activity-clients", { method: "POST", body: JSON.stringify(input), tokenKey: ADMIN_TOKEN_KEY }),
    updateActivityClient: (id, patch) =>
      request<ActivityClient>(`/api/admin/activity-clients/${id}`, { method: "PATCH", body: JSON.stringify(patch), tokenKey: ADMIN_TOKEN_KEY }),

    getActivityOutcomes: () => request<ActivityOutcome[]>("/api/admin/activity-outcomes", { tokenKey: ADMIN_TOKEN_KEY }),
    createActivityOutcome: (name: string) =>
      request<ActivityOutcome>("/api/admin/activity-outcomes", { method: "POST", body: JSON.stringify({ name }), tokenKey: ADMIN_TOKEN_KEY }),
    updateActivityOutcome: (id, patch) =>
      request<ActivityOutcome>(`/api/admin/activity-outcomes/${id}`, { method: "PATCH", body: JSON.stringify(patch), tokenKey: ADMIN_TOKEN_KEY }),

    getActivities: (params) => {
      const qs = new URLSearchParams();
      if (params?.column) qs.set("column", params.column);
      if (params?.assignedToAdminId) qs.set("assignedToAdminId", params.assignedToAdminId);
      if (params?.clientId) qs.set("clientId", params.clientId);
      if (params?.cardNumber) qs.set("cardNumber", String(params.cardNumber));
      const query = qs.toString();
      return request<Activity[]>(`/api/admin/activities${query ? `?${query}` : ""}`, { tokenKey: ADMIN_TOKEN_KEY });
    },
    createActivity: (input) =>
      request<Activity>("/api/admin/activities", { method: "POST", body: JSON.stringify(input), tokenKey: ADMIN_TOKEN_KEY }),
    updateActivity: (id, patch) =>
      request<Activity>(`/api/admin/activities/${id}`, { method: "PATCH", body: JSON.stringify(patch), tokenKey: ADMIN_TOKEN_KEY }),
    uploadActivityImage: async (file: File) => {
      const data = await upload<{ url: string }>("/api/admin/activities/photos", file, ADMIN_TOKEN_KEY);
      return data.url;
    },
    uploadLogo: async (file: File) => {
      const data = await upload<{ url: string }>("/api/settings/logo", file, ADMIN_TOKEN_KEY);
      return data.url;
    },
    getAdminPromotions: (params) =>
      request<Promotion[]>(`/api/admin/promotions${params?.vendorId ? `?vendorId=${params.vendorId}` : ""}`, { tokenKey: ADMIN_TOKEN_KEY }),
    createPromotion: (input: CreatePromotionInput) =>
      request<Promotion>("/api/admin/promotions", { method: "POST", body: JSON.stringify(input), tokenKey: ADMIN_TOKEN_KEY }),
    updatePromotion: (id: string, patch: UpdatePromotionInput) =>
      request<Promotion>(`/api/admin/promotions/${id}`, { method: "PATCH", body: JSON.stringify(patch), tokenKey: ADMIN_TOKEN_KEY }),
    createCategory: (input: Omit<Category, "id">) =>
      request<Category>("/api/categories", { method: "POST", body: JSON.stringify(input), tokenKey: ADMIN_TOKEN_KEY }),
    updateCategory: (id: string, patch: Partial<Omit<Category, "id">>) =>
      request<Category>(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(patch), tokenKey: ADMIN_TOKEN_KEY }),
    deleteCategory: (id: string) => request<void>(`/api/categories/${id}`, { method: "DELETE", tokenKey: ADMIN_TOKEN_KEY }),
  };
}

export { createRestApiClient };

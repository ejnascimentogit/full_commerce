import type { Category, DeliveryRegion, Product, Promotion, Vendor } from "@ecommerce/types";
import type { ApiClient, Paginated, ProductQuery } from "../types";

// Implements the same ApiClient interface as mock/, calling the endpoints
// documented in the ecommerce skill's references/api-contract.md.
// Swap in via NEXT_PUBLIC_API_MODE=rest — no UI code needs to change.
function createRestApiClient(baseUrl: string): ApiClient {
  async function request<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`);
    if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
    return res.json() as Promise<T>;
  }

  return {
    getRegions: () => request<DeliveryRegion[]>("/api/regions"),
    getCategories: () => request<Category[]>("/api/categories"),
    getVendors: (params) => request<Vendor[]>(`/api/vendors${params?.featured ? "?featured=true" : ""}`),
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
  };
}

export { createRestApiClient };

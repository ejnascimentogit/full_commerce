import type { ApiClient, Paginated, ProductQuery } from "../types";
import type { Category, DeliveryRegion, Product, Promotion, Vendor } from "@ecommerce/types";
import { categories, products, promotions, regions, vendors } from "./data";

const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockApiClient: ApiClient = {
  async getRegions(): Promise<DeliveryRegion[]> {
    await delay();
    return regions.filter((r) => r.active);
  },

  async getCategories(): Promise<Category[]> {
    await delay();
    return categories;
  },

  async getVendors(params): Promise<Vendor[]> {
    await delay();
    return vendors.filter((v) => v.active && (params?.featured ? v.isFeatured : true));
  },

  async getProducts(params: ProductQuery = {}): Promise<Paginated<Product>> {
    await delay();
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 24;
    const filtered = products.filter((p) => {
      if (params.categoryId && p.categoryId !== params.categoryId) return false;
      if (params.vendorId && p.vendorId !== params.vendorId) return false;
      if (params.q && !p.name.toLowerCase().includes(params.q.toLowerCase())) return false;
      return true;
    });
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  },

  async getProduct(id: string): Promise<Product> {
    await delay();
    const product = products.find((p) => p.id === id);
    if (!product) throw new Error(`Product not found: ${id}`);
    return product;
  },

  async getFeaturedPromotions(): Promise<Promotion[]> {
    await delay();
    return promotions.filter((p) => p.isFeatured);
  },
};

export { packageLabels } from "./data";

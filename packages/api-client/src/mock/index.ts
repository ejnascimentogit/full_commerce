import type { ApiClient, CreateOrderInput, Paginated, ProductQuery } from "../types";
import type { Category, Customer, DeliveryRegion, Order, OrderStatus, Product, Promotion, Vendor } from "@ecommerce/types";
import { categories, mockCustomer, products, promotions, regions, vendors } from "./data";
import { advanceOrderStatus, findOrderById, findOrdersByCustomer, nextOrderNumber, saveOrder } from "./orders-store";
import { buildOrderItem, calculateOrderTotals } from "../domain";

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

  async getCurrentCustomer(): Promise<Customer> {
    await delay();
    return mockCustomer;
  },

  async createOrder(input: CreateOrderInput): Promise<Order> {
    await delay(400);
    const customer = mockCustomer;
    const address = customer.addresses.find((a) => a.id === input.addressId) ?? customer.addresses[0];
    if (!address) throw new Error("Cliente não tem endereço cadastrado");

    const items = input.items.map(({ productId, quantity }) => {
      const product = products.find((p) => p.id === productId);
      if (!product) throw new Error(`Product not found: ${productId}`);
      return buildOrderItem(product, quantity);
    });

    const totals = calculateOrderTotals(items, customer);
    const now = new Date().toISOString();

    const order: Order = {
      id: `order-${Date.now()}`,
      orderNumber: nextOrderNumber(),
      customerId: customer.id,
      items,
      shippingAddress: address,
      regionId: customer.regionId,
      paymentMethod: input.paymentMethod,
      ...totals,
      status: "PAID",
      statusHistory: [
        { status: "PENDING", changedAt: now },
        { status: "PAID", changedAt: now },
      ],
      createdAt: now,
    };

    return saveOrder(order);
  },

  async getOrder(id: string): Promise<Order> {
    await delay();
    const order = findOrderById(id);
    if (!order) throw new Error(`Order not found: ${id}`);
    return order;
  },

  async getCustomerOrders(customerId: string): Promise<Order[]> {
    await delay();
    return findOrdersByCustomer(customerId);
  },

  async advanceOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    await delay(300);
    const order = advanceOrderStatus(id, status);
    if (!order) throw new Error(`Order not found: ${id}`);
    return order;
  },
};

export { packageLabels } from "./data";

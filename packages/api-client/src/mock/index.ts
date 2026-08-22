import type {
  ApiClient,
  CreateOrderInput,
  CreateProductInput,
  Paginated,
  ProductQuery,
  RegisterInput,
  UpdateProductInput,
} from "../types";
import type { AdminUser, Category, Customer, DeliveryRegion, Order, OrderStatus, Product, Promotion, Vendor } from "@ecommerce/types";
import { categories, promotions } from "./data";
import { createRegion as createRegionStore, listRegions, updateRegion as updateRegionStore } from "./regions-store";
import {
  advanceOrderStatus as advanceOrderStatusStore,
  findAllOrders,
  findOrderById,
  findOrdersByCustomer,
  nextOrderNumber,
  saveOrder,
} from "./orders-store";
import { buildOrderItem, calculateOrderTotals, matchRegionByNeighborhood } from "../domain";
import { isValidDocument } from "../documents";
import { createCustomer, findById as findCustomerById, verifyPassword } from "./customers-store";
import { clearSession, getSessionCustomerId, setSessionCustomerId } from "./session";
import { clearAdminSession, findAdminUserById, getAdminSessionUserId, setAdminSessionUserId, verifyAdminPassword } from "./admin-store";
import { createProduct as createProductStore, findProductById, listProducts, updateProduct as updateProductStore } from "./products-store";
import { resizeImageToDataUrl } from "./image";
import { createVendor as createVendorStore, listVendors, updateVendor as updateVendorStore } from "./vendors-store";

const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockApiClient: ApiClient = {
  async getRegions(params): Promise<DeliveryRegion[]> {
    await delay();
    return listRegions().filter((r) => params?.includeInactive || r.active);
  },

  async getCategories(): Promise<Category[]> {
    await delay();
    return categories;
  },

  async getVendors(params): Promise<Vendor[]> {
    await delay();
    return listVendors().filter((v) => (params?.includeInactive || v.active) && (params?.featured ? v.isFeatured : true));
  },

  async getProducts(params: ProductQuery = {}): Promise<Paginated<Product>> {
    await delay();
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 24;
    const filtered = listProducts().filter((p) => {
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
    const product = findProductById(id);
    if (!product) throw new Error(`Product not found: ${id}`);
    return product;
  },

  async getFeaturedPromotions(): Promise<Promotion[]> {
    await delay();
    return promotions.filter((p) => p.isFeatured);
  },

  async register(input: RegisterInput): Promise<Customer> {
    await delay(300);
    if (!isValidDocument(input.documentType, input.document)) throw new Error("INVALID_DOCUMENT");
    // Roteirização: a região não vem do formulário — é resolvida pelo bairro do endereço.
    const region = matchRegionByNeighborhood(listRegions(), input.address.neighborhood);
    const customer = createCustomer({ ...input, regionId: region?.id });
    setSessionCustomerId(customer.id);
    return customer;
  },

  async login(email: string, password: string): Promise<Customer> {
    await delay(300);
    const customer = verifyPassword(email, password);
    if (!customer) throw new Error("INVALID_CREDENTIALS");
    setSessionCustomerId(customer.id);
    return customer;
  },

  async logout(): Promise<void> {
    clearSession();
  },

  async getCurrentCustomer(): Promise<Customer | null> {
    await delay();
    const id = getSessionCustomerId();
    if (!id) return null;
    return findCustomerById(id) ?? null;
  },

  async createOrder(input: CreateOrderInput): Promise<Order> {
    await delay(400);
    const customer = findCustomerById(input.customerId);
    if (!customer) throw new Error("Cliente não autenticado");
    const address = customer.addresses.find((a) => a.id === input.addressId) ?? customer.addresses[0];
    if (!address) throw new Error("Cliente não tem endereço cadastrado");

    const items = input.items.map(({ productId, quantity }) => {
      const product = findProductById(productId);
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
    const order = advanceOrderStatusStore(id, status);
    if (!order) throw new Error(`Order not found: ${id}`);
    return order;
  },

  async adminLogin(email: string, password: string): Promise<AdminUser> {
    await delay(300);
    const user = verifyAdminPassword(email, password);
    if (!user) throw new Error("INVALID_CREDENTIALS");
    setAdminSessionUserId(user.id);
    return user;
  },

  async adminLogout(): Promise<void> {
    clearAdminSession();
  },

  async getCurrentAdminUser(): Promise<AdminUser | null> {
    await delay();
    const id = getAdminSessionUserId();
    if (!id) return null;
    return findAdminUserById(id) ?? null;
  },

  async createProduct(input: CreateProductInput): Promise<Product> {
    await delay(300);
    return createProductStore(input);
  },

  async updateProduct(id: string, patch: UpdateProductInput): Promise<Product> {
    await delay(300);
    return updateProductStore(id, patch);
  },

  async uploadProductPhoto(_productId: string | null, file: File): Promise<string> {
    await delay(400);
    return resizeImageToDataUrl(file);
  },

  async getAdminOrders(params): Promise<Order[]> {
    await delay();
    return findAllOrders(params);
  },

  async createVendor(input: Omit<Vendor, "id">): Promise<Vendor> {
    await delay(300);
    return createVendorStore(input);
  },

  async updateVendor(id: string, patch: Partial<Omit<Vendor, "id">>): Promise<Vendor> {
    await delay(300);
    return updateVendorStore(id, patch);
  },

  async createRegion(input: Omit<DeliveryRegion, "id">): Promise<DeliveryRegion> {
    await delay(300);
    return createRegionStore(input);
  },

  async updateRegion(id: string, patch: Partial<Omit<DeliveryRegion, "id">>): Promise<DeliveryRegion> {
    await delay(300);
    return updateRegionStore(id, patch);
  },
};

export { packageLabels } from "./data";

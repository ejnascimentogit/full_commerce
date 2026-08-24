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
import type { AdminUser, Category, Customer, DeliveryRegion, Order, OrderStatus, Product, Promotion, StoreSettings, Vendor } from "@ecommerce/types";
import {
  createCategory as createCategoryStore,
  deleteCategory as deleteCategoryStore,
  listCategories,
  updateCategory as updateCategoryStore,
} from "./categories-store";
import { createRegion as createRegionStore, listRegions, updateRegion as updateRegionStore } from "./regions-store";
import { getSettings, updateSettings } from "./settings-store";
import { createPromotion as createPromotionStore, listPromotions, updatePromotion as updatePromotionStore } from "./promotions-store";
import {
  advanceOrderStatus as advanceOrderStatusStore,
  findAllOrders,
  findOrderById,
  findOrdersByCustomer,
  nextOrderNumber,
  saveOrder,
} from "./orders-store";
import {
  buildOrderItem,
  calculateOrderTotals,
  calculatePromotionDiscount,
  calculateShipping,
  findPromotionByCoupon,
  getBestSellingProducts,
  isPromotionActive,
  matchRegionByNeighborhood,
} from "../domain";
import { isValidDocument } from "../documents";
import {
  createCustomer,
  findById as findCustomerById,
  listAll as listCustomers,
  resetPassword as resetPasswordStore,
  updateCustomer as updateCustomerStore,
  verifyPassword,
} from "./customers-store";
import { clearSession, getSessionCustomerId, setSessionCustomerId } from "./session";
import {
  clearAdminSession,
  createAdminUser,
  findAdminUserById,
  getAdminSessionUserId,
  resetAdminPassword as resetAdminPasswordStore,
  setAdminSessionUserId,
  verifyAdminPassword,
} from "./admin-store";
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
    return listCategories();
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
      if (params.q) {
        const q = params.q.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      }
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
    return listPromotions().filter((p) => p.isFeatured && isPromotionActive(p));
  },

  async getBestSellingProducts(limit = 12): Promise<Product[]> {
    await delay();
    return getBestSellingProducts(findAllOrders(), listProducts(), limit);
  },

  async getStoreSettings(): Promise<StoreSettings> {
    await delay();
    return getSettings();
  },

  async getPromotionByCoupon(code: string): Promise<Promotion | null> {
    await delay();
    if (!getSettings().promotionsEnabled) return null;
    return findPromotionByCoupon(listPromotions(), code) ?? null;
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

  async resetPassword(email: string, newPassword: string): Promise<void> {
    await delay(300);
    if (!resetPasswordStore(email, newPassword)) throw new Error("EMAIL_NOT_FOUND");
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

    const products = input.items.map(({ productId, quantity }) => {
      const product = findProductById(productId);
      if (!product) throw new Error(`Product not found: ${productId}`);
      return { product, quantity };
    });
    const items = products.map(({ product, quantity }) => buildOrderItem(product, quantity));
    const subtotal = items.reduce((sum, item) => sum + item.estimatedSubtotal, 0);

    const settings = getSettings();
    if (settings.minOrderValue && subtotal < settings.minOrderValue) {
      throw new Error("BELOW_MIN_ORDER_VALUE");
    }

    // Cupom: revalidado aqui mesmo que já tenha sido pré-visto no checkout — nunca
    // confia só no valor calculado no cliente.
    let discount = 0;
    let shipping = calculateShipping(customer, settings);
    let appliedPromotion: Promotion | undefined;
    if (input.couponCode && settings.promotionsEnabled) {
      const promotion = findPromotionByCoupon(listPromotions(), input.couponCode);
      if (promotion) {
        appliedPromotion = promotion;
        if (promotion.type === "freeShipping") {
          shipping = 0;
        } else {
          discount = calculatePromotionDiscount(
            promotion,
            items.map((item, i) => ({ product: products[i].product, subtotal: item.estimatedSubtotal })),
            subtotal,
          );
        }
      }
    }

    const totals = calculateOrderTotals(items, shipping, { discount });
    const now = new Date().toISOString();

    const order: Order = {
      id: `order-${Date.now()}`,
      orderNumber: nextOrderNumber(),
      customerId: customer.id,
      items,
      shippingAddress: address,
      regionId: customer.regionId,
      paymentMethod: input.paymentMethod,
      installments: input.paymentMethod === "card" ? input.installments : undefined,
      ...totals,
      status: "PAID",
      statusHistory: [
        { status: "PENDING", changedAt: now },
        { status: "PAID", changedAt: now },
      ],
      createdAt: now,
    };

    const saved = saveOrder(order);
    if (appliedPromotion) updatePromotionStore(appliedPromotion.id, { currentUses: appliedPromotion.currentUses + 1 });
    return saved;
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

  async registerAdmin(input: { name: string; email: string; password: string }): Promise<AdminUser> {
    await delay(300);
    const user = createAdminUser(input);
    setAdminSessionUserId(user.id);
    return user;
  },

  async adminLogin(email: string, password: string): Promise<AdminUser> {
    await delay(300);
    const user = verifyAdminPassword(email, password);
    if (!user) throw new Error("INVALID_CREDENTIALS");
    setAdminSessionUserId(user.id);
    return user;
  },

  async resetAdminPassword(email: string, newPassword: string): Promise<void> {
    await delay(300);
    if (!resetAdminPasswordStore(email, newPassword)) throw new Error("EMAIL_NOT_FOUND");
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

  async getAdminProducts(): Promise<Product[]> {
    await delay();
    const adminId = getAdminSessionUserId();
    const admin = adminId ? findAdminUserById(adminId) : null;
    const all = listProducts();
    return admin?.role === "vendorAdmin" ? all.filter((p) => p.vendorId === admin.vendorId) : all;
  },

  async getAdminProduct(id): Promise<Product> {
    await delay();
    const product = findProductById(id);
    if (!product) throw new Error("NOT_FOUND");
    return product;
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

  async getAdminOrder(id): Promise<Order> {
    await delay();
    const order = findOrderById(id);
    if (!order) throw new Error("NOT_FOUND");
    return order;
  },

  async getAdminCustomers(): Promise<Customer[]> {
    await delay();
    return listCustomers();
  },

  async updateCustomer(id, patch): Promise<Customer> {
    await delay(300);
    return updateCustomerStore(id, patch);
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

  async updateStoreSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
    await delay(300);
    return updateSettings(patch);
  },

  async uploadLogo(file: File): Promise<string> {
    await delay(400);
    return resizeImageToDataUrl(file, 400, 0.9);
  },

  async getAdminPromotions(params): Promise<Promotion[]> {
    await delay();
    const all = listPromotions();
    return params?.vendorId ? all.filter((p) => p.rules.vendorId === params.vendorId) : all;
  },

  async createPromotion(input: CreatePromotionInput): Promise<Promotion> {
    await delay(300);
    return createPromotionStore(input);
  },

  async updatePromotion(id: string, patch: UpdatePromotionInput): Promise<Promotion> {
    await delay(300);
    return updatePromotionStore(id, patch);
  },

  async createCategory(input: Omit<Category, "id">): Promise<Category> {
    await delay(300);
    return createCategoryStore(input);
  },

  async updateCategory(id: string, patch: Partial<Omit<Category, "id">>): Promise<Category> {
    await delay(300);
    return updateCategoryStore(id, patch);
  },

  async deleteCategory(id: string): Promise<void> {
    await delay(300);
    deleteCategoryStore(id);
  },
};

export { packageLabels } from "./data";

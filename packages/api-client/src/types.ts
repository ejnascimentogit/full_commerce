import type {
  Activity,
  ActivityClient,
  ActivityColumn,
  ActivityHealth,
  ActivityOutcome,
  Address,
  AdminPermissionKey,
  AdminUser,
  Category,
  Company,
  Customer,
  DeliveryRegion,
  DocumentType,
  EcommerceType,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  Promotion,
  StaffSector,
  StoreSettings,
  Vendor,
} from "@ecommerce/types";

export interface CreateTeamMemberInput {
  name: string;
  email: string;
  password: string;
  permissions: AdminPermissionKey[];
  department?: string;
}

export interface UpdateTeamMemberInput {
  name?: string;
  permissions?: AdminPermissionKey[];
  active?: boolean;
  department?: string;
}

export interface RegisterAddressInput {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  label?: string;
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
  paymentMethod: PaymentMethod;
  installments?: number;
  /** Revalidado no backend (defesa em profundidade) — o desconto exibido no checkout é só uma prévia. */
  couponCode?: string;
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
  /** Endereço próprio do cliente (cadastral), quando diferente do endereço de entrega. Opcional. */
  businessAddress?: RegisterAddressInput;
  /** Código que o próprio cliente usa para nos identificar no sistema dele — opcional, digitado por ele no cadastro. */
  referenceCode?: string;
}

// "sku" fora dos dois — é gerado pelo backend na criação ({número da empresa} +
// sequencial) e nunca muda depois, pra não ter risco de alguém digitar o código
// de outro produto por engano.
export type CreateProductInput = Omit<Product, "id" | "sku">;
export type UpdateProductInput = Partial<Omit<Product, "id" | "sku">>;
export type CreatePromotionInput = Omit<Promotion, "id" | "currentUses">;
export type UpdatePromotionInput = Partial<Omit<Promotion, "id">>;

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
  /** null se não existe, expirou, esgotou usos, ou StoreSettings.promotionsEnabled é false. */
  getPromotionByCoupon(code: string): Promise<Promotion | null>;

  // Cliente (loja)
  register(input: RegisterInput): Promise<Customer>;
  login(email: string, password: string): Promise<Customer>;
  /** Manda um e-mail com link de redefinição — a troca de senha em si acontece na página que o link abre (fora do ApiClient, é direto com o Supabase Auth). Mock não envia e-mail de verdade, só simula sucesso. */
  resetPassword(email: string): Promise<void>;
  logout(): Promise<void>;
  getCurrentCustomer(): Promise<Customer | null>;
  createOrder(input: CreateOrderInput): Promise<Order>;
  getOrder(id: string): Promise<Order>;
  getCustomerOrders(customerId: string): Promise<Order[]>;
  /** Só existe em mock por enquanto — no backend real isso é o painel de entregas do admin (PATCH /api/orders/:id/status). */
  advanceOrderStatus(id: string, status: OrderStatus): Promise<Order>;
  /** Ajuste feito na separação (peso variável, falta de estoque): grava a quantidade realmente enviada por item e recalcula subtotal/total do pedido. estimatedSubtotal original fica preservado pra comparação. */
  updateOrderItems(id: string, adjustments: { productId: string; finalQuantity: number }[]): Promise<Order>;

  // Admin (painel) — platformAdmin enxerga tudo, vendorAdmin só o próprio vendorId
  /** Autocadastro do dono da loja como platformAdmin — separado das contas demo do seed. */
  registerAdmin(input: { name: string; email: string; password: string }): Promise<AdminUser>;
  adminLogin(email: string, password: string): Promise<AdminUser>;
  /** Mesmo fluxo de resetPassword, mas pro admin. */
  resetAdminPassword(email: string): Promise<void>;
  adminLogout(): Promise<void>;
  getCurrentAdminUser(): Promise<AdminUser | null>;
  /** Só retorna algo pra quem é isPlatformOwner — backend rejeita os outros com 403. */
  getCompanies(): Promise<Company[]>;
  createCompany(input: { name: string; slug: string; ecommerceType?: EcommerceType }): Promise<Company>;
  updateCompany(id: string, patch: { name?: string; domain?: string; adminDomain?: string; active?: boolean }): Promise<Company>;
  /** Equipe (login "staff", acesso restrito por aba) — só platformAdmin pode chamar, backend rejeita os outros com 403. */
  getTeamMembers(): Promise<AdminUser[]>;
  createTeamMember(input: CreateTeamMemberInput): Promise<AdminUser>;
  updateTeamMember(id: string, patch: UpdateTeamMemberInput): Promise<AdminUser>;
  getStaffSectors(): Promise<StaffSector[]>;
  createStaffSector(name: string): Promise<StaffSector>;
  deleteStaffSector(id: string): Promise<void>;

  // ---------- Gestão de Atividades ----------
  getActivityClients(): Promise<ActivityClient[]>;
  createActivityClient(input: { customerId?: string; name: string; phone?: string }): Promise<ActivityClient>;
  updateActivityClient(
    id: string,
    patch: Partial<{ health: ActivityHealth; healthReason: string; nextContactAt: string | null; name: string; phone: string }>,
  ): Promise<ActivityClient>;

  getActivityOutcomes(): Promise<ActivityOutcome[]>;
  createActivityOutcome(name: string): Promise<ActivityOutcome>;
  updateActivityOutcome(id: string, patch: Partial<{ name: string; sortOrder: number; active: boolean }>): Promise<ActivityOutcome>;

  getActivities(params?: { column?: ActivityColumn; assignedToAdminId?: string; clientId?: string; cardNumber?: number }): Promise<Activity[]>;
  createActivity(input: {
    clientId: string;
    title: string;
    description?: string;
    assignedToAdminId: string;
    priority?: Activity["priority"];
  }): Promise<Activity>;
  updateActivity(
    id: string,
    patch: Partial<{
      column: ActivityColumn;
      title: string;
      description: string;
      assignedToAdminId: string;
      priority: Activity["priority"];
      outcomeId: string;
      imageUrls: string[];
    }>,
  ): Promise<Activity>;
  uploadActivityImage(file: File): Promise<string>;
  createProduct(input: CreateProductInput): Promise<Product>;
  updateProduct(id: string, patch: UpdateProductInput): Promise<Product>;
  /** Todos os produtos (qualquer status), pro admin gerenciar — diferente de getProducts, que só traz "active" pro catálogo público. Escopo (platformAdmin: todos · vendorAdmin: só o próprio) é resolvido pelo backend a partir do token, não por parâmetro. */
  getAdminProducts(): Promise<Product[]>;
  /** Produto pra edição no admin — diferente de getProduct, não mistura o preço com Promoções de campanha (o admin precisa ver/editar o valor real gravado). */
  getAdminProduct(id: string): Promise<Product>;
  /** Mock: resize/encode do lado do cliente. Real: POST /api/products/:id/photos (multipart) — precisa do produto já existir. */
  uploadProductPhoto(productId: string | null, file: File): Promise<string>;
  getAdminOrders(params?: { status?: OrderStatus; vendorId?: string }): Promise<Order[]>;
  /** Detalhe de um pedido pelo admin — diferente de getOrder, que é escopado ao cliente logado na loja. */
  getAdminOrder(id: string): Promise<Order>;
  /** Lista todos os clientes cadastrados — só platformAdmin. */
  getAdminCustomers(): Promise<Customer[]>;
  /** Editar cadastro de cliente (nome, telefone, região, cód. de referência, status) — só platformAdmin. */
  updateCustomer(
    id: string,
    patch: Partial<Pick<Customer, "name" | "phone" | "businessName" | "regionId" | "referenceCode" | "preferredPaymentMethod" | "status">>,
  ): Promise<Customer>;
  /** Cria um endereço pro cliente (ex: cadastro veio sem endereço) — só platformAdmin. */
  createCustomerAddress(customerId: string, input: Omit<Address, "id">): Promise<Address>;
  /** Corrige um endereço já existente do cliente — só platformAdmin. Se for o endereço padrão e o bairro mudar, a região do cliente é recalculada no próximo carregamento. */
  updateCustomerAddress(addressId: string, patch: Partial<Omit<Address, "id">>): Promise<Address>;
  createVendor(input: Omit<Vendor, "id">): Promise<Vendor>;
  updateVendor(id: string, patch: Partial<Omit<Vendor, "id">>): Promise<Vendor>;
  /** Roteirização: cria/edita uma zona de entrega e os bairros que ela cobre. */
  createRegion(input: Omit<DeliveryRegion, "id">): Promise<DeliveryRegion>;
  updateRegion(id: string, patch: Partial<Omit<DeliveryRegion, "id">>): Promise<DeliveryRegion>;
  /** Cor de marca, logo, carrossel de banners da home. */
  updateStoreSettings(patch: Partial<StoreSettings>): Promise<StoreSettings>;
  /** Mock: mesmo resize/encode do upload de foto de produto. Real: POST /api/settings/logo (multipart). */
  uploadLogo(file: File): Promise<string>;
  /** platformAdmin: todas · vendorAdmin: só as com rules.vendorId === o próprio. */
  getAdminPromotions(params?: { vendorId?: string }): Promise<Promotion[]>;
  createPromotion(input: CreatePromotionInput): Promise<Promotion>;
  updatePromotion(id: string, patch: UpdatePromotionInput): Promise<Promotion>;
  /** Departamentos — só platformAdmin, é estrutura global do catálogo. */
  createCategory(input: Omit<Category, "id">): Promise<Category>;
  updateCategory(id: string, patch: Partial<Omit<Category, "id">>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
}

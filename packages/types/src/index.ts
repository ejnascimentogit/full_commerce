export type DocumentType = "cpf" | "cnpj";

/** Hierarquia real de pagamento, nessa ordem de exibição: PIX, Débito, Crédito (à vista ou parcelado — ver StoreSettings), Dinheiro à vista. */
export type PaymentMethod = "pix" | "debit" | "credit" | "cash";

export type AdminRole = "platformAdmin" | "vendorAdmin" | "staff";

/** Chaves de seção usadas tanto no menu do admin quanto no array `permissions` de um staff. */
export type AdminPermissionKey =
  | "produtos"
  | "pedidos"
  | "clientes"
  | "financeiro"
  | "promocoes"
  | "departamentos"
  | "fornecedores"
  | "atividades";

/** Setor/cargo (ex: "Financeiro", "Televendas") — cadastrado pelo platformAdmin em Configurações. Estrutural: governa quem vê o quê em Atividades (ver AdminUser.sectorId/isSupervisor). */
export interface StaffSector {
  id: string;
  name: string;
  /** true = qualquer pessoa desse setor enxerga Atividades de TODOS os setores (uso: Diretoria/visão executiva), não só o próprio. */
  seesAll: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  vendorId?: string; // presente só para vendorAdmin — escopa o que ele enxerga
  /** true só para o admin da empresa 1 (quem opera a plataforma) — só ele vê a tela Empresas e pode cadastrar novos clientes. */
  isPlatformOwner?: boolean;
  /** presente só para role "staff" — quais seções do admin essa pessoa pode acessar. platformAdmin sempre tem acesso total e ignora isso. */
  permissions?: AdminPermissionKey[];
  /** presente só para role "staff" — login desativado não consegue mais autenticar. */
  active?: boolean;
  /** presente só para role "staff" — setor/cargo da pessoa (ver StaffSector). Governa quem ela enxerga em Atividades, além do rótulo exibido na lista. */
  sectorId?: string;
  /** presente só para role "staff" — supervisor do próprio setor enxerga as Atividades de todo mundo do mesmo setor, não só as próprias. */
  isSupervisor?: boolean;
  /** presente só para role "staff" — gerente enxerga Atividades de TODOS os setores, igual a um setor "vê tudo" (ex: Diretoria), mas concedido pessoa a pessoa em vez de depender do setor. */
  isManager?: boolean;
}

/** "wholesale" = atacado B2B multi-fornecedor (modelo padrão, Praso-like). "televendas" = varejo B2C por telemarketing com crediário próprio. Ver .claude/skills/ecommerce/references/televendas.md. */
export type EcommerceType = "wholesale" | "televendas";

export interface Company {
  id: string;
  name: string;
  slug: string;
  /** Domínio da loja pública. Fica undefined até o cliente comprar/apontar um domínio de verdade. */
  domain?: string;
  /** Domínio do painel admin — loja e admin costumam ficar em subdomínios diferentes, por isso os dois campos. */
  adminDomain?: string;
  active: boolean;
  createdAt: string;
  /** Definido na criação da empresa, não editável depois — decide quais telas do admin e qual layout de storefront essa empresa usa. */
  ecommerceType: EcommerceType;
}

export interface Address {
  id: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  /** Usado para roteirização e como padrão no checkout — o endereço para onde o pedido vai. */
  isDefault: boolean;
  /** Rótulo livre pra distinguir múltiplos endereços na lista (ex: "Entrega", "Endereço"). */
  label?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  documentType: DocumentType;
  document: string;
  businessName?: string;
  phone: string;
  addresses: Address[];
  /** Resolvido automaticamente pelo bairro do endereço (ver DeliveryRegion.neighborhoods) — nunca escolhido pelo cliente. Ausente = fora de toda zona cadastrada, aguardando roteirização do admin. */
  regionId?: string;
  /** Código interno da loja para este cliente (gerado automaticamente no cadastro, ex: "CLI-1001"). */
  code?: string;
  /** Código que o próprio cliente usa para nos identificar no sistema dele — texto livre, opcional. */
  referenceCode?: string;
  /** Definida pelo admin (ex: cliente que já vem com condição fixada no ERP da empresa) — pré-seleciona a aba no checkout, mas continua editável pelo cliente lá. */
  preferredPaymentMethod?: PaymentMethod;
  createdAt: string;
  status: "active" | "inactive";
}

export interface DeliveryRegion {
  id: string;
  name: string;
  active: boolean;
  cutoffTime: string; // "19:00"
  estimatedDeliveryHours: number;
  /** Roteirização: bairros cobertos por esta zona (comparação case-insensitive). Um endereço cujo bairro não conste em nenhuma zona fica sem regionId até o admin ajustar. */
  neighborhoods: string[];
}

export interface Vendor {
  id: string;
  name: string;
  cnpj: string;
  logoUrl?: string;
  description?: string;
  active: boolean;
  isFeatured: boolean;
  /** Código interno da loja para este fornecedor — digitado pelo admin, opcional. */
  code?: string;
  /** Código que o próprio fornecedor usa para se identificar no sistema dele — texto livre, opcional. */
  referenceCode?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  parentCategoryId?: string;
}

export type UnitType = "un" | "kg" | "cx";

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  stock: number;
  priceOverride?: number;
}

export interface Product {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  sku: string;
  /** Código que o cliente já usa para esse produto no sistema dele — texto livre, opcional. */
  customerReferenceCode?: string;
  categoryId: string;
  brand?: string;
  photos: string[];
  unitType: UnitType;
  basePrice: number;
  salePrice?: number;
  /** true = salePrice veio de uma Promoção ativa (Promoções no admin); false/ausente = preço promocional digitado direto no cadastro do produto. Só pra diferenciar visualmente no catálogo. */
  promotionActive?: boolean;
  boxQuantity?: number;
  isVariableWeight: boolean;
  avgWeight?: number;
  /** Vitrine "Produtos Sazonais" na home — curadoria manual do admin, não calculado. */
  isSeasonal?: boolean;
  stock: number;
  variants: ProductVariant[];
  status: "active" | "inactive" | "draft";
  weight?: number;
}

export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPriceAtAdd: number;
}

export interface Cart {
  id: string;
  customerId?: string;
  items: CartItem[];
  couponCode?: string;
  updatedAt: string;
}

export type OrderStatus =
  | "PENDING"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export interface OrderItem {
  productId: string;
  vendorId: string;
  name: string;
  sku: string;
  unitType: UnitType;
  unitPrice: number;
  quantity: number;
  estimatedSubtotal: number;
  finalSubtotal?: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  items: OrderItem[];
  shippingAddress: Address;
  regionId?: string;
  paymentMethod: PaymentMethod;
  /** Só relevante pra paymentMethod "credit" — quantas parcelas o cliente escolheu no checkout. */
  installments?: number;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; changedAt: string }[];
  tracking?: { code: string; carrier: string; url: string };
  createdAt: string;
  /** Registro em Supabase de cada ajuste feito na separação — quem mudou, quando, valor antes/depois. Complementa OrderItem.finalSubtotal (que só guarda o resultado atual). */
  itemAdjustments?: OrderItemAdjustment[];
}

export interface OrderItemAdjustment {
  productId: string;
  productName: string;
  previousSubtotal: number;
  newSubtotal: number;
  adminName: string;
  changedAt: string;
}

export type PaymentStatus = "pending" | "approved" | "refused" | "refunded";

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  installments: number;
  gatewayTransactionId?: string;
  paidAt?: string;
  pix?: { qrCode: string; copyPaste: string; expiresAt: string };
}

export type PromotionType = "percentage" | "fixed" | "freeShipping" | "coupon";

export interface Promotion {
  id: string;
  type: PromotionType;
  rules: {
    productIds?: string[];
    categoryIds?: string[];
    vendorId?: string;
    minOrderValue?: number;
  };
  value: number;
  isFeatured: boolean;
  startsAt: string;
  endsAt: string;
  couponCode?: string;
  maxUses?: number;
  currentUses: number;
}

export interface Banner {
  id: string;
  imageUrl: string;
  title?: string;
  linkUrl?: string;
  order: number;
  active: boolean;
}

export interface SiteFeatureBullet {
  icon: string;
  title: string;
  text: string;
}

export interface SiteCopy {
  /** Nome exibido no header quando não há logo, e no <title> das páginas. */
  storeName: string;
  heroTitle: string;
  /** Os 3 selos abaixo do título da home (ex: "Sem pedido mínimo"). */
  featureBullets: SiteFeatureBullet[];
}

export interface FooterLink {
  id: string;
  label: string;
  url: string;
}

export interface FooterSettings {
  /** Linha de rodapé com razão social/CNPJ/endereço — texto livre, o admin escreve como quiser. */
  legalText: string;
  supportEmail?: string;
  supportPhone?: string;
  /** Lista livre — o admin cadastra quantas formas de pagamento quiser (ex: "Cartão de crédito", "PIX", "Boleto"). */
  paymentMethods: string[];
  /** Coluna "Ajuda" do rodapé (ex: Política de Entrega → /politica-de-entrega). */
  helpLinks: FooterLink[];
  /** Uma rede social por linha — não fica preso a uma lista fixa de plataformas. */
  socialLinks: FooterLink[];
}

export interface StoreSettings {
  /** Cor base da marca (hex, ex: "#1d4ed8") — o front deriva os demais tons (50/100/500/700) a partir dela. */
  brandColor: string;
  logoUrl?: string;
  /** Carrossel de banners da home, em ordem. */
  banners: Banner[];
  /** Interruptor geral: se false, nenhum cupom/promoção aplica desconto no checkout, mesmo que a Promotion esteja ativa. */
  promotionsEnabled: boolean;
  /** Textos editáveis da home — dá autonomia pro admin trocar nome/frases sem depender de deploy. */
  siteCopy: SiteCopy;
  footer: FooterSettings;
  /** undefined/0 = sem pedido mínimo (regra padrão herdada do modelo Praso). Se definido, checkout bloqueia carrinho abaixo do valor. */
  minOrderValue?: number;
  /** Regra padrão herdada do Praso é `true`. Desligado, todo cliente paga `shippingCost`, CNPJ ou não. */
  freeShippingForCnpj: boolean;
  /** Frete cobrado quando não é grátis (CPF, ou CNPJ com freeShippingForCnpj desligado). */
  shippingCost: number;

  /** Chave Pix da loja (cpf/cnpj/email/telefone/aleatória) — gera o QR estático no checkout. Sem isso, PIX no checkout não mostra QR. */
  pixKey?: string;
  /** Nome do recebedor exibido no QR (máx. 25 caracteres pela especificação do Bacen — truncado se maior). */
  pixReceiverName?: string;
  /** Cidade do recebedor exibida no QR (máx. 15 caracteres). */
  pixReceiverCity?: string;

  /** Máximo de parcelas oferecidas no crédito. */
  maxInstallments: number;
  /** Parcelas com valor abaixo disso somem da lista de opções (evita "12x de R$ 0,80"). */
  minInstallmentValue: number;
  /** Até quantas parcelas saem sem juros — acima disso aplica monthlyInterestRate. 1x sempre disponível (é o "crédito rotativo"/à vista). */
  interestFreeInstallments: number;
  /** Taxa de juros ao mês (%) aplicada acima de interestFreeInstallments, via Tabela Price. */
  monthlyInterestRate: number;

  /** Filtro do admin: quais formas de pagamento aparecem pro consumidor escolher no checkout. Vazio/ausente = nenhuma (trava o checkout), então a UI sempre garante pelo menos uma marcada. */
  enabledPaymentMethods: PaymentMethod[];

  /** Desligado (padrão): depois que o pedido sai para entrega ou é entregue, a mercadoria já deixou o estoque e a nota fiscal já foi emitida — não dá mais pra ajustar quantidade. Ligar aqui libera o ajuste mesmo nesses status. */
  allowAdjustmentsAfterDispatch: boolean;
}

// ---------- Gestão de Atividades ----------
// Quadro de reengajamento de clientes usado por vendedores/financeiro (login
// "staff", ver AdminPermissionKey "atividades") — cada empresa tem o próprio
// quadro, isolado das demais.

export type ActivityHealth = "green" | "amber" | "red";

/** Cliente do quadro de atividades — pode ser um cliente real (customerId preenchido) ou um lead que ainda não comprou (customerId ausente). */
export interface ActivityClient {
  id: string;
  customerId?: string;
  name: string;
  phone?: string;
  health: ActivityHealth;
  healthReason?: string;
  nextContactAt?: string;
  createdAt: string;
}

/** Lista configurável (Configurações) do que significa "concluído" num card — ex: "Convertido em venda", "Cobrança resolvida". */
export interface ActivityOutcome {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
}

export type ActivityColumn = "urgent" | "todo" | "doing" | "done";
export type ActivityPriority = "none" | "red" | "amber" | "blue";

/** Um card do quadro de atividades. cardNumber é sequencial por empresa, pra busca futura por número. */
export interface Activity {
  id: string;
  cardNumber: number;
  clientId: string;
  title: string;
  description?: string;
  column: ActivityColumn;
  priority: ActivityPriority;
  createdByAdminId: string;
  assignedToAdminId: string;
  /** Preenchido só quando column === "done" — exigido antes de mover pra Concluído. */
  outcomeId?: string;
  imageUrls: string[];
  createdAt: string;
  completedAt?: string;
}

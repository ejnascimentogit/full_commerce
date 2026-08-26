export type DocumentType = "cpf" | "cnpj";

export type AdminRole = "platformAdmin" | "vendorAdmin";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  vendorId?: string; // presente só para vendorAdmin — escopa o que ele enxerga
  /** true só para o admin da empresa 1 (quem opera a plataforma) — só ele vê a tela Empresas e pode cadastrar novos clientes. */
  isPlatformOwner?: boolean;
}

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
  /** Definida pelo admin (ex: cliente que já vem com condição fixada no ERP da empresa) — informativa, não obriga o pagamento no checkout. */
  preferredPaymentMethod?: "cash" | "card" | "pix";
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
  paymentMethod: "card" | "pix" | "boleto";
  /** Só relevante pra paymentMethod "card" — quantas parcelas o cliente escolheu no checkout. */
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
  method: "card" | "pix";
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

  /** Máximo de parcelas oferecidas no cartão. */
  maxInstallments: number;
  /** Parcelas com valor abaixo disso somem da lista de opções (evita "12x de R$ 0,80"). */
  minInstallmentValue: number;
  /** Até quantas parcelas saem sem juros — acima disso aplica monthlyInterestRate. */
  interestFreeInstallments: number;
  /** Taxa de juros ao mês (%) aplicada acima de interestFreeInstallments, via Tabela Price. */
  monthlyInterestRate: number;

  /** Desligado (padrão): depois que o pedido sai para entrega ou é entregue, a mercadoria já deixou o estoque e a nota fiscal já foi emitida — não dá mais pra ajustar quantidade. Ligar aqui libera o ajuste mesmo nesses status. */
  allowAdjustmentsAfterDispatch: boolean;
}

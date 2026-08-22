export type DocumentType = "cpf" | "cnpj";

export type AdminRole = "platformAdmin" | "vendorAdmin";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  vendorId?: string; // presente só para vendorAdmin — escopa o que ele enxerga
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
  isDefault: boolean;
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
  categoryId: string;
  brand?: string;
  photos: string[];
  unitType: UnitType;
  basePrice: number;
  salePrice?: number;
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
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; changedAt: string }[];
  tracking?: { code: string; carrier: string; url: string };
  createdAt: string;
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

export interface StoreSettings {
  /** Cor base da marca (hex, ex: "#1d4ed8") — o front deriva os demais tons (50/100/500/700) a partir dela. */
  brandColor: string;
  logoUrl?: string;
  /** Carrossel de banners da home, em ordem. */
  banners: Banner[];
}

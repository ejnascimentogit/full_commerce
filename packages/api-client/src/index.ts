import { mockApiClient } from "./mock";
import { createRestApiClient } from "./rest";
import type { ApiClient } from "./types";

export type {
  ApiClient,
  CreateOrderInput,
  CreateOrderItemInput,
  CreatePromotionInput,
  CreateProductInput,
  Paginated,
  ProductQuery,
  RegisterAddressInput,
  RegisterInput,
  UpdatePromotionInput,
  UpdateProductInput,
} from "./types";
export { packageLabels } from "./mock";
export {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  calculateOrderTotals,
  calculatePromotionDiscount,
  calculateShipping,
  deriveBrandPalette,
  findPromotionByCoupon,
  getBestSellingProducts,
  isPromotionActive,
  matchRegionByNeighborhood,
  unitPriceOf,
} from "./domain";
export type { BrandPalette } from "./domain";
export { formatCPF, formatCNPJ, formatDocument, isValidCPF, isValidCNPJ, isValidDocument, onlyDigits } from "./documents";
export { lookupCep, formatCep } from "./cep";
export type { CepAddress } from "./cep";

// The single place that decides mock vs. real backend. Everything else in the
// three apps imports `apiClient` from here and never touches mock/ or rest/ directly.
export function createApiClient(): ApiClient {
  const mode = process.env.NEXT_PUBLIC_API_MODE ?? "mock";
  if (mode === "rest") {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    return createRestApiClient(baseUrl);
  }
  return mockApiClient;
}

export const apiClient = createApiClient();

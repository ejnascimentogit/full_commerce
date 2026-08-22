import { mockApiClient } from "./mock";
import { createRestApiClient } from "./rest";
import type { ApiClient } from "./types";

export type {
  ApiClient,
  CreateOrderInput,
  CreateOrderItemInput,
  CreateProductInput,
  Paginated,
  ProductQuery,
  RegisterInput,
  UpdateProductInput,
} from "./types";
export { packageLabels } from "./mock";
export { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL, calculateOrderTotals, calculateShipping, unitPriceOf } from "./domain";

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

import type { Quote } from "@ecommerce/types";

// Mesmo padrão de orders-store.ts: persistido em localStorage (browser only)
// pra orçamentos sobreviverem a reload e ficarem consistentes entre client
// components. Loja e admin rodam em origens diferentes em dev, então não
// compartilham esse localStorage — cada app cria/lê só os próprios orçamentos
// de mock, mesma limitação de mock que orders-store.ts já documenta.
const STORAGE_KEY = "ecommerce.mock.quotes";
const SEQUENCE_KEY = "ecommerce.mock.quoteSequence";

function readQuotes(): Quote[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeQuotes(quotes: Quote[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
}

export function nextQuoteNumber(): string {
  if (typeof window === "undefined") return "ORC-0000";
  const current = Number(localStorage.getItem(SEQUENCE_KEY) ?? "1000") + 1;
  localStorage.setItem(SEQUENCE_KEY, String(current));
  return `ORC-${current}`;
}

export function saveQuote(quote: Quote): Quote {
  const quotes = readQuotes();
  quotes.push(quote);
  writeQuotes(quotes);
  return quote;
}

export function findQuoteById(id: string): Quote | undefined {
  return readQuotes().find((q) => q.id === id);
}

export function findQuotesByCustomer(customerId: string): Quote[] {
  return readQuotes()
    .filter((q) => q.customerId === customerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function findAllQuotes(): Quote[] {
  return readQuotes().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// Patch genérico — usado tanto pra resposta do vendedor (status/quotedTotal/
// responseNote) quanto pra confirmar endereço (addressId) e converter em
// pedido (convertedOrderId/status). `items` nunca é alterado por aqui (um
// orçamento não tem seus itens editados depois de criado).
export function updateQuote(id: string, patch: Partial<Omit<Quote, "id" | "items">>): Quote {
  const quotes = readQuotes();
  const index = quotes.findIndex((q) => q.id === id);
  if (index === -1) throw new Error(`Quote not found: ${id}`);
  quotes[index] = { ...quotes[index], ...patch };
  writeQuotes(quotes);
  return quotes[index];
}

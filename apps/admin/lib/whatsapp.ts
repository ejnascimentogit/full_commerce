export type WhatsappKind = "pedidos" | "orcamentos" | "perdidos";

// Nome fixo da aba: abrir sempre com o mesmo nome faz o navegador reaproveitar a mesma aba do WhatsApp Web
// em vez de abrir uma nova a cada cliente (o WhatsApp Web só funciona em uma aba por vez).
export const WHATSAPP_WINDOW_NAME = "fullcommerce-whatsapp";

export const WHATSAPP_KIND_LABEL: Record<WhatsappKind, string> = {
  pedidos: "Pedidos",
  orcamentos: "Orçamentos",
  perdidos: "Perdidos (carrinhos abandonados)",
};

const ALL_KINDS: WhatsappKind[] = ["pedidos", "orcamentos", "perdidos"];

export interface WhatsappVariable {
  key: string;
  label: string;
  kinds: WhatsappKind[];
}

export const WHATSAPP_VARIABLES: WhatsappVariable[] = [
  { key: "nome", label: "Nome completo do cliente", kinds: ALL_KINDS },
  { key: "primeiro_nome", label: "Primeiro nome do cliente", kinds: ALL_KINDS },
  { key: "empresa", label: "Nome da loja", kinds: ALL_KINDS },
  { key: "numero", label: "Número do pedido / orçamento", kinds: ["pedidos", "orcamentos"] },
  { key: "status", label: "Status atual", kinds: ["pedidos", "orcamentos"] },
  { key: "valor", label: "Valor total", kinds: ALL_KINDS },
  { key: "produtos", label: "Lista de produtos", kinds: ALL_KINDS },
  { key: "dias", label: "Há quanto tempo o carrinho está parado", kinds: ["perdidos"] },
];

export const DEFAULT_WHATSAPP_TEMPLATES: Record<WhatsappKind, string> = {
  pedidos:
    "Olá, {primeiro_nome}! Aqui é da {empresa}. Sobre o seu pedido {numero} ({status}), no valor de {valor}:\n\n{produtos}\n\nQualquer dúvida, é só responder esta mensagem.",
  orcamentos:
    "Olá, {primeiro_nome}! Aqui é da {empresa}. Sobre o seu orçamento {numero} ({status}), no valor de {valor}:\n\n{produtos}\n\nPosso te ajudar a fechar?",
  perdidos:
    "Olá, {primeiro_nome}! Aqui é da {empresa}. Vi que você deixou alguns produtos no carrinho (parado {dias}), no valor de {valor}:\n\n{produtos}\n\nPosso te ajudar a finalizar a compra?",
};

export const SAMPLE_VARS: Record<WhatsappKind, Record<string, string>> = {
  pedidos: {
    nome: "Maria da Silva",
    primeiro_nome: "Maria",
    numero: "PED-1005",
    status: "Pago",
    valor: "R$ 217,50",
    produtos: "- 3x Queijo Mussarela (Peça)\n- 3x Charque Jerked Beef 1kg",
    dias: "",
  },
  orcamentos: {
    nome: "Maria da Silva",
    primeiro_nome: "Maria",
    numero: "ORC-12",
    status: "Orçado",
    valor: "R$ 217,50",
    produtos: "- 3x Queijo Mussarela (Peça)\n- 3x Charque Jerked Beef 1kg",
    dias: "",
  },
  perdidos: {
    nome: "Maria da Silva",
    primeiro_nome: "Maria",
    numero: "",
    status: "",
    valor: "R$ 217,50",
    produtos: "- 3x Queijo Mussarela (Peça)\n- 3x Charque Jerked Beef 1kg",
    dias: "há 2 dias",
  },
};

export function templateFor(kind: WhatsappKind, saved?: Partial<Record<WhatsappKind, string>>): string {
  const text = saved?.[kind];
  return text && text.trim() ? text : DEFAULT_WHATSAPP_TEMPLATES[kind];
}

// Troca {variavel} pelo valor. Variável desconhecida fica como está (assim um erro de digitação aparece na tela).
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

export function money(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function firstName(name?: string): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function productList(items: { name: string; quantity: number }[]): string {
  return items.map((item) => `- ${item.quantity}x ${item.name}`).join("\n");
}

// Telefone só com dígitos e com o 55 do Brasil na frente. Menos de 10 dígitos = não dá pra chamar.
export function whatsappPhone(phone?: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
}

export function whatsappWebUrl(phone: string, text: string): string {
  return `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
}

export function whatsappAppUrl(phone: string, text: string): string {
  return `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`;
}

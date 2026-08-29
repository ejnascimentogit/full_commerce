import type { DeliveryRegion, StoreSettings } from "@ecommerce/types";
import { PAYMENT_METHOD_LABEL } from "./domain";

// Central de ajuda sem IA nem chamada de rede — busca local por palavra-chave
// numa lista curada de perguntas. Zero custo por pergunta, funciona offline,
// mas só responde bem ao que já está previsto aqui (ver ADMIN_FAQ e
// buildCustomerFaq abaixo pra adicionar novas perguntas).

export interface FaqEntry {
  question: string;
  keywords: string[];
  answer: string;
}

// Palavras que aparecem em quase toda pergunta em português ("como faço para...")
// — contam pouco/nada sobre o ASSUNTO da pergunta, então não entram na pontuação.
// Sem isso, "como faço para pagar com pix" batia mais com "Como faço para me
// cadastrar?" (bate em "como/faço/para") do que com a pergunta de pagamento de
// verdade (só bate em "pagar/pix").
const STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das", "e", "ou", "que",
  "com", "para", "pra", "por", "em", "no", "na", "nos", "nas", "se", "como", "meu", "minha", "meus",
  "minhas", "seu", "sua", "seus", "suas", "eu", "voce", "você", "vc", "tem", "ter", "sao", "são", "ser",
  "esta", "está", "estao", "estão", "isso", "essa", "esse", "aqui", "la", "lá", "mais", "menos", "nao",
  "não", "sim", "ja", "já", "ainda", "tambem", "também", "so", "só", "ao", "aos", "faco", "faço",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

function wordsOf(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function money(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

// Pontua cada pergunta pelo número de palavras da busca (sem as genéricas acima)
// que aparecem — como palavra inteira, não como pedaço de outra palavra ("com"
// não deve "achar" dentro de "como") — na pergunta em si ou nas palavras-chave.
// Simples, sem dependência nenhuma, suficiente pra um conjunto pequeno e bem
// definido de tópicos.
export function searchFaq(entries: FaqEntry[], query: string): FaqEntry[] {
  const words = wordsOf(query).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  if (words.length === 0) return [];
  const scored = entries.map((entry) => {
    const haystack = new Set(wordsOf(`${entry.question} ${entry.keywords.join(" ")}`));
    const score = words.reduce((sum, w) => sum + (haystack.has(w) ? 1 : 0), 0);
    return { entry, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.entry);
}

// Respostas montadas com dados reais e atuais da empresa (StoreSettings/regiões) —
// se o admin mudar frete, pedido mínimo ou formas de pagamento em Configurações,
// a resposta já reflete isso na próxima vez, sem precisar editar nada aqui.
export function buildCustomerFaq(settings: StoreSettings, regions: DeliveryRegion[]): FaqEntry[] {
  const shippingCost = money(settings.shippingCost);
  const shippingRule = settings.freeShippingForCnpj
    ? `Frete grátis para clientes com CNPJ. Clientes com CPF pagam ${shippingCost}.`
    : `O frete custa ${shippingCost} para todos os clientes.`;
  const payments = settings.enabledPaymentMethods.map((m) => PAYMENT_METHOD_LABEL[m]).join(", ");
  const regionNames = regions.filter((r) => r.active).map((r) => r.name);

  return [
    {
      question: "Qual o valor mínimo do pedido?",
      keywords: ["pedido", "minimo", "valor", "quanto", "preciso comprar"],
      answer:
        settings.minOrderValue != null
          ? `O pedido mínimo é de ${money(settings.minOrderValue)}.`
          : "Não existe pedido mínimo — você pode comprar a partir de 1 item.",
    },
    {
      question: "Como funciona o frete?",
      keywords: ["frete", "entrega", "envio", "gratis", "grátis"],
      answer: shippingRule,
    },
    {
      question: "Quais formas de pagamento vocês aceitam?",
      keywords: ["pagamento", "pagar", "pix", "cartao", "cartão", "dinheiro", "boleto", "credito", "débito"],
      answer: `Aceitamos: ${payments}.`,
    },
    {
      question: "Para quais regiões vocês entregam?",
      keywords: ["regiao", "região", "bairro", "entregam", "onde", "zona"],
      answer: regionNames.length
        ? `Entregamos nas seguintes regiões: ${regionNames.join(", ")}.`
        : "Ainda não há zonas de entrega cadastradas — fale com o suporte da loja.",
    },
    {
      question: "Como acompanho meu pedido?",
      keywords: ["acompanhar", "status", "rastrear", "meu pedido", "onde esta"],
      answer: 'Acesse "Meus pedidos" na sua conta para ver o status atualizado do seu pedido, do pagamento até a entrega.',
    },
    {
      question: "Preciso ter CNPJ para comprar?",
      keywords: ["cnpj", "cpf", "pessoa fisica", "pessoa juridica", "cadastro"],
      answer:
        "Não — aceitamos cadastro com CPF ou CNPJ. Clientes com CNPJ têm frete grátis; clientes CPF pagam o frete normalmente.",
    },
    {
      question: "Como uso um cupom de desconto?",
      keywords: ["cupom", "desconto", "promocao", "promoção", "codigo promocional"],
      answer: "No checkout, antes de confirmar o pedido, há um campo para digitar o código do cupom — o desconto é aplicado na hora.",
    },
    {
      question: "Como faço para me cadastrar?",
      keywords: ["cadastro", "criar conta", "cadastrar", "registrar"],
      answer: 'Clique em "Criar uma conta" na loja e preencha seus dados — nome, e-mail, CPF/CNPJ, telefone e endereço de entrega.',
    },
    {
      question: "Esqueci minha senha, e agora?",
      keywords: ["senha", "esqueci", "recuperar", "login", "entrar"],
      answer:
        'Na tela de login, clique em "Esqueci minha senha" e informe seu e-mail — você vai receber um link para definir uma senha nova.',
    },
  ];
}

// Estático — não depende de dados da empresa, é sobre como o painel funciona.
export const ADMIN_FAQ: FaqEntry[] = [
  {
    question: "Como funciona o código do produto (SKU)?",
    keywords: ["sku", "codigo", "código", "produto"],
    answer:
      "O SKU é gerado automaticamente pelo sistema no formato {número da empresa}{sequencial de 5 dígitos} — por exemplo 100001, 100002... Nunca é digitado e não pode ser editado depois de criado, pra evitar erro de digitação.",
  },
  {
    question: "Posso repetir o código de referência do cliente?",
    keywords: ["referencia", "referência", "duplicado", "repetir"],
    answer: "Não — o sistema recusa salvar um produto com um código de referência já usado por outro produto da mesma empresa.",
  },
  {
    question: "Como funciona a aba Financeiro?",
    keywords: ["financeiro", "extrato", "faturamento", "comprou", "gasto"],
    answer:
      'A aba Financeiro mostra, por cliente, o total gasto, ticket médio, produtos mais comprados e o histórico de pedidos. Clique em "Ver" num pedido pra abrir os itens direto na mesma tela.',
  },
  {
    question: "Como ajusto a quantidade de um item depois do pedido feito?",
    keywords: ["ajustar", "separacao", "separação", "peso", "quantidade"],
    answer:
      'Na tela do pedido, dá pra ajustar a quantidade final de cada item (por exemplo, peso real de um produto vendido por peso). Depois que o pedido sai para entrega ou é entregue, isso só é permitido se a opção "permitir ajuste após despacho" estiver ativada em Configurações.',
  },
  {
    question: "Como funcionam as formas de pagamento?",
    keywords: ["pagamento", "pix", "cartao", "cartão", "parcelamento"],
    answer:
      "Em Configurações, você escolhe quais formas de pagamento aparecem pro cliente na loja: PIX, cartão de débito, cartão de crédito (com parcelamento configurável) e dinheiro à vista.",
  },
  {
    question: "Como crio uma promoção ou cupom?",
    keywords: ["promocao", "promoção", "cupom", "desconto"],
    answer:
      "Na tela Promoções, crie um desconto percentual, fixo ou frete grátis — pode valer pra todo o catálogo ou só pra um produto/categoria/fornecedor específico, com vigência e limite de usos.",
  },
  {
    question: "O que é a tela Empresas?",
    keywords: ["empresas", "multiempresa", "novo", "cliente da plataforma"],
    answer:
      "Só o dono da plataforma vê essa tela — é usada pra cadastrar novos clientes da plataforma (cada empresa com catálogo, clientes e configurações isolados das demais).",
  },
  {
    question: "Esqueci minha senha do admin",
    keywords: ["senha", "esqueci", "login", "entrar"],
    answer:
      'Na tela de login do admin, clique em "Esqueci minha senha" e informe seu e-mail — você recebe um link pra definir uma senha nova. Ninguém consegue trocar sua senha só sabendo seu e-mail.',
  },
  {
    question: "Qual a diferença entre platformAdmin e vendorAdmin?",
    keywords: ["platformadmin", "vendoradmin", "papel", "permissao", "permissão"],
    answer:
      "platformAdmin é o dono da loja e vê tudo. vendorAdmin é um fornecedor e só vê os próprios produtos e os pedidos que contêm produtos dele.",
  },
  {
    question: "Como funciona o endereço comercial do cliente?",
    keywords: ["endereco", "endereço", "comercial", "entrega"],
    answer:
      "No cadastro do cliente, dá pra editar o endereço de entrega e, separadamente, um endereço comercial (opcional) — útil quando o escritório e o local de entrega/CD são diferentes.",
  },
];

# Televendas — tipo de e-commerce para varejo B2C com crediário próprio

> Este documento é a especificação técnica do tipo de e-commerce `televendas`, referenciado a partir de [`SKILL.md`](../SKILL.md). Mescla o que a plataforma Full-Commerce já tem (modelo `wholesale`) com o que foi desenhado no protótipo de apresentação da primeira empresa desse tipo, **Almir Móveis e Eletro** (arquivo `almir-moveis-prototipo.html`).

## Contexto

A plataforma modela hoje um único tipo de negócio: **atacado B2B multi-fornecedor** (`wholesale`, ver seções principais do `SKILL.md`) — clientes CNPJ, múltiplos fornecedores, sem pedido mínimo, frete grátis para CNPJ, roteirização por bairro. É o modelo das empresas "fullcommerce" e "Odoya", já em produção.

**Televendas** é um segundo tipo de negócio, fundamentalmente diferente: **varejo B2C por telemarketing**, com crediário próprio para clientes sem cartão nem crédito na praça. Em vez de um sistema separado, cada empresa desse tipo continua sendo uma `Company` normal da mesma plataforma, banco (Supabase) e admin — só ativa um conjunto diferente de telas e regras via `Company.ecommerceType`.

## O campo `Company.ecommerceType`

```ts
export type EcommerceType = "wholesale" | "televendas";

export interface Company {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  adminDomain?: string;
  active: boolean;
  createdAt: string;
  ecommerceType: EcommerceType; // default "wholesale" para empresas já existentes
}
```

Selecionado no formulário "Nova empresa" (`apps/admin/app/empresas/page.tsx`) como um `<select>` — hoje o form só pede nome/slug. `apiClient.createCompany` (mock + rest, `packages/api-client`) passa a aceitar `ecommerceType` no payload.

Esse campo resolve duas coisas ao mesmo tempo:
1. Quais itens aparecem no menu do admin daquela empresa (`apps/admin/components/AdminShell.tsx`).
2. Qual layout de storefront é renderizado (`apps/storefront`).

## O que muda por tipo

| Área | `wholesale` (atual) | `televendas` (novo) |
|---|---|---|
| Menu admin — mostra | Fornecedores, Roteirização, Promoções, Departamentos | Central de Vendas, Carrinhos Abandonados, Potencial de Recompra |
| Menu admin — some | — | Fornecedores, Roteirização (não existe multi-fornecedor nem zona de entrega no modelo do Almir) |
| Storefront | Vitrines por fornecedor, "Ofertas da Semana", checkout CNPJ-first | Vitrine simples por categoria (móveis/eletro/cestas), preço à vista + parcelado no card, cadastro leve (nome+telefone) antes de montar carrinho |
| Checkout | Endereço → pagamento → cupom → confirmação | Igual, + seleção de condição de crediário (Boleto/Carteira, com/sem entrada) |
| Financeiro | Extrato de pagamentos (já existe) | + filtro por status (pago/a vencer/atrasado) + renegociação de parcela vencida |
| Central de vendas | — | Painel de situação financeira do cliente (parcelas em aberto/vencidas + veredito "liberado para nova venda") antes de montar o pedido |

## Novas entidades / campos (`packages/types`)

### `Installment` (parcela) — entidade nova

Hoje `Order` só guarda `paymentTerm` e `total`; não existe rastreio individual de parcela.

```ts
export interface Installment {
  id: string;
  orderId: string;
  customerId: string;
  companyId: string;
  number: number;              // 1, 2, 3...
  totalCount: number;           // total de parcelas do pedido
  amount: number;
  dueDate: string;
  status: "pending" | "paid" | "overdue";
  paidAt?: string;
  method: "boleto" | "carteira"; // Crediário Boleto (gateway) ou Carteira (dinheiro, cobrança em pessoa)
  renegotiatedFrom?: string;     // id da parcela original, se essa nasceu de uma renegociação
}
```

- **Crediário Boleto**: cada parcela gera um boleto/Pix real via gateway (Asaas ou Mercado Pago — ver `Company.paymentGateway` abaixo), pago pelo cliente por conta própria.
- **Crediário Carteira**: parcela cobrada em dinheiro, marcada como paga manualmente pelo financeiro no admin (sem gateway).
- Status muda para `overdue` automaticamente quando `dueDate` passa sem pagamento registrado.

### `PaymentTerm` — estender

```ts
export interface PaymentTerm {
  id: string;
  companyId: string;
  name: string;                  // "Crediário Boleto — entrada + 10x"
  method: "pix" | "cash" | "card" | "crediario_boleto" | "crediario_carteira";
  installments: { count: number; hasInterest: boolean; interestRate?: number }[];
  downPayment?: { required: boolean; minPercentage?: number }; // entrada — cada condição decide se tem ou não
  appliesTo?: "all" | "has_card" | "no_credit";   // perfil do cliente
  autoApprovalLimit?: number;    // aprovação automática até esse valor
  active: boolean;
}
```

O `PaymentTerm` atual já cobre forma + parcelamento + juros — faltam só `downPayment`, `appliesTo` e `autoApprovalLimit`. A tela **Configurações** ganha o formulário "Nova condição de pagamento" (nome, parcelas, entrada mínima, juros, a quem se aplica, aprovação automática) + lista das condições já criadas, sempre mostrando as variantes com e sem entrada lado a lado.

### `Cart` — cadastro leve para carrinho abandonado

```ts
export interface Cart {
  // ...campos existentes (id, customerId?, items[], couponCode?, updatedAt)
  leadName?: string;   // só usado no fluxo televendas
  leadPhone?: string;
}
```

Regra nova, só para `ecommerceType === "televendas"`: a loja pede nome + telefone **antes** de permitir montar o carrinho — não depende do cadastro completo com CPF que o modelo wholesale usa. Um `Cart` com `leadPhone` preenchido e sem `Order` associado depois de um tempo é o que a tela **Carrinhos Abandonados** lista.

### `Company` — gateway de pagamento próprio

```ts
export interface Company {
  // ...
  paymentGateway?: {
    provider: "asaas" | "mercadopago";
    connected: boolean;
    payoutAccountLabel?: string; // "Banco do Brasil · conta do Almir" — só exibição
  };
}
```

A chave de API (secreta) não fica na tabela `Company` em texto puro — fica num cofre de secrets (Supabase Vault ou variável de ambiente da Edge Function por empresa); a tabela guarda só o status de conexão e o rótulo de exibição. A tela Configurações mostra "Onde o dinheiro cai" com esses dois campos.

## Telas novas do admin (condicionadas a `ecommerceType === "televendas"`)

1. **Central de Vendas** (`/central-vendas`) — busca cliente por CPF → painel de situação financeira (soma de `Installment` `pending`/`overdue` do cliente) → monta pedido → escolhe `PaymentTerm` (sempre com e sem entrada) → confirma (gera `Order` + `Installment[]`).
2. **Carrinhos Abandonados** (`/carrinhos-abandonados`) — lista `Cart` com `leadPhone`, sem `Order`, ordenados por valor — ação "Enviar no WhatsApp" (link `wa.me`, sem telefonia integrada).
3. **Financeiro** (extensão da tela existente) — filtro por `Installment.status` + painel de renegociação: seleciona parcelas `overdue` de um cliente, define nova condição, o sistema fecha as antigas e cria novas `Installment` com `renegotiatedFrom` apontando para elas.
4. **Potencial de Recompra** (`/potencial-recompra`) — clientes com `active=true`, zero `Installment` em `pending`/`overdue`, e último `Order` há mais de N dias, ordenados por soma histórica gasta.

`AdminShell.tsx` precisa saber o `ecommerceType` da empresa logada — o `AdminUser`/contexto de auth passa a carregar também `company: { id, ecommerceType }` no login, e o array `NAV` ganha uma flag `televendasOnly` do mesmo jeito que já existem `platformOnly`/`ownerOnly`.

## Storefront — layout Televendas

`apps/storefront` passa a checar `ecommerceType` da empresa resolvida pelo domínio (mesmo mecanismo que já resolve qual `Company` é dona do domínio acessado) e renderiza layout diferente:

- Vitrine por categoria simples (Móveis, Eletrodomésticos, Cestas Básicas) em vez de vitrines por fornecedor.
- Card de produto mostra preço à vista **e** exemplo de parcelado (usa o `PaymentTerm` ativo da empresa).
- Botão de enviar foto do produto no WhatsApp (usa `StoreSettings.footer.supportPhone`, já existente).
- Fluxo de carrinho pede nome+telefone antes — cadastro completo só acontece se o pedido virar checkout de verdade.
- Checkout ganha a etapa de escolher `PaymentTerm` com Boleto/Carteira, com/sem entrada.

É **um app só**, não dois — a ramificação de layout é um `if (company.ecommerceType === "televendas")` nos componentes de home/catálogo/checkout, sobre os mesmos `packages/types` e `packages/api-client` (mesmo espírito de reaproveitamento já usado entre storefront/mobile).

## 100% reaproveitado, sem nenhuma mudança

`Vendor` (Almir não cadastra nenhum, ou cadastra só ele mesmo), `Category`, fluxo de `OrderStatus`, entidade `Payment` (usada tanto pro boleto/Pix via gateway quanto pro dinheiro do Carteira), `Promotion`, `Customer`/`Address` (endereço com CEP), autenticação Supabase, papéis `platformAdmin`/`vendorAdmin` (Almir só usa `platformAdmin`), deploy Cloudflare Workers, todo o mecanismo de `StoreSettings` (cor de marca, logo, banners, rodapé).

## Fora de escopo por enquanto

- Integração real com Asaas/Mercado Pago (webhooks de pagamento, geração real de boleto/Pix por parcela) — o formato de `Installment`/`Payment` já está desenhado pra isso encaixar depois.
- Push notification de parcela vencida/paga (o app mobile já tem o mecanismo de push pra status de pedido — só reaproveitar).
- Telas de orçamento (`/api/quotes`) — pendência do modelo wholesale, não relacionada ao Televendas.
- App mobile para o modelo Televendas.

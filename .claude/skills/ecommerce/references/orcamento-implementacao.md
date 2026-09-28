# Implementacao das Telas de Orcamento

**Status: plano de implementacao, ainda nao codificado. Escrito em 2026-09-28, a partir de investigacao real do codigo do repositorio.**

## Por que este documento existe

"Telas de orcamento" e a pendencia mais importante do projeto: o backend (`/api/quotes`, `/api/admin/quotes`) ja existe, mas nao ha nenhuma tela - nem na loja, nem no admin - e nem um jeito de sequer criar um orcamento hoje. Tambem e o alicerce da spec `atividades-automaticas.md` (a geracao automatica de Atividades so faz sentido depois que existir onde o vendedor/cliente agir sobre o orcamento parado).

## O que ja existe hoje (confirmado no codigo)

- `POST /quotes` (`supabase/functions/api/index.ts`) exige cliente autenticado (`requireCustomer`).
- Cadastro (`/api/auth/register`) ja exige `documentType`, `document` e ao menos um endereco - ou seja, quem cria orcamento ja tem CPF e endereco.
- `mapQuote()` expoe: `id, quoteNumber, customerId, status, note, quotedTotal?, quotedAt?, responseNote?, createdAt, items[]`.
- `PATCH /admin/quotes/:id` so aceita `status`, `quotedTotal`, `responseNote` - nao existe hoje NENHUM caminho (cliente ou admin) pra converter orcamento em pedido.
- `quote_id` so existe em `quote_items`; nao ha nenhuma referencia de `orders` de volta a um orcamento.
- `POST /orders` busca produto/preco ao vivo a partir do payload - nao reaproveita `quote_items` (que ja tem preco/sku/fornecedor congelados no momento do orcamento).
- Nao existe absolutamente nada relacionado a orcamento em `packages/types`, `packages/api-client` (nem `rest/` nem `mock/`), nem em `apps/storefront`/`apps/admin` - nenhum botao/link pra sequer criar um orcamento na loja hoje.

## Decisao: reaproveitar a tabela `quotes` (nao criar entidade nova)

Adicionar de forma aditiva:
- `quotes.address_id` (uuid, referencia `addresses`) - qual endereco foi confirmado para aquele orcamento.
- `quotes.converted_order_id` (uuid, referencia `orders`) - liga o pedido de volta ao orcamento que o originou, e serve de trava contra conversao duplicada (`if quote.converted_order_id: reject`).
- `status` estendido pra incluir os novos estados intermediarios (alem dos ja existentes `pending`/`quoted`/`rejected`).

Motivo de nao criar entidade separada: `quotes`/`quote_items` ja guardam exatamente o que um pedido precisa (itens com preco/sku/fornecedor ja resolvidos, `company_id`, `customer_id`) - duplicar isso numa entidade de "pre-pedido" seria o mesmo dado, sem ganho real, e exigiria replicar RLS, numeracao (`next_quote_number`) e todo o CRUD do zero. Como o cliente ja tem CPF/endereco desde o cadastro, a diferenca entre "orcamento" e "pre-pedido" na pratica e so qual endereco foi escolhido, nao um novo conjunto de dados obrigatorios - o que enfraquece o argumento de manter conceitos separados.

## Rotas novas no backend (Edge Function)

- `POST /quotes/:id/address` - cliente confirma/anexa o endereco pra aquele orcamento, avanca o status.
- `POST /quotes/:id/convert` - cliente cria o `Order` a partir dos `quote_items` (ja congelados) + `address_id` + forma de pagamento; marca `converted_order_id`.
- `POST /admin/quotes/:id/convert` - mesma acao, chamavel pelo vendedor em nome do cliente.
- Recomendado extrair a logica de calculo de subtotal/frete/desconto/numero do pedido de dentro de `POST /orders` pra uma funcao auxiliar compartilhada, ja que os dois caminhos (carrinho normal e conversao de orcamento) precisam do mesmo calculo.

## Migracao SQL (aplicar no SQL Editor do Supabase - este repo nao versiona schema/migrations)

```sql
alter table ecommerce.quotes
  add column if not exists address_id uuid references ecommerce.addresses(id),
  add column if not exists converted_order_id uuid references ecommerce.orders(id);
```
(Confirmar o nome exato do schema/tabelas em producao antes de rodar.)

## `packages/types` e `packages/api-client`

- `packages/types/src/index.ts` - tipos `Quote`, `QuoteItem`, `QuoteStatus` (novos, hoje nao existem); adicionar `"orcamentos"` a `AdminPermissionKey`.
- `packages/api-client/src/types.ts` - `CreateQuoteInput`; estender `ApiClient` com `createQuote`, `getQuotes`, `getAdminQuotes`, `respondAdminQuote`, `confirmQuoteAddress`, `convertQuoteToOrder`, `convertAdminQuoteToOrder`.
- `packages/api-client/src/rest/index.ts` - implementacao real desses metodos contra as rotas acima.
- `packages/api-client/src/mock/` (novo `quotes-store.ts` + wiring em `mock/index.ts`) - paridade de mock pra dev local.

## Storefront

- `apps/storefront/app/conta/orcamentos/page.tsx` (novo) - lista "Meus orcamentos", mesmo padrao de `apps/storefront/app/conta/pedidos/page.tsx`.
- `apps/storefront/app/orcamento/[id]/page.tsx` (novo) - detalhe: itens/`quotedTotal`/`responseNote`, escolha de endereco (ou novo), botao "Confirmar pedido".
- `apps/storefront/app/conta/page.tsx` - card de acesso (mesmo padrao do card "Ver todos os pedidos").
- Falta tambem o ponto de entrada pra criar orcamento - hoje nao existe nenhum botao "Pedir orcamento" em lugar nenhum. Adicionar em `apps/storefront/app/carrinho/page.tsx` (acao alternativa a "Finalizar compra") e/ou em `apps/storefront/components/AddToCartBar.tsx`.

## Admin

- `apps/admin/app/orcamentos/page.tsx` (novo) - lista todos os orcamentos da empresa, filtro por status, busca por cliente.
- `apps/admin/app/orcamentos/[id]/page.tsx` (novo) - responder (`quotedTotal`/`responseNote`/status) e converter em nome do cliente.
- `apps/admin/components/AdminShell.tsx` - item de navegacao novo ("Orcamentos", mesmo padrao de "Pedidos").
- `apps/admin/components/TeamSection.tsx` - rotulo da permissao nova `"orcamentos"` em `PERMISSION_LABEL`.
- Alternativa mais simples pra permissao: reaproveitar a chave `"pedidos"` ja existente em vez de criar uma nova - mistura dois conceitos na mesma permissao, entao recomendamos a chave nova, mas registrando a alternativa aqui.

## Fora de escopo deste plano

- Escrever o codigo em si - este documento e so o plano.
- Gateway de pagamento real (pendencia separada) - a conversao orcamento->pedido usa a forma de pagamento que o checkout normal ja aceita hoje.
- App mobile.

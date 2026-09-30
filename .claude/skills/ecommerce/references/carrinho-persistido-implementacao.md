# Implementacao do carrinho persistido ("Perdidos")

Resolve duas faltas do carrinho: (1) ele so existia no localStorage do navegador -- trocar de aparelho ou limpar dados do site perdia o carrinho de vez; (2) a equipe de vendas nao tinha visibilidade de "cliente tem produto selecionado mas nao fechou nada", diferente de Pedidos e Orcamentos. Agora o carrinho ATIVO da loja (`apps/storefront/lib/cart-context.tsx`) e sincronizado com o servidor desde o primeiro item adicionado, e o admin ganha uma tela nova, "Perdidos", so de visualizacao.

## Decisoes principais

- `CartItem`/`Cart` sem preco -- `{ productId, quantity }` / `{ id, customerId, items, updatedAt }`. Preco sempre resolvido ao vivo via `Product` (unitPriceOf), nunca congelado -- diferente de `QuoteItem.referenceUnitPrice`.
- So o carrinho ATIVO sincroniza -- os "carrinhos salvos" (pendingCarts, tela /carrinhos) continuam 100% locais.
- `PUT /cart` substitui tudo (delete + insert), nao e incremental.
- Permissao do admin em `GET /admin/carts` reaproveita a chave "pedidos" (mesma de Orcamentos), mas usa `requirePermission` (mais estrito que `/admin/quotes`, que so usa `requireAdmin`).
- `cart_items` tem `company_id` proprio, como toda tabela filha do schema.
- `carts`/`cart_items` tem RLS ligada e ZERO policies -- so o service_role (Edge Function) acessa, mesmo modelo de quotes/quote_items.
- Tela "Perdidos" e so leitura -- sem conversao em pedido a partir dali (carrinho nao tem endereco/pagamento confirmados).
- Gatilho 4 de Atividades Automaticas ("carrinho parado") usa o mesmo prazo fixo de 1 dia do gatilho 1 (orcamento parado), nao configuravel.

## Corrida corrigida na revisao antes de aplicar (hidratacao x sincronizacao)

O primeiro rascunho tinha uma corrida real: o efeito de sincronizacao (dependente de `lines`/`customer`) agendava um debounce de 800ms desde o PRIMEIRO render, quando `lines` ainda e `[]` (o `state` comeca `null`, antes da hidratacao terminar) -- rodando em paralelo com o `GET /cart` da hidratacao, nao depois dele. Se o `GET /cart` demorasse mais que 800ms (cold start de Edge Function e um caso real, nao hipotetico), o timer do carrinho vazio disparava primeiro e mandava `PUT /cart` com `items: []`, apagando o carrinho de verdade do cliente no servidor antes dele nunca ter sido lido -- exatamente o cenario que essa entrega existe pra evitar.

Corrigido com uma ref `hydrated` (ao lado de `skipNextSync`): comeca `false`, e resetada no inicio de cada ciclo de hidratacao (troca de cliente) e so vira `true` depois que a hidratacao termina (sucesso ou falha de rede, sempre). O efeito de sincronizacao ganhou `if (!hydrated.current) return;` logo no inicio -- nenhum PUT sai antes da leitura inicial do servidor terminar, nao importa quanto tempo ela leve.

## Migracao SQL (precisa ser colada no SQL Editor do projeto `admfullcontrolefinanceiro`)

```sql
create table if not exists ecommerce.carts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references ecommerce.companies(id),
  customer_id uuid not null unique references ecommerce.customers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ecommerce.cart_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references ecommerce.companies(id),
  cart_id uuid not null references ecommerce.carts(id) on delete cascade,
  product_id uuid not null references ecommerce.products(id),
  quantity numeric not null
);

create index if not exists idx_cart_items_cart_id on ecommerce.cart_items(cart_id);
create index if not exists idx_carts_company_id on ecommerce.carts(company_id);

alter table ecommerce.carts enable row level security;
alter table ecommerce.cart_items enable row level security;

alter table ecommerce.activities drop constraint activities_source_type_check;
alter table ecommerce.activities
  add constraint activities_source_type_check
  check (source_type is null or source_type in ('quote_stalled', 'customer_inactive', 'no_purchase', 'cart_stalled'));
```

Ver o corpo completo de `ecommerce.gerar_atividades_automaticas()` (com o gatilho 4 novo) direto em producao via `pg_get_functiondef` -- os gatilhos 1-3 nao mudam, so foi adicionado um 4o loop no final selecionando carrinhos (`ecommerce.carts`) com pelo menos 1 item, `updated_at` a mais de 1 dia, e sem atividade aberta com `source_type = 'cart_stalled'` e `source_ref_id = cart.id` ainda em aberto.

## O que falta / fora do escopo

- Nenhuma acao de "converter carrinho em pedido/orcamento" pelo admin na tela Perdidos.
- Filtro por vendorId em `GET /admin/carts` (segue o padrao de /admin/quotes, que tambem nao filtra).
- `handleRequestQuote` (storefront) nao esvazia o carrinho depois de pedir orcamento -- comportamento pre-existente, nao alterado.
- Nenhuma UI pra configurar o prazo de "carrinho parado" (fixo em 1 dia).

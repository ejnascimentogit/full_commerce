-- Força de vendas: Novo pedido digitado pelo vendedor (Comercial -> Vendas -> Pedidos -> + Novo pedido).
-- Só acrescenta: colunas novas com valor padrão e uma tabela nova. Pedidos da loja e conversão de orçamento continuam iguais.

-- Desconto máximo (%) por item que cada perfil de acesso pode dar no Novo pedido. 0 = sem desconto.
alter table ecommerce.access_profiles
  add column if not exists max_discount_percent numeric not null default 0
  check (max_discount_percent >= 0 and max_discount_percent <= 100);

-- Espelho do item: preço de tabela (com promoção automática) e o desconto dado pelo vendedor. unit_price continua sendo o
-- preço líquido cobrado. Itens antigos ficam com list_price nulo e desconto 0.
alter table ecommerce.order_items
  add column if not exists list_price numeric,
  add column if not exists discount_percent numeric not null default 0;

-- Quem digitou: loja (cliente) ou painel (vendedor). Pedidos antigos ficam como 'loja'.
alter table ecommerce.orders
  add column if not exists origin text not null default 'loja' check (origin in ('loja', 'painel')),
  add column if not exists seller_admin_id uuid references ecommerce.admin_users(id) on delete set null,
  add column if not exists seller_name text,
  add column if not exists note text;

-- Rascunhos de pedido por vendedor (salvar e terminar depois, de qualquer aparelho).
create table if not exists ecommerce.order_drafts (
  id uuid primary key,
  company_id uuid not null references ecommerce.companies(id) on delete cascade,
  admin_id uuid not null references ecommerce.admin_users(id) on delete cascade,
  customer_id uuid not null references ecommerce.customers(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_drafts_admin_idx on ecommerce.order_drafts (company_id, admin_id, updated_at desc);
-- Igual às outras tabelas do schema: RLS ligado sem políticas (só a Edge Function, via service_role, acessa).
alter table ecommerce.order_drafts enable row level security;
grant select, insert, update, delete on ecommerce.order_drafts to service_role;

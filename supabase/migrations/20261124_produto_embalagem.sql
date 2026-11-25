-- Embalagem e venda por embalagem (2026-11-24).
-- Cadastro: Embalagem (texto, ex.: "CX 20KG"), Unidade master (ex.: "CX") e Quant. master (coluna box_quantity, que já
-- existia). Produto padrão (un/kg, sem peso variável) com quant. master > 1 é vendido em embalagens:
-- quantidade 2 = 2 × 20 = 40 × preço unitário (regra em packSizeOf, no app e no servidor).
alter table ecommerce.products
  add column if not exists packaging text check (packaging is null or char_length(packaging) <= 40),
  add column if not exists master_unit text check (master_unit is null or char_length(master_unit) <= 10);

-- Espelho do pedido/orçamento: quant. master, unidade master e embalagem congeladas no item. 1 = não multiplica
-- (todos os itens antigos).
alter table ecommerce.order_items
  add column if not exists pack_size numeric not null default 1 check (pack_size > 0),
  add column if not exists pack_unit text,
  add column if not exists packaging text;
alter table ecommerce.quote_items
  add column if not exists pack_size numeric not null default 1 check (pack_size > 0),
  add column if not exists pack_unit text,
  add column if not exists packaging text;

-- Produtos que estavam como "cx" com preço da caixa passam a ter preço unitário (preço ÷ quant. master) e são vendidos
-- por embalagem. Em 2026-11-24 eram só 3 produtos, todos da empresa demo (Full-Commerce).
update ecommerce.products
set unit_type = 'un',
    base_price = round(base_price / box_quantity, 2),
    sale_price = case when sale_price is null then null else round(sale_price / box_quantity, 2) end,
    master_unit = coalesce(master_unit, 'CX'),
    packaging = coalesce(packaging, 'CX ' || box_quantity || 'UN'),
    updated_at = now()
where unit_type = 'cx' and box_quantity > 1 and not coalesce(is_variable_weight, false);

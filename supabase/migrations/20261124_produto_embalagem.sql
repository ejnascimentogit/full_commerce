-- Embalagem do produto (texto livre, ex.: "CX 12KG"). Só exibição; nulo = não informado.
alter table ecommerce.products
  add column if not exists packaging text check (packaging is null or char_length(packaging) <= 40);

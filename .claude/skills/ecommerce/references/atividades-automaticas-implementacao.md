# Implementacao das Atividades Automaticas

**Status: SQL ja aplicado em producao (Supabase `admfullcontrolefinanceiro`, schema `ecommerce`), codigo de tipos/backend/mock atualizado. Kill switch (`atividade_auto_ativo`) nasce `false` em todas as empresas -- ninguem ve card automatico ate ligar conscientemente. Tela de configuracao (React) e pendencia separada, fora do escopo desta entrega.**

Complementa `.claude/skills/ecommerce/references/atividades-automaticas.md` (spec) e `orcamento-implementacao.md` (pre-requisito do Gatilho 1: `quotes.converted_order_id`/`address_id`, ja implementado e mergeado).

## Decisoes tomadas

- Mecanismo: funcao SQL (`plpgsql`) via `pg_cron`, 1x/dia (11:00 UTC = 08:00 Brasilia) -- sem Edge Function na execucao periodica, insere direto na tabela `activities`.
- Os 4 modos de atribuicao implementados: `manual`, `vendedor_vinculado`, `round_robin_todos`, `round_robin_subconjunto` -- configuravel por empresa via `store_settings`.
- Pedidos `CANCELLED`/`REFUNDED` NAO contam como "compra de verdade" nos gatilhos 2 (cliente inativo) e 3 (cadastrado sem compra) -- decisao do dono do projeto: um pedido cancelado pode ser revertido com um bom argumento de vendas, entao o cliente continua elegivel pra reengajamento em vez de ser tratado como "ja resolvido".
- Dedup via `activities.source_type`/`source_ref_id`: nunca cria um card novo se ja existe um ABERTO (`column <> 'done'`) com a mesma origem.
- `assigned_to_admin_id`/`created_by_admin_id` viram nullable -- cards automaticos podem nascer sem responsavel (`manual`, ou `vendedor_vinculado` sem vinculo) e sempre nascem sem criador humano (`created_by_admin_id = null` identifica "foi o sistema").

## Achado registrado (nao relacionado, so documentado): colunas orfas em `store_settings`

`inactive_customer_days`, `inactive_customer_assign_mode`, `inactive_customer_fixed_admin_id`, `birthday_cards` existem na tabela mas SEM nenhum codigo/tipo/tela usando -- confirmado por grep no repo inteiro. Parecem resquicio de uma tentativa anterior nunca finalizada. Nao foram tocadas nem reaproveitadas nesta implementacao (nomes/formato diferentes do que foi decidido aqui). Ver se vale limpar ou finalizar depois.

## Migracao SQL (ja aplicada em producao -- documentada aqui para referencia futura)

```sql
-- =========================================================================
-- Atividades Automaticas -- schema
-- =========================================================================
alter table ecommerce.activities alter column assigned_to_admin_id drop not null;
alter table ecommerce.activities alter column created_by_admin_id drop not null;

alter table ecommerce.activities add column if not exists source_type text;
alter table ecommerce.activities add column if not exists source_ref_id uuid;

alter table ecommerce.activities
  add constraint activities_source_type_check
  check (source_type is null or source_type in ('quote_stalled', 'customer_inactive', 'no_purchase'));

create index if not exists idx_activities_source
  on ecommerce.activities (company_id, source_type, source_ref_id)
  where source_type is not null;

alter table ecommerce.customers
  add column if not exists assigned_staff_id uuid references ecommerce.admin_users(id);

alter table ecommerce.store_settings
  add column if not exists atividade_auto_ativo boolean not null default false,
  add column if not exists atividade_auto_cliente_inativo_dias integer not null default 30,
  add column if not exists atividade_auto_cadastro_sem_compra_dias integer not null default 15,
  add column if not exists atividade_auto_modo_atribuicao text not null default 'round_robin_todos'
    check (atividade_auto_modo_atribuicao in ('manual', 'vendedor_vinculado', 'round_robin_todos', 'round_robin_subconjunto')),
  add column if not exists atividade_auto_subconjunto_ids uuid[],
  add column if not exists atividade_auto_round_robin_cursor uuid;

-- =========================================================================
-- Funcoes auxiliares (search_path fixo por seguranca)
-- =========================================================================
create or replace function ecommerce.resolver_activity_client(p_company_id uuid, p_customer_id uuid)
returns uuid language plpgsql set search_path = ecommerce, public as $$
declare
  v_client_id uuid; v_name text; v_phone text;
begin
  select id into v_client_id from ecommerce.activity_clients
  where company_id = p_company_id and customer_id = p_customer_id limit 1;
  if v_client_id is not null then return v_client_id; end if;
  select name, phone into v_name, v_phone from ecommerce.customers where id = p_customer_id;
  insert into ecommerce.activity_clients (company_id, customer_id, name, phone, health, created_at)
  values (p_company_id, p_customer_id, v_name, v_phone, 'green', now())
  returning id into v_client_id;
  return v_client_id;
end;
$$;

create or replace function ecommerce.avancar_round_robin_atividades(p_company_id uuid, p_subset uuid[])
returns uuid language plpgsql set search_path = ecommerce, public as $$
declare v_cursor uuid; v_next uuid;
begin
  select atividade_auto_round_robin_cursor into v_cursor from ecommerce.store_settings
  where company_id = p_company_id for update;
  select id into v_next from ecommerce.admin_users
  where company_id = p_company_id and role = 'staff' and active = true
    and 'atividades' = any(permissions) and (p_subset is null or id = any(p_subset))
    and (v_cursor is null or id > v_cursor) order by id limit 1;
  if v_next is null then
    select id into v_next from ecommerce.admin_users
    where company_id = p_company_id and role = 'staff' and active = true
      and 'atividades' = any(permissions) and (p_subset is null or id = any(p_subset))
      order by id limit 1;
  end if;
  if v_next is not null then
    update ecommerce.store_settings set atividade_auto_round_robin_cursor = v_next where company_id = p_company_id;
  end if;
  return v_next;
end;
$$;

create or replace function ecommerce.resolver_responsavel_atividade(
  p_company_id uuid, p_modo text, p_customer_id uuid, p_subconjunto uuid[]
) returns uuid language plpgsql set search_path = ecommerce, public as $$
declare v_assigned uuid;
begin
  if p_modo = 'manual' then return null;
  elsif p_modo = 'vendedor_vinculado' then
    select assigned_staff_id into v_assigned from ecommerce.customers where id = p_customer_id;
    return v_assigned;
  elsif p_modo = 'round_robin_todos' then
    return ecommerce.avancar_round_robin_atividades(p_company_id, null);
  elsif p_modo = 'round_robin_subconjunto' then
    return ecommerce.avancar_round_robin_atividades(p_company_id, p_subconjunto);
  else return null;
  end if;
end;
$$;

-- Funcao principal -- ver corpo completo aplicado em producao (migracao
-- atividades_automaticas_funcoes no Supabase); gatilhos 2 e 3 excluem
-- pedidos CANCELLED/REFUNDED da definicao de "ja comprou"/"ultima compra".
-- create or replace function ecommerce.gerar_atividades_automaticas() ...

-- =========================================================================
-- Agendamento
-- =========================================================================
create extension if not exists pg_cron with schema extensions;
select cron.schedule('gerar-atividades-automaticas', '0 11 * * *',
  $$ select ecommerce.gerar_atividades_automaticas(); $$);

-- select * from cron.job;  -- confirmar agendamento
-- select * from cron.job_run_details order by start_time desc limit 20;  -- historico
-- select cron.unschedule('gerar-atividades-automaticas');  -- desagendar
```

## O que falta (fora do escopo desta entrega)

- Tela de configuracao (React) em `apps/admin` -- liga/desliga, prazos (X/Y dias), modo de atribuicao, lista do subconjunto.
- Campo "Vendedor vinculado" na tela de edicao de cliente do admin (backend ja aceita via `PATCH /admin/customers/:id` com `assignedStaffId`).
- Ligar `atividade_auto_ativo = true` para a(s) empresa(s) que quiserem usar (so depois que a tela existir, ou manualmente via SQL Editor para testar antes).

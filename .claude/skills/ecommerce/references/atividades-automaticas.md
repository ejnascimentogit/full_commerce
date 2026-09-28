# Atividades automaticas - orcamento parado e cliente inativo

**Status: nao implementado - pendencia documentada, revisada em 2026-09-28.**

> Terceira revisao deste documento (anteriores: 2026-09-12, 2026-09-16). Nesta revisao, um agente leu o codigo real do backend de orcamentos e do fluxo de carrinho/login, confirmando e simplificando pontos que antes eram suposicao. Ver tambem `.claude/skills/ecommerce/references/orcamento-implementacao.md`, o plano concreto de implementacao da pendencia "Telas de orcamento" (rotas, arquivos, migracao) que motivou esta revisao.

## Contexto

Hoje toda `Activity` (card do quadro de reengajamento) nasce de uma acao manual de alguem da equipe. Nao existe nenhum gatilho automatico. A ideia registrada aqui: gatilhos que, quando disparados, criam uma `Activity` automaticamente.

## Confirmado: nao existe carrinho anonimo

Investigacao direta no codigo confirmou: login e exigido antes de qualquer item entrar no carrinho. `apps/storefront/components/AddToCartBar.tsx` e `apps/storefront/components/ProductCard.tsx` chamam `requireLogin()`/checam `customer` antes de `addItem`; `apps/storefront/lib/cart-context.tsx` zera o estado sem `customer.id`, e a chave do localStorage e `ecommerce.carts.${customerId}`, sem fallback anonimo. Ou seja, o cenario "carrinho de visitante sem nenhum contato" nao existe hoje - nao precisa ser tratado como gatilho.

## Correcao importante: nao existe "cadastro leve" separado de "cadastro completo"

A versao anterior deste documento descrevia um funil em 2 estagios (Orcamento = cadastro leve nome/e-mail/telefone; Pre-pedido = cadastro completo com endereco+CPF). **Isso nao bate com o backend real**: `POST /quotes` exige `requireCustomer` (cliente ja autenticado), e `/api/auth/register` ja exige `documentType`, `document` (CPF/CNPJ) e ao menos um endereco no cadastro. Ou seja, todo cliente que consegue criar um orcamento ja tem CPF e endereco cadastrados - nao existe hoje nenhum caminho de orcamento por lead/visitante sem conta.

Na pratica, "completar o pedido" depois do orcamento nao e preencher dado novo obrigatorio - e so escolher/confirmar qual endereco (dentre os ja cadastrados, ou um novo) usar para aquela compra especifica, e a forma de pagamento.

## Gatilho unico: orcamento parado

Os antigos gatilhos "orcamento parado" e "pre-pedido parado" viram um so, porque o contato do cliente ja existe desde a criacao do orcamento, independente de qual passo ele esta:

**Regra**: orcamento criado e nao convertido em `Order` ate o dia seguinte.

Titulo/descricao da Activity pode variar conforme o estagio (`status` do orcamento - ver `orcamento-implementacao.md`): se ainda nao foi respondido pelo vendedor, se ja foi respondido mas o cliente nao confirmou endereco, ou se o endereco ja foi confirmado e falta so a forma de pagamento - mas e sempre o mesmo gatilho, mesma tabela, mesmo mecanismo.

## Os tres gatilhos automaticos (era quatro)

| # | Gatilho | Regra | Depende de dado que falta? |
|---|---|---|---|
| 1 | Orcamento parado | Criado e nao virou `Order` ate o dia seguinte | Nao - decidido: reaproveitar `quotes`, ver `orcamento-implementacao.md` |
| 2 | Cliente inativo | Ja comprou ao menos 1 vez; ultima compra ha X dias (configuravel por empresa) | Nao |
| 3 | Cadastrado sem compra | Nunca comprou; Y dias desde o cadastro (configuravel por empresa) | Nao |

X e Y sao configuraveis por empresa, nao fixos no codigo - precisa de uma tela de configuracao nova (candidato natural: `store_settings`).

## Atribuicao - uma unica regra para os tres gatilhos

A empresa escolhe um modo, que vale igualmente para os 3 gatilhos:

1. **Manual** - supervisor/gerente decide quem atende. UI ainda em aberto: arrastar o card em cima do vendedor, ou reaproveitar o dropdown de "Responsavel" que ja existe hoje.
2. **Vendedor vinculado ao cliente** - nao existe esse campo no schema hoje (so `Customer.regionId`, que e roteirizacao, e `vendorId` de produto, que e fornecedor). Precisa de campo novo, ex: `Customer.assignedStaffId`.
3. **Round-robin entre todos os atendentes** - viavel sem mudanca de schema.
4. **Round-robin entre um subconjunto** - mesma mecanica do item 3, lista configuravel de quem entra no rodizio.

## Pre-requisitos tecnicos

**(a) Modelagem do orcamento parado: DECIDIDO.** Reaproveitar a tabela `quotes` com colunas aditivas (`address_id`, `converted_order_id`) e status estendido. Ver `orcamento-implementacao.md` para o plano completo de rotas/arquivos/migracao.

**(b) `POST /api/admin/activities` precisa aceitar criacao sem responsavel definido**, ou ganhar um caminho de criacao diferente para o sistema (automacao, nao uma pessoa pelo formulario).

**(c) Mecanismo de execucao periodica (cron/scheduled job)** - confirmado que nao existe hoje: nenhum Cron Trigger configurado nos 4 `wrangler.jsonc`, nenhuma Supabase Edge Function agendada.

**(d) Telas de conversao de orcamento** (storefront + admin) - sem isso, a Activity gerada avisa que algo esta parado, mas ninguem tem onde agir de fato. Ver `orcamento-implementacao.md`.

**(e) Tela de configuracao nova** - X dias, Y dias, modo de atribuicao, lista de pessoas elegiveis quando o modo for "subconjunto".

## Nota relacionada, fora do escopo desta spec: PIX com valor travado

Quando o gateway de pagamento real for implementado (pendencia separada), a recomendacao e usar PIX dinamico (QR/Copia e Cola gerado por pedido via um PSP), com o valor exato do pedido embutido no payload, em vez de chave PIX fixa + valor digitado - evita erro de valor e permite confirmacao automatica via webhook.

## Fora de escopo por enquanto

- Qualquer implementacao de codigo - ver `orcamento-implementacao.md` para o plano de implementacao.
- Numero exato de dias para "cliente inativo"/"sem compra".
- UI final do modo de atribuicao manual (arrastar vs. dropdown).
- PSP a escolher pro PIX dinamico.
- Notificacao (push/e-mail/WhatsApp) para quem recebe o card automatico.
- Qualquer coisa relacionada ao tipo `televendas`.

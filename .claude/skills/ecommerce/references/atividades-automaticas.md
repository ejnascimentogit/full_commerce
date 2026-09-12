# Atividades automaticas - carrinho abandonado e cliente inativo

**Status: nao implementado - pendencia documentada em 2026-09-12.**

> Este documento e a especificacao (aspiracional, nao codigo) de uma extensao do modulo de **Gestao de Atividades** (ver SKILL.md e api-contract.md), no modelo `wholesale` - o unico implementado hoje. Nao confundir com **Carrinhos Abandonados** do tipo `televendas` (televendas.md): sao dois conceitos com o mesmo nome, em contextos diferentes, sem nenhum codigo compartilhado.

## Contexto

Hoje toda `Activity` (card do quadro de reengajamento) nasce de uma acao manual de alguem da equipe: vendedor ou financeiro abre "Novo card", escolhe o cliente/lead e o responsavel, e preenche titulo/descricao (`apps/admin/app/atividades/page.tsx`). Nao existe nenhum gatilho automatico.

A ideia registrada aqui: dois gatilhos novos que, quando disparados, criam uma `Activity` automaticamente, sem alguem precisar notar o problema e abrir o card na mao.

## Gatilho 1 - Carrinho abandonado

**Regra definida**: um carrinho que foi criado e nao virou `Order` ate o dia seguinte ja conta como abandonado.

**Por que isso nao da pra implementar como esta hoje**: o carrinho do modelo `wholesale` e inteiramente client-side - confirmado em `apps/storefront/lib/cart-context.tsx`, que guarda linhas do carrinho (`CartLine[]`, e ate multiplos carrinhos "pendentes" por cliente, `SavedCart[]`) so em localStorage do navegador. Nao existe nenhuma chamada de rede pra criar/atualizar carrinho - o primeiro contato com o backend so acontece no checkout, com `POST /api/orders` direto. `packages/api-client/src/rest/index.ts` nao tem nenhuma funcao de carrinho, e api-contract.md (linha 5) e explicito: endpoints de carrinho server-side ainda sao so a especificacao aspiracional, nao implementados.

**Consequencia**: nao tem como o backend saber que um cliente montou um carrinho ontem e nao finalizou - esse dado simplesmente nao chega ao servidor. Ver "Pre-requisitos tecnicos" abaixo.

## Gatilho 2 - Cliente inativo

**Criterio a definir depois** (ex: sem `Order` ou sem qualquer interacao registrada ha N dias). Diferente do carrinho abandonado, este gatilho nao depende de nenhum dado que falte no schema - `Customer` e `Order` ja existem e sao persistidos de verdade.

## O que acontece quando o gatilho dispara

Cria uma `Activity` automaticamente numa raia especifica do Kanban - sugestao deste documento, nao decisao fechada: usar a raia `urgent` ("Fila de Urgencias").

## Atribuicao - decisao pendente

Quem atende o card gerado automaticamente fica em aberto. Tres estrategias propostas:

### 1. Atribuicao manual pelo supervisor/gerente

Ja e como toda `Activity` e criada hoje. O que muda: hoje `POST /api/admin/activities` exige `assignedToAdminId` no corpo - precisa decidir se o card nasce sem responsavel (exige tornar o campo opcional) ou pre-atribuido a um supervisor fixo.

### 2. Direto para o vendedor vinculado ao cliente

**Nao e viavel hoje.** Nao existe nenhum campo de "vendedor/atendente responsavel" no cadastro de `Customer` - o unico vinculo e `Customer.regionId` (roteirizacao, sem relacao com atendimento). O `vendorId` de `Product`/`OrderItem` e fornecedor, conceito homonimo mas diferente. Pre-requisito: criar campo novo (ex: `Customer.assignedStaffId`).

### 3. Round-robin / aleatorio entre vendedores

Viavel tecnicamente sem mudanca de schema - falta decidir quem entra na lista de vendedores elegiveis.

## Pre-requisitos tecnicos

**(a) Carrinho precisa passar a ser persistido no backend** - vale so para o gatilho de carrinho abandonado.

**(b) `POST /api/admin/activities` precisa aceitar criacao sem responsavel definido**, ou ganhar um caminho de criacao diferente para o sistema.

**(c) Precisa de algum mecanismo de execucao periodica (cron/scheduled job)** - confirmado que nao existe hoje: nenhum dos 4 wrangler.jsonc do projeto declara Cron Trigger, e a unica Supabase Edge Function nao tem pg_cron nem function agendada.

## Fora de escopo por enquanto

- Qualquer implementacao de codigo - este documento e so a especificacao da pendencia.
- Numero exato de dias para "cliente inativo".
- Notificacao (push/e-mail/WhatsApp) para quem recebe o card automatico.
- Qualquer coisa relacionada ao tipo `televendas`.

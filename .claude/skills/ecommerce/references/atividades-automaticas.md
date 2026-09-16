# Atividades automaticas - orcamento, carrinho abandonado e cliente inativo

**Status: nao implementado - pendencia documentada e revisada em 2026-09-16.**

> Este documento substitui a primeira versao (2026-09-12) do mesmo tema, incorporando decisoes de negocio tomadas depois: a ligacao com o fluxo de Orcamento (`/quotes`) e um segundo criterio de cliente parado (cadastrado sem nunca comprar). Ainda e especificacao (aspiracional, nao codigo) de uma extensao do modulo de Gestao de Atividades (ver "Gestao de Atividades" em SKILL.md e api-contract.md), no modelo `wholesale`. Nao confundir com Carrinhos Abandonados do tipo `televendas` (televendas.md) - conceitos homonimos, contextos diferentes.

## Funil de conversao: Orcamento -> Pre-pedido -> Pedido

Hoje o backend de `/quotes` (orcamentos) ja existe, mas nao tem nenhuma tela - nem no admin, nem no storefront. A visao de funil combinada com a geracao automatica de atividades ficou assim:

**Estagio 1 - Orcamento**: cadastro leve - nome, e-mail, telefone. E o que `/quotes` ja modela. Baixa friccao, pensado pra capturar intencao de compra o quanto antes.

**Estagio 2 - Carrinho / Pre-pedido**: o cliente completa o cadastro - endereco + CPF (necessarios pra frete e emissao fiscal/PIX, respectivamente). So nesse ponto o orcamento vira um pre-pedido de verdade.

**Conversao em pedido**: a acao de "virar pedido" precisa existir nos dois lados da plataforma:
- **Storefront**: o proprio cliente completa o cadastro e confirma, criando o `Order`.
- **Admin**: o vendedor faz essa mesma conversao em nome do cliente - cobre venda por telefone, ou ajudar um cliente que comecou e nao terminou sozinho.

Isso significa que a antiga pendencia "telas de orcamento (backend pronto, falta UI)" cresce de escopo: nao e so uma tela de listagem, e a tela de conversao nos dois lados.

## Os quatro gatilhos automaticos

| # | Gatilho | Regra | Depende de dado que falta? |
|---|---|---|---|
| 1 | Orcamento parado | Criado e nao virou pre-pedido/pedido ate o dia seguinte | Nao - `/quotes` ja persiste no backend |
| 2 | Pre-pedido parado | Endereco/CPF completos, mas nao virou `Order` ate o dia seguinte | Depende de como o pre-pedido e modelado (ver Pre-requisitos, item a) |
| 3 | Cliente inativo | Ja comprou ao menos 1 vez; ultima compra ha **X dias** | Nao - `Order` ja e persistido; falta so o campo de configuracao de X |
| 4 | Cadastrado sem compra | Nunca comprou; **Y dias** desde o cadastro | Nao - `Customer` ja e persistido; falta so o campo de configuracao de Y |

**X e Y sao configuraveis por empresa, nao fixos no codigo** - cada tenant define sua propria regra de negocio (pode ser 30, 60, 90+ dias). Precisa de uma tela de configuracao nova (mesmo padrao de outras configs do projeto - um `<input type="number">` por empresa, provavelmente em `store_settings` ou tabela equivalente).

Quando qualquer gatilho dispara: gera uma `Activity` automaticamente, titulo/descricao indicando o motivo e o cliente/orcamento envolvido - mesmo padrao descrito na versao anterior deste documento (raia sugerida: `urgent`).

## Atribuicao - uma unica regra para os quatro gatilhos

A empresa escolhe **um modo**, que vale igualmente para os 4 gatilhos acima:

1. **Manual** - supervisor/gerente decide quem atende. **UI ainda em aberto**: arrastar o card em cima do vendedor (interacao nova, mais trabalho de construir) ou reaproveitar o dropdown de "Responsavel" que ja existe hoje ao criar uma Activity (mais simples, sem UI nova).
2. **Vendedor vinculado ao cliente** - direto pro vendedor cadastrado no `Customer`. **Nao viavel hoje**: nao existe esse campo no schema (so existe `Customer.regionId`, que e roteirizacao/entrega, e `vendorId` de produto, que e fornecedor - nada a ver com vendedor/atendente). Precisa de um campo novo, ex: `Customer.assignedStaffId`.
3. **Round-robin entre todos os atendentes** - viavel sem mudanca de schema, so precisa de lista de `people` elegiveis + criterio de rotacao.
4. **Round-robin entre um subconjunto** - mesma mecanica do item 3, mas a empresa escolhe manualmente quais pessoas entram no rodizio (precisa de uma lista configuravel, ex: array de staff ids em alguma config).

## Pre-requisitos tecnicos

**(a) Modelagem do pre-pedido (gatilho 2) ainda em aberto.** Duas formas de resolver, nenhuma decidida:
   - Reaproveitar a propria tabela de `quotes`, com um status/campo indicando "endereco e CPF completos, aguardando confirmacao" - evita criar uma entidade nova, mas mistura dois conceitos (orcamento leve vs. pre-pedido) na mesma tabela.
   - Criar uma entidade propria de pre-pedido - mais claro conceitualmente, mais trabalho de schema.
   - Em qualquer um dos dois casos, o problema original de "carrinho e so client-side/localStorage" (identificado na primeira versao deste documento) deixa de ser bloqueante - o funil agora entra no backend ja no Estagio 1 (Orcamento), entao nao depende mais de persistir um "carrinho" cru antes disso.

**(b) `POST /api/admin/activities` precisa aceitar criacao sem responsavel definido**, ou ganhar um caminho de criacao diferente pro sistema (automacao, nao uma pessoa pelo formulario) - necessario pra qualquer um dos 4 modos de atribuicao, ja que nenhum deles tem uma pessoa preenchendo o formulario manualmente na hora da criacao.

**(c) Mecanismo de execucao periodica (cron/scheduled job)** - confirmado que nao existe hoje: nenhum Cron Trigger configurado nos 4 `wrangler.jsonc`, nenhuma Supabase Edge Function agendada. Precisa escolher um (Cloudflare Cron Trigger chamando endpoint dedicado, ou `pg_cron` no Postgres).

**(d) Telas de conversao de orcamento** (storefront + admin, ver secao do funil acima) - sem isso, a Atividade gerada pelos gatilhos 1 e 2 avisa que algo esta parado, mas ninguem tem onde agir de fato.

**(e) Tela de configuracao nova** - X dias (cliente inativo), Y dias (cadastrado sem compra), modo de atribuicao escolhido, e a lista de pessoas elegiveis quando o modo for "subconjunto". Provavelmente uma secao nova em Configuracoes da empresa, mesmo padrao de outras configs ja existentes no projeto.

## Nota relacionada, fora do escopo desta spec: PIX com valor travado

Levantado na mesma conversa, mas e uma preocupacao do fluxo de **pagamento** do pedido confirmado, nao da geracao de Atividades em si - registrando aqui so pra nao perder o contexto. Hoje o projeto nao tem gateway de pagamento real integrado (pendencia conhecida a parte). Quando for implementado, a recomendacao e usar PIX dinamico (QR/Copia e Cola gerado por pedido via um PSP - Mercado Pago, Efi, Asaas, PagSeguro etc.), com o valor exato do pedido embutido no payload, em vez de uma chave PIX fixa + valor digitado pelo cliente - evita erro de valor e permite confirmacao automatica do pagamento via webhook, vinculado ao pedido certo.

## Fora de escopo por enquanto

- Qualquer implementacao de codigo - este documento e so a especificacao da pendencia.
- Escolha entre as duas formas de modelar o pre-pedido (item a dos pre-requisitos).
- UI final do modo de atribuicao manual (arrastar vs. dropdown).
- PSP a escolher pro PIX dinamico (nem e parte central desta spec).
- Notificacao (push/e-mail/WhatsApp) para quem recebe o card automatico.
- Qualquer coisa relacionada ao tipo `televendas`.

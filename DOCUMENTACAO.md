# Full-Commerce — Documentação do Projeto

E-commerce B2B por atacado (inspirado no modelo do [Praso](https://praso.com.br)), multi-fornecedor, com loja, painel administrativo e o modelo pronto para app mobile depois. Este documento resume tudo que foi construído até agora, como rodar, e o que ainda falta.

> Para as regras de negócio detalhadas e o contrato de API que o backend real deve seguir, veja [`.claude/skills/ecommerce/SKILL.md`](.claude/skills/ecommerce/SKILL.md) e [`references/api-contract.md`](.claude/skills/ecommerce/references/api-contract.md) — esses arquivos são a fonte de verdade técnica; este documento é a visão geral para humanos.

## Estado atual (importante)

**Os apps publicados (loja e admin) já rodam com o backend real** — banco de dados de verdade, não mais mock. `NEXT_PUBLIC_API_MODE=rest` está configurado nas duas Workers do Cloudflare.

- **Autenticação**: Supabase Auth (senha com hash de verdade) para clientes e admins
- **Banco**: Postgres, schema `ecommerce` do projeto Supabase `admfullcontrolefinanceiro` (separado do schema `public`, que é do financeiro)
- **Arquivos**: Supabase Storage para fotos de produto e logo
- **API**: Supabase Edge Function (`supabase/functions/api/index.ts`) implementando o contrato de [`api-contract.md`](.claude/skills/ecommerce/references/api-contract.md) — catálogo, autenticação, pedidos, orçamentos, gestão do admin
- **URL da API**: `https://ijruithwgvxdqhatgwqd.supabase.co/functions/v1`

Testado de ponta a ponta na interface real (cadastro de cliente, login automático, persistência no banco) em 2026-08-23.

**Catálogo vazio por enquanto**: como o banco real começou do zero, não há produtos/categorias/fornecedores cadastrados ainda — os que apareciam antes eram só dados de exemplo do modo mock (que continua existindo em `packages/api-client/src/mock`, usado só em desenvolvimento local se `NEXT_PUBLIC_API_MODE` não estiver definido). Cadastre produtos pelo admin para a loja mostrar algo.

**Modo mock (para desenvolvimento local)**: rodando localmente sem definir `NEXT_PUBLIC_API_MODE=rest`, os apps voltam a usar `localStorage` — útil para testar sem depender de internet/Supabase. Nesse modo, cada navegador/dispositivo tem seu próprio `localStorage` isolado (uma conta criada no celular não aparece no computador).

## Estrutura do repositório

```
E-commerce/
├── apps/
│   ├── storefront/     # loja do cliente (Next.js) — porta 3000
│   └── admin/           # painel administrativo (Next.js) — porta 3001
├── packages/
│   ├── types/            # tipos TypeScript compartilhados (Product, Order, Customer, StoreSettings...)
│   └── api-client/        # regras de negócio + camada de dados (mock hoje, REST depois)
├── .claude/skills/ecommerce/   # regras de negócio e contrato de API para quem for programar aqui
└── DOCUMENTACAO.md              # este arquivo
```

## Como rodar localmente

```bash
npm install
npm run dev:storefront   # loja em http://localhost:3000
npm run dev:admin        # admin em http://localhost:3001
```

## Deploy

Loja e admin publicados no **Cloudflare Workers** via adapter OpenNext (`wrangler.jsonc` + scripts `cf:build`/`cf:deploy` em cada app), ambos com deploy automático a cada push no branch `main` do repositório `full_commerce`:

- Loja: https://fullcommerce-storefront.ejnascimento1.workers.dev
- Admin: https://fullcommerce-admin.ejnascimento1.workers.dev

Observability (Logs + Traces) ativado nos dois Workers para acompanhar erros em produção.

## Testes e CI

O projeto tem testes unitários (**Vitest**) para as regras de negócio puras de `packages/api-client` — frete (`calculateShipping`, `calculateOrderTotals`, roteirização por bairro), cupom/promoção (`isPromotionActive`, `findPromotionByCoupon`, `calculatePromotionDiscount`), CEP (`formatCep`, `lookupCep`) e validação de CPF/CNPJ (`isValidCPF`, `isValidCNPJ`, formatação) — em `packages/api-client/src/*.test.ts`.

```bash
npm run test   # roda a suíte inteira (raiz do monorepo)
```

Um workflow de **GitHub Actions** (`.github/workflows/ci.yml`) roda automaticamente em todo `push` e `pull request` para a branch `main`: instala as dependências (`npm ci`), roda os testes (`npm run test`), o typecheck (`tsc --noEmit`) de `apps/admin` e `apps/storefront`, e o `next build` dos dois apps (funciona sem nenhum segredo real porque, sem `NEXT_PUBLIC_API_MODE=rest` definido, os apps usam o modo mock — ver "Estado atual" acima).

**Regra a manter**: toda nova função de regra de negócio pura (validação, cálculo, etc.) adicionada em `packages/api-client` deve vir acompanhada do teste unitário correspondente. O CI precisa estar verde antes de mergear na `main`.

## Contas de acesso

**Nos sites publicados** (backend real) — não existem contas prontas: crie a sua em **"Criar conta de administrador"** (admin) ou **"Criar uma conta"** (loja). Os dados ficam salvos de verdade no Supabase, acessíveis de qualquer navegador/dispositivo.

**Rodando local em modo mock** (sem `NEXT_PUBLIC_API_MODE=rest`) — contas demo disponíveis:

| App | E-mail | Senha |
|---|---|---|
| Admin — Plataforma | `admin@plataforma.com` | `admin123` |
| Admin — Fornecedor (Seara) | `fornecedor@seara.com` | `vendor123` |
| Admin — Fornecedor (Brilux) | `fornecedor@brilux.com` | `vendor123` |
| Loja | `compras@saborecia.com.br` | `demo123` |

## O que já está pronto

### Loja (storefront)
- Home: vitrine "Ofertas da Semana", **🔥 Mais Vendidos** (calculado dos pedidos reais), **🎁 Produtos Sazonais** (curadoria do admin), vitrines por fornecedor, carrossel de banners
- Catálogo com filtro por departamento e fornecedor, busca
- Página de produto, carrinho, checkout (endereço → pagamento → cupom → confirmação)
- Cadastro com **CEP autopreenchido** (ViaCEP) e validação real de CPF/CNPJ (dígito verificador)
- Login/logout, histórico de pedidos, acompanhamento de pedido com timeline de status
- **Roteirização automática**: a região de entrega do cliente é resolvida pelo bairro do endereço, não escolhida manualmente
- Cupom de desconto real no checkout (%, R$ fixo, frete grátis), com pedido mínimo e frete configuráveis
- Rodapé com formas de pagamento, links de ajuda, redes sociais e dados legais — tudo editável no admin
- Cor de marca, logo e textos da home também editáveis no admin, sem precisar de deploy

### Painel Admin
Dois papéis (`platformAdmin` vê tudo; `vendorAdmin` só o próprio fornecedor):
- **Dashboard** com números de produtos/pedidos/faturamento
- **Produtos**: CRUD completo, upload de fotos (resize automático), preço variável por peso, flag de sazonal
- **Pedidos**: lista + detalhe (espelho do pedido), avanço de status de entrega (só plataforma)
- **Promoções**: CRUD de cupons/descontos, com vigência, valor mínimo, restrição por categoria
- **Fornecedores**, **Roteirização** (zonas de entrega por bairro), **Departamentos** (categorias) — só plataforma
- **Configurações**: cor de marca (com paleta pronta), logo, carrossel de banners, textos da home, rodapé, pedido mínimo e regra de frete grátis, interruptor geral de promoções

## Regras de negócio importantes

- **Espelho do pedido**: o pedido guarda uma cópia congelada dos itens no momento da compra — mudar preço de um produto depois não altera pedidos já feitos.
- **Preço variável por peso**: produtos como carnes/queijos têm preço estimado no pedido, ajustável depois pelo peso real.
- **Multi-fornecedor**: cada produto pertence a um fornecedor (`Vendor`), mas a entrega é centralizada pela plataforma — não vira "pedidos separados" por fornecedor.
- **Tudo configurável, nada fixo no código**: pedido mínimo, frete grátis para CNPJ, cor, logo, textos, rodapé — todos têm um valor padrão sensato, mas o admin pode mudar qualquer um deles em Configurações.
- **SKU (código do produto) é gerado pelo sistema, nunca digitado**: cada empresa tem um número sequencial (fullcommerce = 1, próxima empresa = 2...), e cada produto ganha `{número da empresa}{sequencial de 5 dígitos}` — empresa 1 → `100001`, `100002`...; empresa 2 → `200001`, `200002`... Gerado uma vez na criação (`next_product_code` no banco) e nunca editável depois, pra eliminar o risco de o admin digitar por engano o código de outro produto. O "Código de referência do cliente" (campo opcional, separado do SKU) também não pode repetir dentro da mesma empresa — o sistema recusa o cadastro/edição se o código já estiver em uso por outro produto.
- **Login de equipe com permissão por aba**: além de `platformAdmin` (acesso total) e `vendorAdmin` (fornecedor, só os próprios produtos/pedidos), existe o papel `staff` — logins de vendedor, financeiro etc. criados pelo próprio `platformAdmin` da empresa em Configurações → Equipe. Cada `staff` só acessa as abas marcadas na criação (Produtos, Pedidos, Clientes, Financeiro, Promoções, Departamentos, Fornecedores, Atividades) — Empresas e Configurações nunca são concedíveis a esse papel. O acesso é checado tanto no menu do admin quanto no backend (`requirePermission`), não só escondido visualmente. Tem também um cadastro livre de "Cargo/Setor" (ex: Vendedor, Financeiro, Televendas) só pra identificar a pessoa na lista, sem afetar permissão.

## Multi-tenant: tipos de e-commerce

Cada `Company` cadastrada em **Empresas** roda isolada (produtos, clientes, configurações próprias). Até aqui, tudo neste documento descreve o tipo `wholesale` (atacado B2B, fullcommerce e Odoya). Está sendo desenhado um segundo tipo, `televendas` — varejo B2C por telemarketing com crediário próprio, primeira empresa: **Almir Móveis e Eletro** — que ativa telas diferentes no admin (Central de Vendas, Carrinhos Abandonados, Potencial de Recompra) e um layout de storefront diferente, sem alterar o comportamento de nenhuma empresa `wholesale` já existente. Especificação completa em [`.claude/skills/ecommerce/references/televendas.md`](.claude/skills/ecommerce/references/televendas.md).

## Pendências conhecidas

- [x] Migrar o código para o repositório `full_commerce`
- [x] Deploy do painel admin no Cloudflare
- [x] Criar o schema `ecommerce` no Supabase do projeto `admfullcontrolefinanceiro` (separado do schema `public` do financeiro) — tabelas espelhando `packages/types`, RLS ativado sem políticas (só a Edge Function, via service_role, acessa)
- [x] Construir o backend real (Supabase Edge Function, testado: cadastro, login, catálogo, pedidos)
- [x] Ativar o modo `rest` nos apps publicados — loja e admin já falam com o banco real em produção
- [x] Cadastrar produtos/categorias/fornecedores reais pelo admin (catálogo com produtos reais, fornecedores e zonas de entrega cadastrados)
- [ ] Telas de orçamento ("peça um orçamento sem compromisso") na loja e no admin — backend já pronto (`/api/quotes`, `/api/admin/quotes`), falta só a interface
- [ ] Carrossel de rolagem para a vitrine "Ofertas da Semana" (hoje é grid)
- [ ] App mobile (React Native) — o domínio (`packages/types`, `packages/api-client`) já foi desenhado para ser reaproveitado
- [ ] Extrato de pagamento e integração real com gateway (cartão/PIX) — o fluxo de checkout já está pronto para plugar
- [ ] Implementar o tipo de e-commerce `televendas` (campo `Company.ecommerceType`, entidade `Installment`, telas Central de Vendas/Carrinhos Abandonados/Potencial de Recompra) — especificação pronta em `televendas.md`, código ainda não iniciado
- [ ] Domínio próprio (o pendente combinado antes era usar DuckDNS) apontando para os Workers, em vez do `*.workers.dev`
- [ ] Geracao automatica de Atividades para orcamentos parados e clientes inativos, com atribuicao configuravel - spec revisada em `.claude/skills/ecommerce/references/atividades-automaticas.md`, plano de implementacao das telas de orcamento em `.claude/skills/ecommerce/references/orcamento-implementacao.md`
- [ ] Produtos relacionados na loja: quando o cliente escolher um produto, mostrar tambem os produtos semelhantes, os derivados e os que formam combo/kit (hoje a pagina do produto nao sugere nada). Falta definir como cadastrar essa relacao no admin (produtos relacionados e combos) e onde exibir (pagina do produto e carrinho).


## Aparência: modo escuro e intensidade das linhas

Cada pessoa pode escurecer as linhas e contornos (bordas de cards, tabelas, divisórias e campos) com uma barra **Suave ↔ Forte**, pra ficar mais legível. É uma preferência **pessoal**, guardada só no navegador de quem mexeu (localStorage, chave `ecommerce.lineStrength`): não vai pro banco e não muda o que os outros veem. 0 = padrão (o visual de sempre); 100 = linhas bem escuras. O botão "↺ Padrão" volta pra 0.

- **Onde fica:** admin → menu lateral, bloco "Aparência" (acima do nome do usuário); loja → rodapé, linha "Aparência · linhas".
- **Como funciona:** a variável `--line-strength` (0–100) fica no `<html>`. Em `apps/*/app/globals.css` as bordas e divisórias `slate-100/200/300` são misturadas (`color-mix`) com `#0f172a` em até 65%; com 0 a cor é idêntica à original. O `layout.tsx` de cada app aplica o valor salvo no `<head>`, antes da primeira pintura (sem piscar), junto do script da paleta da marca.
- **Arquivos:** `components/AppearanceControl.tsx` (idêntico nos dois apps), `app/globals.css`, `app/layout.tsx`, `components/AdminShell.tsx` (admin) e `components/Footer.tsx` (loja).
- **O que não escurece:** destaques com cor (ex.: `hover:border-brand-500` no card de produto) e bordas que não usam `slate-100/200/300`. Pra um componente novo participar, use essas classes de borda.
- **Ajustar o máximo:** `--line-mix: calc(var(--line-strength) * 0.65%)` em `globals.css` (0.65 = 65% de mistura no 100); `#0f172a` é o tom escuro da mistura.
- **Origem:** a ideia vem do menu "Aparência" do RS CRM (Intelipulse): barra Suave/Forte com botão "Padrão". Um controle assim já existiu num projeto nosso e a documentação dele pode ter se perdido na migração do desktop pro Git; este registro existe pra isso não se repetir.
- **Modo escuro:** interruptor no mesmo bloco "Aparência" (admin: menu lateral; loja: rodapé). Preferencia pessoal, chave `ecommerce.themeMode` (`dark`/`light`); padrão claro. A classe `dark` vai no `<html>` (aplicada pelo `layout.tsx` antes da primeira pintura, junto das linhas). O tema é só CSS em `apps/*/app/globals.css`: reescreve as classes neutras do Tailwind (`bg-white`, `bg-slate-50/100/200/300`, `text-slate-400..900`, `border-slate-100/200/300`, `divide-slate-100/200`) dentro de `@layer utilities`, com `:where(html.dark)` para ter a mesma especificidade de uma classe (ganha das utilities pela ordem, perde para variantes como `:hover`). Campos de formulário (`input/select/textarea`) ganham fundo escuro direto. Com o modo escuro ligado, a barra de linhas CLAREIA as linhas (alvo `--line-target`, `#e2e8f0`; no claro é `#0f172a`).
- **O que o modo escuro não muda de propósito:** azul da marca, menu lateral escuro do admin (usa `bg-slate-900/800`), rodapé da loja, overlays (`bg-black/..`) e o fundo branco das fotos de produto (`.aspect-square.bg-white`). Cor nova fora da escala `slate`/`white` precisa de regra própria em `globals.css`, senão fica igual nos dois modos.
- **Fora do escopo (pendente):** guardar as preferências na conta da pessoa (hoje é por navegador), seguir o modo do sistema operacional e revisar tela a tela do admin (o tema foi validado na loja e na tela de login).


## Permissões do admin (servidor)

Quem pode o quê no admin é decidido **no servidor** (Edge Function `api`), não só no menu: esconder a aba não protege nada se a API aceitar a chamada. Catálogo e cálculo em `supabase/functions/api/permissions.ts` (módulo puro, testado com vitest).

- **Papéis:** dono da plataforma (empresa 1, tela Empresas) · administrador da empresa (`platformAdmin`, tem todas as permissões) · equipe (`staff`, só o que a permissão efetiva liberar). O papel de fornecedor (`vendorAdmin`) existe no código mas está parado: fornecedor **não tem acesso ao admin** (é só um cadastro mostrado na loja), por decisão do dono do projeto.
- **Configurações é só do administrador** e não entra em perfil nenhum: dados da loja (`PATCH /settings`, `POST /settings/logo`), mensagens do WhatsApp, regiões de entrega (`POST/PATCH /regions`), equipe, setores e perfis. No servidor essas rotas usam `requirePlatformAdmin`.
- **Catálogo (17 permissões):** `pedidos.ver/status/ajustar` · `orcamentos.ver/responder/converter` · `perdidos.ver` · `promocoes.ver/editar` · `atividades.acessar` · `produtos.ver/editar` · `clientes.ver/editar` · `departamentos.gerenciar` · `fornecedores.gerenciar` · `financeiro.ver`. A visibilidade dentro de Atividades (setor, supervisor, gerente) segue a regra própria de `visibleAssigneeIds`, fora do catálogo.
- **Modelo:** permissão efetiva = (permissões do perfil + liberadas só pra pessoa) − bloqueadas só pra pessoa; bloqueio individual ganha de qualquer liberação. O administrador poderá ajustar uma única pessoa de um setor sem mudar o perfil dos outros.
- **Etapa 1 (feita):** toda ação do admin passa por `requirePerm`/`requireAnyPerm`/`requirePlatformAdmin`. Enquanto a pessoa não tem perfil, a base é a lista antiga por aba (`admin_users.permissions`), traduzida por `LEGACY_PERMISSIONS` (a aba "pedidos" cobria Pedidos, Orçamentos e Perdidos juntos) — ninguém ganha nem perde acesso na virada, exceto onde o servidor estava aberto. A tela Equipe continua marcando a lista antiga e ela continua valendo.
- **Etapa 2 (a fazer):** tabela de perfis (`access_profiles`), `admin_users.profile_id`, ajustes por pessoa (`permission_grants`/`permission_revokes`), perfil padrão por setor (só sugere para pessoas novas), perfis prontos (Administrador, Vendedor, Financeiro, Atendimento — todos editáveis; o Administrador não pode ser excluído), telas de perfis e equipe e registro de quem mudou o quê. O cálculo já lê esses campos.
- **Listas de apoio:** algumas leituras servem a mais de uma tela e aceitam qualquer uma das permissões (`requireAnyPerm`): produtos (`produtos.ver`, `pedidos.ver` por causa da impressão do pedido, `promocoes.*`) e promoções (`promocoes.ver`, `produtos.*`, por causa do formulário de produto). `financeiro.ver` hoje só libera a tela: os dados vêm de pedidos e clientes (`pedidos.ver`, `clientes.ver`).
- **Travado por teste:** `supabase/functions/api/routes.test.ts` lê o `index.ts` e confere a proteção de cada rota. Rota nova do admin sem permissão faz o teste falhar (só `GET /admin/team-members` e `GET /admin/staff-sectors` podem ficar com "qualquer pessoa do admin"). Para criar rota: use `requirePerm(c, "x.y")`, adicione a permissão ao catálogo se for nova e a linha no teste.
- **Publicar o servidor:** a Edge Function `api` é publicada à parte do site (GitHub Actions não a publica). O arquivo `permissions.ts` precisa subir junto com o `index.ts`.

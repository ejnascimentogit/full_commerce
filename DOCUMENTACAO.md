# Full-Commerce — Documentação do Projeto

E-commerce B2B por atacado (inspirado no modelo do [Praso](https://praso.com.br)), multi-fornecedor, com loja, painel administrativo e o modelo pronto para app mobile depois. Este documento resume tudo que foi construído até agora, como rodar, e o que ainda falta.

> Para as regras de negócio detalhadas e o contrato de API que o backend real deve seguir, veja [`.claude/skills/ecommerce/SKILL.md`](.claude/skills/ecommerce/SKILL.md) e [`references/api-contract.md`](.claude/skills/ecommerce/references/api-contract.md) — esses arquivos são a fonte de verdade técnica; este documento é a visão geral para humanos.

## Estado atual (importante)

O projeto está em **modo mock**: não há banco de dados nem backend reais ainda — os dados vivem em `localStorage` do navegador, simulando uma API através de `packages/api-client`. Isso permite navegar, comprar, e usar o admin de ponta a ponta hoje, sem esperar o backend. Quando o banco/backend real (Supabase ou outro) estiver pronto, troca-se `NEXT_PUBLIC_API_MODE=mock` por `rest` e a aplicação passa a falar com a API real — nenhum componente de tela precisa mudar, pois tudo depende só da interface `ApiClient`.

**Limitação relevante do modo mock:** `apps/storefront` (porta 3000) e `apps/admin` (porta 3001) rodam em origens diferentes, então o `localStorage` de um **não é visto** pelo outro. Um produto criado no admin não aparece automaticamente na loja enquanto estiverem em portas/domínios diferentes — isso deixa de ser um problema assim que o backend real for compartilhado entre os dois.

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

## Contas de acesso

**Admin** (`http://localhost:3001`) — crie a sua em **"Criar conta de administrador"** na tela de login, ou use as contas demo:

| Papel | E-mail | Senha |
|---|---|---|
| Plataforma (acesso total) | `admin@plataforma.com` | `admin123` |
| Fornecedor (Seara) | `fornecedor@seara.com` | `vendor123` |
| Fornecedor (Brilux) | `fornecedor@brilux.com` | `vendor123` |

**Loja** (`http://localhost:3000`) — crie sua conta em "Criar uma conta", ou use a conta demo:

| E-mail | Senha |
|---|---|
| `compras@saborecia.com.br` | `demo123` |

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

## Pendências conhecidas

- [x] Migrar o código para o repositório `full_commerce`
- [x] Deploy do painel admin no Cloudflare
- [ ] Carrossel de rolagem para a vitrine "Ofertas da Semana" (hoje é grid)
- [ ] Conectar banco de dados e backend reais (Supabase ou outro) — trocar `NEXT_PUBLIC_API_MODE` para `rest`
- [ ] App mobile (React Native) — o domínio (`packages/types`, `packages/api-client`) já foi desenhado para ser reaproveitado
- [ ] Cadastro/login de fornecedor (`vendorAdmin`) pelo próprio admin — hoje só existe via seed
- [ ] Extrato de pagamento e integração real com gateway (cartão/PIX) — o fluxo de checkout já está pronto para plugar
- [ ] Domínio próprio (o pendente combinado antes era usar DuckDNS) apontando para os Workers, em vez do `*.workers.dev`

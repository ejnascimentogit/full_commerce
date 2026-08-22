---
name: ecommerce
description: Regras de negócio, entidades de domínio, estrutura de pastas e contrato de API para este projeto de e-commerce full-commerce (loja web + app mobile do cliente + painel admin). Use esta skill sempre que for criar, alterar ou revisar qualquer parte deste projeto — páginas da loja, telas do app mobile, painel administrativo, componentes de produto/carrinho/pedido/pagamento/promoção, tipos compartilhados, ou o cliente de API — mesmo que o pedido não mencione "e-commerce" explicitamente (ex: "adiciona um campo no cadastro de produto", "cria a tela de checkout", "como fica o status do pedido quando sai pra entrega", "cria a tela de pedidos no app"). É a fonte de verdade sobre como o domínio deste projeto (cliente, produto, pedido, pagamento, promoção, entrega) deve ser modelado e nomeado, e sobre o contrato de API REST que o backend (construído separadamente pelo usuário) precisa implementar.
---

# E-commerce — regras do projeto

Este projeto é um **full-commerce B2B por atacado** (inspirado no modelo do [Praso](https://praso.com.br) — não precisa ficar igual, mas segue o mesmo modelo de negócio): loja web para o cliente final (storefront), **app mobile** que o cliente baixa para fazer pedidos, e painel administrativo interno (admin). O público é majoritariamente **empresas (CNPJ)** comprando em volume de **múltiplos fornecedores** dentro da mesma plataforma — não é uma loja de um vendedor só. O usuário constrói banco de dados e backend **separadamente** e conecta depois — por isso o contrato de API abaixo é a peça mais importante desta skill: é o que garante que loja, app e admin construídos agora encaixam sem retrabalho quando o backend chegar.

Características de negócio herdadas do modelo Praso (ver seções abaixo para detalhe): sem pedido mínimo, frete grátis para cliente CNPJ, entrega prometida em janela curta (ex: 24h) dentro de regiões de atendimento cadastradas, catálogo multi-fornecedor com vitrines por fornecedor, preço exibido por unidade/kg/caixa, vitrine de "Ofertas da Semana" em destaque na home.

## Stack e estrutura de pastas

Next.js + React (TypeScript) para storefront e admin. **React Native (Expo)** para o app mobile — mesma linguagem (TypeScript) e o mesmo formato de dados dos outros dois, então `types/` e `api-client/` são reaproveitados 100% sem reescrever nada; só a camada visual é nativa. Todos consumindo a mesma API REST. Monorepo com workspaces:

```
E-commerce/
├── apps/
│   ├── storefront/        # loja do cliente (web)
│   ├── mobile/              # app do cliente (React Native / Expo) — catálogo, carrinho, pedidos, rastreio
│   └── admin/              # painel administrativo (web)
├── packages/
│   ├── types/               # tipos TS compartilhados (Product, Order, Customer, Payment...)
│   ├── api-client/          # cliente HTTP tipado — ver "Camada de API" abaixo — usado pelos 3 apps
│   └── ui/                  # componentes visuais compartilhados — só entre storefront e admin (web/DOM)
└── docs/
    └── api-contract.md      # contrato REST completo (espelha references/api-contract.md desta skill)
```

Motivo do monorepo: produto, pedido, cliente etc. são os mesmos conceitos nos três apps — compartilhar `types/` e `api-client/` evita que storefront, mobile e admin divirjam sobre o formato dos dados ou dupliquem a lógica de chamada de API.

**Importante sobre `packages/ui`:** componentes React web (DOM/HTML) não rodam em React Native — `ui/` é compartilhado apenas entre `storefront` e `admin`. O app `mobile` tem seus próprios componentes visuais (View/Text/etc. do React Native), mas consome os mesmos `types/` e `api-client/`, então a lógica de negócio (cálculo de carrinho, formatação de status de pedido, validação de cupom) deve morar em funções puras dentro de `packages/api-client` ou um `packages/domain` novo — nunca dentro de um componente web — exatamente para poder ser chamada tanto do storefront quanto do app.

### Camada de API — mock agora, real depois

Como o backend ainda não existe, `packages/api-client` deve expor uma **interface** (ex: `getProducts()`, `createOrder()`, `getOrderStatus()`) com duas implementações:
- `mock/` — dados fake em memória/JSON, usada em desenvolvimento agora.
- `rest/` — chamadas HTTP reais ao contrato definido em `references/api-contract.md`.

A troca entre as duas é por variável de ambiente (`NEXT_PUBLIC_API_MODE=mock|rest`). Isso permite construir e demonstrar a loja inteira hoje, e no dia em que o usuário passar a conexão do backend, é só trocar a implementação — nenhum componente de UI deve saber se está falando com mock ou API real.

## Entidades de domínio

Definições em `packages/types`. Nomes de campos em `camelCase` (payload JSON), IDs como `string` (UUID).

- **Customer**: `id, name, email, documentType (cpf|cnpj), document, businessName?, phone, addresses[], regionId?, createdAt, status`. `document` guarda o CPF ou CNPJ conforme `documentType` (validado por dígito verificador real, não só contagem de caracteres) — `businessName` (razão social) só se aplica a `cnpj`. Um cliente pode ter vários `Address`, um marcado `isDefault`. `regionId` **não é escolhido no cadastro** — é resolvido automaticamente casando o `neighborhood` (bairro) do endereço contra as zonas cadastradas pelo admin (ver **Regiões de entrega / roteirização** abaixo); fica `undefined` se o bairro não estiver em nenhuma zona ainda.
- **Vendor** (fornecedor): `id, name, cnpj, logoUrl?, description?, active, isFeatured`. Cada fornecedor cadastrado na plataforma vende seus próprios produtos dentro da mesma loja — é o equivalente às vitrines "Produtos - Fornecedor X" do Praso. `isFeatured` controla se o fornecedor ganha uma seção própria em destaque na home.
- **Product**: `id, vendorId, name, description, sku, categoryId, brand, photos[], unitType (un|kg|cx), basePrice, salePrice?, boxQuantity?, isVariableWeight, avgWeight?, stock, variants[], status, weight, dimensions`. `photos` é array ordenado de URLs com uma marcada como capa. `unitType` define como o preço é exibido (`R$/kg`, `R$/un`, `R$/cx`); quando `unitType = "cx"`, `boxQuantity` guarda quantas unidades tem a caixa. `isVariableWeight` marca itens tipo carnes/queijos vendidos por peça mas precificados por kg (`avgWeight` é o peso aproximado exibido, o preço final pode ser ajustado no fornecimento — ver **Preço variável por peso** abaixo). `variants[]` (ex: tamanho/cor) cada uma com seu próprio `sku`, `stock` e `priceOverride?` opcional.
- **Category**: `id, name, slug, parentCategoryId?` — hierárquica, para permitir subcategorias.
- **DeliveryRegion**: `id, name, active, cutoffTime, estimatedDeliveryHours, neighborhoods[]`. É a unidade de **roteirização**: o admin (`platformAdmin`) cadastra a zona e a lista de bairros que ela cobre (comparação case-insensitive); não existe seleção de região pelo cliente. `cutoffTime` é o horário limite do dia para o pedido entrar na janela de entrega seguinte.
- **PaymentTerm** (condição de pagamento): forma (`card | pix | boleto`), parcelamento (`installments: { count, hasInterest, interestRate? }[]`), desconto à vista.
- **Cart**: `id, customerId?` (nulo para visitante, usar `sessionId`), `items[]` (`productId, variantId?, quantity, unitPriceAtAdd`), `couponCode?`, `updatedAt`. Sem regra de valor mínimo — carrinho pode ser fechado com qualquer valor (ver **Sem pedido mínimo e frete** abaixo).
- **Order**: ver seção **Pedido e espelho do pedido** abaixo — é a entidade mais sensível do domínio.
- **Payment**: `id, orderId, method, status, amount, installments, gatewayTransactionId, paidAt?, pix?: { qrCode, copyPaste, expiresAt }`.
- **Promotion**: `id, type (percentage|fixed|freeShipping|coupon), rules { productIds?, categoryIds?, vendorId?, minOrderValue? }, isFeatured, startsAt, endsAt, couponCode?, maxUses?, currentUses`. `isFeatured` marca promoções que entram na vitrine "Ofertas da Semana" da home.

### Sem pedido mínimo e frete grátis para CNPJ

Duas regras de negócio explícitas herdadas do modelo Praso: (1) o checkout **nunca bloqueia por valor mínimo de carrinho**; (2) o frete é calculado como `0` sempre que `customer.documentType === "cnpj"` — clientes CPF podem ter frete cobrado normalmente. Essa lógica de frete deve morar como função pura em `packages/api-client` (ou `packages/domain`), não espalhada em componente de UI, porque é usada tanto no resumo do carrinho quanto na confirmação do checkout nos três apps.

### Preço variável por peso

Itens como carnes e queijos são vendidos "por peça" mas o preço de tabela é por kg (`isVariableWeight: true`). No carrinho e no checkout, o subtotal desse item é uma **estimativa** baseada em `avgWeight × pricePerKg`. Isso significa que, diferente do restante do pedido, o valor final desses itens pode ser ajustado pelo fornecedor após a separação (peso real pesado no fornecimento) — o espelho do pedido deve guardar tanto o `estimatedSubtotal` quanto, depois de ajustado, um `finalSubtotal?`. Trate isso como uma exceção documentada à regra geral de "preço do pedido nunca muda depois de criado" (seção seguinte).

### Pedido e espelho do pedido (regra crítica)

O **Order** nunca referencia `Product` ao vivo — ele guarda uma **cópia congelada** dos itens no momento da compra (`orderItems[]` com `productId, vendorId, name, sku, unitType, unitPrice, quantity, subtotal` copiados, não recalculados). Isso é o "espelho do pedido": preço e nome do produto podem mudar depois na tabela `Product`, mas o pedido histórico tem que continuar mostrando exatamente o que o cliente comprou e pagou. Qualquer tela ou endpoint de pedido usa esses dados congelados, nunca faz join/lookup no catálogo atual. `vendorId` fica no item (não no pedido) porque um único pedido pode reunir produtos de vários fornecedores — a plataforma centraliza a separação e entrega (assim como o Praso entrega tudo junto independente do fornecedor de origem), então isso não vira "sub-pedidos" separados, é só informação para o admin saber de quem repassar a comissão/pagamento.

```
Order {
  id, orderNumber, customerId,
  items: OrderItem[],          // espelho, imutável após criação (exceto ajuste de peso, ver acima)
  shippingAddress, regionId,
  paymentMethod, paymentTerm,
  subtotal, discount, shipping, total,   // shipping = 0 se customer.documentType === "cnpj"
  status: OrderStatus,
  statusHistory: { status, changedAt }[],
  tracking?: { code, carrier, url },
  createdAt
}
```

## Fluxo de status do pedido

Máquina de estados linear (com desvio possível para cancelamento/estorno em qualquer ponto antes de `DELIVERED`):

```
PENDING → AWAITING_PAYMENT → PAID → PREPARING → OUT_FOR_DELIVERY → DELIVERED
                                                                  ↘ CANCELLED / REFUNDED
```

- `PENDING`: pedido criado, aguardando o cliente escolher/confirmar pagamento.
- `AWAITING_PAYMENT`: aguardando confirmação do gateway (típico do PIX, que não é instantâneo).
- `PAID`: pagamento confirmado pelo banco/gateway — dispara a separação do pedido.
- `PREPARING`: em separação/embalagem — aparece no **painel de pedidos para entrega**.
- `OUT_FOR_DELIVERY`: saiu para entrega — é o gatilho que o cliente vê no acompanhamento ("saiu para entrega").
- `DELIVERED`: entregue — fim do fluxo feliz.
- `CANCELLED` / `REFUNDED`: pode ocorrer a partir de qualquer status anterior a `DELIVERED`.

Toda mudança de status grava uma entrada em `statusHistory` — é isso que alimenta o **painel de pedidos para entrega** (visão interna), a **página de acompanhamento no storefront** e a **tela de acompanhamento no app mobile** (as duas últimas são a mesma visão externa, só em plataformas diferentes) — todas devem ler da mesma fonte, nunca duplicar lógica de status.

No app mobile, o avanço de status (principalmente `OUT_FOR_DELIVERY` e `DELIVERED`) deve disparar **push notification** para o cliente — é o principal motivo de alguém preferir o app à loja web para acompanhar o pedido. O envio da notificação é responsabilidade do backend (guarda o `pushToken` do dispositivo no `Customer` e dispara ao mudar o status), o app só precisa registrar o token no login e tratar a notificação recebida.

## Pagamento (cartão e PIX) — regra de segurança

Cartão e PIX são processados por um gateway/PSP conectado ao banco (ex: Mercado Pago, Pagar.me, Stripe, Cielo — o usuário define qual ao montar o backend). Regra não-negociável: **o frontend nunca fala direto com o gateway usando a chave secreta, e nunca guarda número de cartão**. O fluxo correto:

1. Storefront tokeniza o cartão no navegador com o SDK público do gateway (chave pública) **ou** simplesmente envia os dados ao backend do usuário, que por sua vez fala com o gateway usando a chave secreta.
2. O backend do usuário expõe `POST /api/payments` (ver contrato) — é esse endpoint que o storefront chama, nunca o gateway diretamente.
3. PIX: backend devolve `qrCode` + `copyPaste` + `expiresAt`; o frontend só exibe e faz polling/websocket em `GET /api/payments/:id` até status mudar para `approved`.
4. **Extrato de pagamento** é uma listagem read-only de `Payment` no admin, com filtro por período/status — não recalcula nada, só exibe o que o backend registrou.

## Promoções e alteração de preço

- Alterar `basePrice`/`salePrice` de um produto **não** deve alterar pedidos já feitos (ver espelho do pedido acima).
- Promoções (`Promotion`) são aplicadas no carrinho/checkout, não gravadas permanentemente no produto — o produto mantém seu preço "de tabela"; o desconto é calculado em tempo de carrinho.
- Cupom (`couponCode`) é validado contra `Promotion.rules` e `maxUses` no momento de aplicar no carrinho, e revalidado no checkout antes de criar o `Order`.

## Painel admin — dois papéis, mesma base de código

Por ser multi-fornecedor, `apps/admin` tem duas visões controladas por `role` no usuário logado (`platformAdmin` vs `vendorAdmin`), não dois apps separados — a maior parte da UI (lista de produtos, lista de pedidos) é a mesma tela, só filtrada por `vendorId` quando o papel é `vendorAdmin`:

- **Platform Admin** (a plataforma / você): enxerga tudo — **Fornecedores** (cadastro, ativação, destaque na home), **Roteirização** (cadastra as zonas de entrega e os bairros que cada uma cobre — é isso que resolve o `regionId` de cada cliente), **Categorias**, **Pedidos** de todos os fornecedores, **Painel de Entregas** (view filtrada por `PREPARING`/`OUT_FOR_DELIVERY`, é quem executa a entrega física), **Promoções/Cupons** globais, **Clientes**, **Financeiro** (extrato de pagamentos e repasse por fornecedor), **Configurações** (cor de marca, logo, banners/carrossel da home).
- **Vendor Admin** (cada fornecedor): só vê o que é `vendorId === próprio` — **Produtos** (CRUD, upload de fotos, preço, estoque, variantes), **Pedidos** (só os itens que são dele, sem poder mudar status de entrega — isso é da plataforma), **Promoções** próprias.

Todo endpoint `admin/*` do contrato de API deve aceitar essa distinção — filtrar por `vendorId` do token quando o papel for `vendorAdmin` é responsabilidade do backend, não do frontend.

## Storefront e App Mobile — seções esperadas

`apps/storefront` e `apps/mobile` cobrem exatamente as mesmas telas voltadas ao cliente — só muda a forma (web vs. nativo): Cadastro (nome, documento com validação de dígito verificador, e-mail, senha, **endereço com autopreenchimento por CEP** — consulta um serviço de CEP público e preenche rua/bairro/cidade/estado, cliente só digita número/complemento; a região de entrega é resolvida depois, automaticamente, pelo bairro — não existe seletor de região), Home (com vitrine "Ofertas da Semana" a partir de `Promotion.isFeatured` e vitrines por fornecedor a partir de `Vendor.isFeatured`), Catálogo/busca, Página de produto, Carrinho, Checkout (endereço → forma de pagamento → condição de pagamento → confirmação), Minha Conta (dados cadastrais incluindo CPF/CNPJ, endereços, histórico de pedidos), Acompanhamento de Pedido (timeline lendo `statusHistory`). No app, soma ainda: onboarding/login simplificado (o app deve lembrar a sessão do cliente, sem pedir login toda hora), e permissão de push notification pedida logo após o primeiro login.

## Contrato de API REST

O contrato completo de endpoints (produtos, clientes, carrinho, pedidos, pagamentos, promoções) está em [references/api-contract.md](references/api-contract.md) — consulte antes de implementar qualquer chamada em `packages/api-client/rest`, e mantenha esse arquivo como a especificação que o usuário vai seguir ao construir o backend.

## Convenções de nomenclatura

- Rotas de URL (Next.js): `kebab-case` (`/minha-conta/pedidos`).
- Variáveis, funções, campos de payload JSON: `camelCase`.
- Componentes React: `PascalCase`.
- Enums de status (`OrderStatus`, `PaymentStatus`): `UPPER_SNAKE_CASE` como valor de string (ex: `"OUT_FOR_DELIVERY"`), para bater com o que a maioria dos backends (Node, Java, Python) usa por padrão em enums.
- IDs: sempre `string` (UUID), nunca assumir inteiro auto-incremento — o backend do usuário pode usar qualquer estratégia.

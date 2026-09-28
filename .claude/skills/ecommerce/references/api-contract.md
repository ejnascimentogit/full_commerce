# Contrato de API REST — E-commerce

Especificação que `packages/api-client/rest` implementa e que o backend deve seguir para plugar sem retrabalho no storefront, no app mobile e no admin. Formato de payload: JSON, `camelCase`. Autenticação: `Authorization: Bearer <token>` — o token vem de `Supabase Auth` (retornado por login/registro como `{ token, customer }` ou `{ token, adminUser }`), guardado em `localStorage` pelo `rest/index.ts` e anexado nas chamadas autenticadas. Não usa cookies (loja, admin e a function ficam em domínios diferentes).

**Status:** o backend real já está implementado e publicado como Supabase Edge Function (`supabase/functions/api/index.ts`, projeto `admfullcontrolefinanceiro`, schema `ecommerce`), cobrindo autenticação, catálogo, pedidos, orçamentos e toda a gestão do admin abaixo. URL base: `https://ijruithwgvxdqhatgwqd.supabase.co/functions/v1` (os caminhos já começam com `/api/...`). Endpoints de **carrinho server-side, pagamento (cartão/PIX) e push token** ainda são só a especificação aspiracional — não implementados; o carrinho hoje é local (`lib/cart-context.tsx`) e o checkout chama `/api/orders` direto.

Convenção de resposta de erro (usada em qualquer endpoint abaixo):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "cep inválido" } }
```

## Autenticação e Cliente

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cadastro de cliente (`name, email, password, documentType, document, businessName?, phone, address: { street, number, complement?, neighborhood, city, state, zipCode }`) — backend resolve `regionId` casando `address.neighborhood` contra `DeliveryRegion.neighborhoods` |
| POST | `/api/auth/login` | Login (`email, password`) → retorna `token`, `customer` |
| POST | `/api/auth/forgot-password` | Pede redefinição de senha (`email`) — sempre responde 204, mesmo se o e-mail não existir (evita enumeração). Dispara um e-mail de recuperação de verdade via Supabase Auth (`/auth/v1/recover`); a troca de senha em si acontece em `/conta/redefinir-senha` no storefront, direto contra o Supabase Auth (`PUT /auth/v1/user` com o token do link do e-mail), fora deste backend. **Nunca** aceitar `{email, newPassword}` num passo só — foi assim que a implementação original (herdada do mock) permitia qualquer um que soubesse o e-mail sequestrar a conta. |
| POST | `/api/auth/refresh` | Renova token |
| GET | `/api/customers/me` | Dados do cliente autenticado |
| PATCH | `/api/customers/me` | Atualiza dados cadastrais |
| GET | `/api/customers/me/addresses` | Lista endereços |
| POST | `/api/customers/me/addresses` | Adiciona endereço |
| PATCH | `/api/customers/me/addresses/:id` | Edita endereço |
| DELETE | `/api/customers/me/addresses/:id` | Remove endereço |
| POST | `/api/customers/me/push-token` | Registra `pushToken` do dispositivo (app mobile) para notificações de status de pedido |

## Autenticação Admin

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/admin/auth/register` | Autocadastro do dono da loja como `platformAdmin` (`name, email, password`) — num backend real, travar depois que já existir um platformAdmin (convite, não autocadastro livre) |
| POST | `/api/admin/auth/login` | Login do admin (`email, password`) → `token`, `AdminUser` (`role`, e `vendorId` se `vendorAdmin`) |
| POST | `/api/admin/auth/forgot-password` | Pede redefinição de senha do admin (`email`) — mesmo fluxo em dois passos de `/api/auth/forgot-password`, redirecionando para `/redefinir-senha` no admin em vez de `/conta/redefinir-senha` na loja |
| POST | `/api/admin/auth/logout` | Encerra sessão |
| GET | `/api/admin/auth/me` | Admin autenticado atual, ou `null` |

## Produtos, Categorias e Fornecedores (leitura pública, escrita restrita ao admin)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/products` | Lista com filtros: `?categoryId=&vendorId=&q=&minPrice=&maxPrice=&regionId=&page=&pageSize=` |
| GET | `/api/products/:id` | Detalhe do produto (inclui `photos[]`, `variants[]`, `unitType`, `boxQuantity`, `isVariableWeight`) |
| POST | `/api/products` | *(vendorAdmin)* Cria produto — `vendorId` vem do token, não do payload. `sku` **não é aceito no payload** — sempre gerado pelo backend via `next_product_code(company_id)`: `{número da empresa}{sequencial de 5 dígitos}` (empresa 1 → `100001`, `100002`...; empresa 2 → `200001`...). `customerReferenceCode` (opcional, livre) precisa ser único por empresa — retorna `422 DUPLICATE_REFERENCE_CODE` se já estiver em uso por outro produto |
| PATCH | `/api/products/:id` | *(vendorAdmin, só o dono)* Atualiza produto/preço/estoque — `sku` é ignorado mesmo se enviado (nunca muda depois de criado); mesma regra de unicidade de `customerReferenceCode` do POST |
| DELETE | `/api/products/:id` | *(vendorAdmin, só o dono)* Remove/inativa produto |
| POST | `/api/products/:id/photos` | *(vendorAdmin)* Upload de foto (multipart), retorna URL |
| DELETE | `/api/products/:id/photos/:photoId` | *(vendorAdmin)* Remove foto |
| GET | `/api/categories` | Lista categorias (árvore) |
| POST | `/api/categories` | *(platformAdmin)* Cria categoria/departamento |
| PATCH | `/api/categories/:id` | *(platformAdmin)* Edita nome/ícone/slug |
| DELETE | `/api/categories/:id` | *(platformAdmin)* Remove categoria |
| GET | `/api/vendors` | Lista fornecedores ativos (para vitrines por fornecedor na home) |
| GET | `/api/vendors/:id` | Detalhe do fornecedor |
| POST | `/api/vendors` | *(platformAdmin)* Cadastra fornecedor |
| PATCH | `/api/vendors/:id` | *(platformAdmin)* Atualiza fornecedor (ativo, destaque) |
| GET | `/api/regions?includeInactive=` | Lista zonas de entrega (só ativas por padrão; `includeInactive=true` para o admin gerenciar todas) |
| POST | `/api/regions` | *(platformAdmin)* Cria zona de entrega (roteirização): `name, cutoffTime, estimatedDeliveryHours, neighborhoods[]` |
| PATCH | `/api/regions/:id` | *(platformAdmin)* Edita zona — inclui adicionar/remover bairros de `neighborhoods[]` |

## Carrinho

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/cart` | Carrinho atual (do cliente logado ou da sessão do visitante) |
| POST | `/api/cart/items` | Adiciona item (`productId, variantId?, quantity`) |
| PATCH | `/api/cart/items/:itemId` | Altera quantidade |
| DELETE | `/api/cart/items/:itemId` | Remove item |
| POST | `/api/cart/coupon` | Aplica cupom (`couponCode`) — valida contra `Promotion` |
| DELETE | `/api/cart/coupon` | Remove cupom aplicado |

## Checkout e Pedidos

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/orders` | Cria pedido a partir do carrinho (`shippingAddressId, paymentMethod, installments?, couponCode?`) — congela o espelho do pedido; o desconto do cupom é recalculado/revalidado no backend, nunca confia no valor mostrado no checkout; rejeita com `BELOW_MIN_ORDER_VALUE` se o subtotal ficar abaixo de `StoreSettings.minOrderValue` |
| GET | `/api/orders` | *(cliente)* Lista pedidos do cliente autenticado |
| GET | `/api/orders/:id` | Detalhe do pedido — inclui `items[]` (espelho), `statusHistory[]`, `tracking?` |
| GET | `/api/orders/:id/status` | Só o status atual + histórico — usado para polling leve no acompanhamento |
| PATCH | `/api/orders/:id/status` | *(platformAdmin)* Avança status (`PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`) — dispara push se aplicável. Só a plataforma muda status de entrega, pois é quem entrega fisicamente (mesmo com produto vindo de vários fornecedores) |
| PATCH | `/api/orders/:id/items/:itemId/weight` | *(vendorAdmin, só dono do item)* Registra peso real de item `isVariableWeight`, recalcula `finalSubtotal` |
| GET | `/api/admin/orders` | *(platformAdmin: todos · vendorAdmin: filtrado por `vendorId` do token)* Lista pedidos, com filtro `?status=&vendorId=` — alimenta o painel de entregas |

## Orçamentos (sem compromisso de compra)

Fluxo paralelo ao pedido: o cliente pede um orçamento (sem pagar na hora), o admin responde com um valor, o cliente decide depois. Reaproveita `quotes`/`quote_items` em vez de ser uma entidade separada — ver `.claude/skills/ecommerce/references/orcamento-implementacao.md`.

**Máquina de estados** (`Quote.status`): `requested` (criado pelo cliente) → `quoted` (vendedor respondeu com `quotedTotal`, via `PATCH /api/admin/quotes/:id`) → `accepted` (cliente aceitou o preço — hoje só uma transição de `status`, sem rota dedicada) → [`POST /api/quotes/:id/address` confirma `addressId`] → `converted` (via `POST /api/quotes/:id/convert` ou `POST /api/admin/quotes/:id/convert`, preenche `convertedOrderId`). `rejected`/`expired` são terminais alternativos a partir de `requested`/`quoted`.

Ainda sem tela no storefront/admin — endpoints já existem no backend, prontos para quando a UI for construída (ver `orcamento-implementacao.md`, Parte 2).

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/quotes` | *(cliente)* Cria pedido de orçamento (`items: {productId, quantity}[], note?`) — `status` nasce `requested` |
| GET | `/api/quotes` | *(cliente)* Lista os próprios orçamentos |
| POST | `/api/quotes/:id/address` | *(cliente, dono do orçamento)* Confirma/anexa o endereço de entrega — só permitido com `status === "accepted"`. Body: `{ addressId }` (endereço já cadastrado do próprio cliente) **ou** `{ address: {...} }` (dados de um endereço novo, mesmo formato de `POST /api/auth/register`, criado na hora e vinculado). Atualiza `quotes.addressId` |
| POST | `/api/quotes/:id/convert` | *(cliente, dono do orçamento)* Converte em `Order` de verdade, reaproveitando os `quote_items` (preço/sku/fornecedor já congelados) — `quotedTotal` (quando presente) vira o `subtotal` do pedido, não a soma "de tabela" dos itens. Body: `{ addressId?, paymentMethod, installments? }` — `addressId` é opcional se já foi confirmado via `POST /api/quotes/:id/address`. Recusa com `422 QUOTE_NOT_ACCEPTED` se `status !== "accepted"`, `422 QUOTE_ALREADY_CONVERTED` se `convertedOrderId` já estiver preenchido (trava contra conversão duplicada), `422 ADDRESS_REQUIRED`/`422 ADDRESS_NOT_FOUND` se faltar endereço válido. Sucesso marca `status: "converted"` e preenche `convertedOrderId` |
| GET | `/api/admin/quotes` | *(platformAdmin)* Lista todos os orçamentos da empresa (qualquer status) |
| PATCH | `/api/admin/quotes/:id` | *(platformAdmin)* Responde (`status: "quoted", quotedTotal, responseNote?`) ou recusa (`status: "rejected"`) |
| POST | `/api/admin/quotes/:id/convert` | *(platformAdmin)* Mesma conversão de `POST /api/quotes/:id/convert`, disparada pelo vendedor em nome do cliente (ex: fechou a venda por telefone) — mesmo body e mesmas validações, só não exige que o admin seja o dono do orçamento (exige só que pertença à empresa dele) |

Campos de `Quote` expostos pelo backend (via `mapQuote()`): `id, quoteNumber, customerId, status, note?, quotedTotal?, quotedAt?, responseNote?, addressId?, convertedOrderId?, createdAt, items[]` — `addressId`/`convertedOrderId` são os dois campos novos (colunas `quotes.address_id`/`quotes.converted_order_id`).

## Pagamento

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/payments` | Inicia pagamento de um pedido (`orderId, method: card\|pix, cardToken?, installments?`) — `shipping` já vem calculado pelo backend a partir de `StoreSettings.freeShippingForCnpj`/`shippingCost` |
| GET | `/api/payments/:id` | Status do pagamento — usado para polling do PIX até `approved` |
| POST | `/api/payments/webhook` | *(gateway → backend, não é chamado pelo frontend)* Confirmação assíncrona do banco/gateway |
| GET | `/api/admin/payments` | *(platformAdmin: todos · vendorAdmin: só repasse do próprio fornecedor)* Extrato de pagamentos, filtros `?status=&from=&to=&vendorId=` |

## Promoções

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/promotions/active?featured=true` | Promoções ativas (para exibir banners/selos no catálogo); `featured=true` retorna só as da vitrine "Ofertas da Semana" |
| GET | `/api/promotions/coupon/:code` | Busca promoção por código de cupom para pré-visualizar desconto no checkout — `null` se inválido/expirado/esgotado ou se `StoreSettings.promotionsEnabled` for `false` |
| POST | `/api/admin/promotions` | *(vendorAdmin: própria · platformAdmin: qualquer)* Cria promoção/cupom |
| PATCH | `/api/admin/promotions/:id` | *(vendorAdmin: própria · platformAdmin: qualquer)* Edita/desativa promoção |

## Vitrines calculadas e configurações da loja

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/products/best-sellers?limit=` | Produtos mais vendidos, calculado a partir dos pedidos (soma de quantidade, exclui `CANCELLED`/`REFUNDED`) — não é curadoria manual |
| GET | `/api/settings` | Configuração pública da loja (`brandColor, logoUrl?, banners[], siteCopy, footer, minOrderValue?, freeShippingForCnpj, shippingCost`) |
| PATCH | `/api/admin/settings` | *(platformAdmin)* Atualiza qualquer campo acima — cor, logo (URL), banners, textos do site, rodapé, pedido mínimo, regra de frete |
| POST | `/api/admin/settings/logo` | *(platformAdmin)* Upload da logo (multipart), retorna URL |

## Empresas (multi-tenant, só o operador da plataforma)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/admin/companies` | *(platformOwner — só o admin da empresa 1)* Lista todas as empresas-tenant da plataforma |
| POST | `/api/admin/companies` | *(platformOwner)* Cria empresa nova + `store_settings` padrão — calcula `companyNumber` (prefixo do SKU) e `ecommerceType` (`wholesale` default) |
| PATCH | `/api/admin/companies/:id` | *(platformOwner)* Edita nome/domínio/domínio do admin/ativo |

## Equipe (login "staff", acesso restrito por aba)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/admin/team-members` | *(qualquer admin autenticado da empresa)* Lista os `staff` da própria empresa — usado tanto pra gerenciar equipe (platformAdmin) quanto pra escolher responsável num card de Atividades (staff também precisa ver) |
| POST | `/api/admin/team-members` | *(platformAdmin)* Cria login `staff` (`name, email, password, permissions: string[], department?`) — `permissions` nunca pode incluir `empresas`/`configuracoes` |
| PATCH | `/api/admin/team-members/:id` | *(platformAdmin)* Edita nome/permissões/ativo/cargo de um `staff` da própria empresa |
| GET | `/api/admin/staff-sectors` | *(platformAdmin)* Lista o cadastro de cargos/setores (texto livre, só sugestão pra evitar erro de digitação) |
| POST | `/api/admin/staff-sectors` | *(platformAdmin)* Cadastra um setor novo — `422 DUPLICATE_SECTOR` se o nome já existe na empresa |
| DELETE | `/api/admin/staff-sectors/:id` | *(platformAdmin)* Remove um setor do cadastro |

## Gestão de Atividades (quadro de reengajamento — requer permissão `atividades`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/admin/activity-clients` | Lista clientes/leads do quadro da própria empresa |
| POST | `/api/admin/activity-clients` | Cadastra cliente/lead (`customerId?, name, phone?`) — `customerId` linka a um `Customer` real; ausente = lead |
| PATCH | `/api/admin/activity-clients/:id` | Edita saúde RAG (`health, healthReason?`), `nextContactAt`, nome/telefone |
| GET | `/api/admin/activity-outcomes` | Lista os status de conclusão configurados pela empresa |
| POST | `/api/admin/activity-outcomes` | *(platformAdmin)* Cadastra um status novo (ex: "Convertido em venda") |
| PATCH | `/api/admin/activity-outcomes/:id` | *(platformAdmin)* Edita nome/ordem/ativo |
| GET | `/api/admin/activities` | Lista cards, filtros `?column=&assignedToAdminId=&clientId=&cardNumber=` |
| POST | `/api/admin/activities` | Cria card (`clientId, title, description?, assignedToAdminId, priority?`) — `cardNumber` sequencial por empresa gerado pelo backend (`next_activity_number`), `createdByAdminId` vem do token |
| PATCH | `/api/admin/activities/:id` | Move/edita card — mover pra `column: "done"` **exige** `outcomeId` no mesmo patch, senão `422 OUTCOME_REQUIRED`; seta `completedAt` automaticamente |
| POST | `/api/admin/activities/photos` | Upload de imagem anexada a um card (multipart), retorna URL |

## Notas de implementação

- Endpoints `admin/*` exigem token de usuário com `role: platformAdmin | vendorAdmin` — o backend decide o mecanismo de autorização, mas o `api-client` deve prever um client separado (`adminApiClient`) que sempre manda o token do usuário admin e deixa claro, por tipo, que o resultado pode vir filtrado por fornecedor quando o papel for `vendorAdmin`.
- Todo endpoint de listagem (`GET` de coleção) deve suportar paginação (`page`, `pageSize`) e devolver `{ items: [...], total, page, pageSize }` — mesmo que o backend inicial não pagine de verdade, o formato de resposta já deve prever isso para não quebrar o frontend depois.
- Datas em ISO 8601 (`"2026-08-22T14:30:00Z"`).

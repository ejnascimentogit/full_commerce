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

Fluxo paralelo ao pedido: o cliente pede um orçamento (sem pagar na hora), o admin responde com um valor, o cliente decide depois. Ainda sem tela no storefront/admin — endpoints já existem no backend, prontos para quando a UI for construída.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/quotes` | *(cliente)* Cria pedido de orçamento (`items: {productId, quantity}[], note?`) |
| GET | `/api/quotes` | *(cliente)* Lista os próprios orçamentos |
| GET | `/api/admin/quotes` | *(platformAdmin)* Lista todos os orçamentos pendentes/respondidos |
| PATCH | `/api/admin/quotes/:id` | *(platformAdmin)* Responde (`status: "quoted", quotedTotal, responseNote?`) ou recusa (`status: "rejected"`) |

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

## Notas de implementação

- Endpoints `admin/*` exigem token de usuário com `role: platformAdmin | vendorAdmin` — o backend decide o mecanismo de autorização, mas o `api-client` deve prever um client separado (`adminApiClient`) que sempre manda o token do usuário admin e deixa claro, por tipo, que o resultado pode vir filtrado por fornecedor quando o papel for `vendorAdmin`.
- Todo endpoint de listagem (`GET` de coleção) deve suportar paginação (`page`, `pageSize`) e devolver `{ items: [...], total, page, pageSize }` — mesmo que o backend inicial não pagine de verdade, o formato de resposta já deve prever isso para não quebrar o frontend depois.
- Datas em ISO 8601 (`"2026-08-22T14:30:00Z"`).

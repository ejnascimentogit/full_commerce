# Contrato de API REST — E-commerce

Especificação que `packages/api-client/rest` implementa e que o backend do usuário (construído separadamente) deve seguir para plugar sem retrabalho no storefront, no app mobile e no admin. Formato de payload: JSON, `camelCase`. Autenticação: `Authorization: Bearer <token>` (JWT ou equivalente — o backend decide o mecanismo, o cliente HTTP só precisa de um lugar para guardar/anexar o token).

Convenção de resposta de erro (usada em qualquer endpoint abaixo):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "cep inválido" } }
```

## Autenticação e Cliente

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cadastro de cliente (`name, email, password, documentType, document, businessName?, phone, address: { street, number, complement?, neighborhood, city, state, zipCode }`) — backend resolve `regionId` casando `address.neighborhood` contra `DeliveryRegion.neighborhoods` |
| POST | `/api/auth/login` | Login (`email, password`) → retorna `token`, `customer` |
| POST | `/api/auth/reset-password` | Redefine senha (`email, newPassword`) — no mock não há verificação por e-mail (troca direto se o e-mail existir); backend real deve exigir um token enviado por e-mail antes de aceitar |
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
| POST | `/api/admin/auth/reset-password` | Redefine senha do admin (`email, newPassword`) — mesma ressalva de `/api/auth/reset-password` |
| POST | `/api/admin/auth/logout` | Encerra sessão |
| GET | `/api/admin/auth/me` | Admin autenticado atual, ou `null` |

## Produtos, Categorias e Fornecedores (leitura pública, escrita restrita ao admin)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/products` | Lista com filtros: `?categoryId=&vendorId=&q=&minPrice=&maxPrice=&regionId=&page=&pageSize=` |
| GET | `/api/products/:id` | Detalhe do produto (inclui `photos[]`, `variants[]`, `unitType`, `boxQuantity`, `isVariableWeight`) |
| POST | `/api/products` | *(vendorAdmin)* Cria produto — `vendorId` vem do token, não do payload |
| PATCH | `/api/products/:id` | *(vendorAdmin, só o dono)* Atualiza produto/preço/estoque |
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
| POST | `/api/admin/regions` | *(platformAdmin)* Cria zona de entrega (roteirização): `name, cutoffTime, estimatedDeliveryHours, neighborhoods[]` |
| PATCH | `/api/admin/regions/:id` | *(platformAdmin)* Edita zona — inclui adicionar/remover bairros de `neighborhoods[]` |

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

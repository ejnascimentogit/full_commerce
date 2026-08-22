# Contrato de API REST — E-commerce

Especificação que `packages/api-client/rest` implementa e que o backend do usuário (construído separadamente) deve seguir para plugar sem retrabalho no storefront, no app mobile e no admin. Formato de payload: JSON, `camelCase`. Autenticação: `Authorization: Bearer <token>` (JWT ou equivalente — o backend decide o mecanismo, o cliente HTTP só precisa de um lugar para guardar/anexar o token).

Convenção de resposta de erro (usada em qualquer endpoint abaixo):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "cep inválido" } }
```

## Autenticação e Cliente

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cadastro de cliente (`name, email, password, documentType, document, businessName?, phone, regionId`) |
| POST | `/api/auth/login` | Login (`email, password`) → retorna `token`, `customer` |
| POST | `/api/auth/refresh` | Renova token |
| GET | `/api/customers/me` | Dados do cliente autenticado |
| PATCH | `/api/customers/me` | Atualiza dados cadastrais (inclui trocar `regionId`) |
| GET | `/api/customers/me/addresses` | Lista endereços |
| POST | `/api/customers/me/addresses` | Adiciona endereço |
| PATCH | `/api/customers/me/addresses/:id` | Edita endereço |
| DELETE | `/api/customers/me/addresses/:id` | Remove endereço |
| POST | `/api/customers/me/push-token` | Registra `pushToken` do dispositivo (app mobile) para notificações de status de pedido |

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
| POST | `/api/categories` | *(platformAdmin)* Cria categoria |
| GET | `/api/vendors` | Lista fornecedores ativos (para vitrines por fornecedor na home) |
| GET | `/api/vendors/:id` | Detalhe do fornecedor |
| POST | `/api/vendors` | *(platformAdmin)* Cadastra fornecedor |
| PATCH | `/api/vendors/:id` | *(platformAdmin)* Atualiza fornecedor (ativo, destaque) |
| GET | `/api/regions` | Lista regiões de entrega ativas — usado no seletor de região |

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
| POST | `/api/orders` | Cria pedido a partir do carrinho (`shippingAddressId, paymentMethod, installments?`) — congela o espelho do pedido |
| GET | `/api/orders` | *(cliente)* Lista pedidos do cliente autenticado |
| GET | `/api/orders/:id` | Detalhe do pedido — inclui `items[]` (espelho), `statusHistory[]`, `tracking?` |
| GET | `/api/orders/:id/status` | Só o status atual + histórico — usado para polling leve no acompanhamento |
| PATCH | `/api/orders/:id/status` | *(platformAdmin)* Avança status (`PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`) — dispara push se aplicável. Só a plataforma muda status de entrega, pois é quem entrega fisicamente (mesmo com produto vindo de vários fornecedores) |
| PATCH | `/api/orders/:id/items/:itemId/weight` | *(vendorAdmin, só dono do item)* Registra peso real de item `isVariableWeight`, recalcula `finalSubtotal` |
| GET | `/api/admin/orders` | *(platformAdmin: todos · vendorAdmin: filtrado por `vendorId` do token)* Lista pedidos, com filtro `?status=&vendorId=` — alimenta o painel de entregas |

## Pagamento

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/payments` | Inicia pagamento de um pedido (`orderId, method: card\|pix, cardToken?, installments?`) — `shipping` já vem `0` do backend se `customer.documentType === "cnpj"` |
| GET | `/api/payments/:id` | Status do pagamento — usado para polling do PIX até `approved` |
| POST | `/api/payments/webhook` | *(gateway → backend, não é chamado pelo frontend)* Confirmação assíncrona do banco/gateway |
| GET | `/api/admin/payments` | *(platformAdmin: todos · vendorAdmin: só repasse do próprio fornecedor)* Extrato de pagamentos, filtros `?status=&from=&to=&vendorId=` |

## Promoções

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/promotions/active?featured=true` | Promoções ativas (para exibir banners/selos no catálogo); `featured=true` retorna só as da vitrine "Ofertas da Semana" |
| POST | `/api/admin/promotions` | *(vendorAdmin: própria · platformAdmin: qualquer)* Cria promoção/cupom |
| PATCH | `/api/admin/promotions/:id` | *(vendorAdmin: própria · platformAdmin: qualquer)* Edita/desativa promoção |

## Notas de implementação

- Endpoints `admin/*` exigem token de usuário com `role: platformAdmin | vendorAdmin` — o backend decide o mecanismo de autorização, mas o `api-client` deve prever um client separado (`adminApiClient`) que sempre manda o token do usuário admin e deixa claro, por tipo, que o resultado pode vir filtrado por fornecedor quando o papel for `vendorAdmin`.
- Todo endpoint de listagem (`GET` de coleção) deve suportar paginação (`page`, `pageSize`) e devolver `{ items: [...], total, page, pageSize }` — mesmo que o backend inicial não pagine de verdade, o formato de resposta já deve prever isso para não quebrar o frontend depois.
- Datas em ISO 8601 (`"2026-08-22T14:30:00Z"`).

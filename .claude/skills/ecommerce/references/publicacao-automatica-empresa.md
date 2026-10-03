# Publicacao automatica dos sites de uma empresa

Ao criar uma empresa em Admin -> Empresas, o sistema faz tudo sozinho: cadastro, logins de administrador (senha inicial 123456),
enderecos `<nome>-storefront.ejnascimento1.workers.dev` e `<nome>-admin.ejnascimento1.workers.dev`, e dispara a publicacao dos dois sites.
O botao **Publicar sites** (por empresa) refaz/dispara a publicacao de uma empresa que ja existe (ex: Almir).

## Como funciona

- A loja e o admin sao o MESMO codigo para todas as empresas: a empresa e reconhecida pelo endereco (Origin) na Edge Function.
  Por isso publicar uma empresa nova e rodar o mesmo build com outro nome de worker.
- `POST /api/admin/companies` (e `POST /api/admin/companies/:id/deploy`) definem `domain`/`admin_domain` no padrao acima e chamam a
  API do GitHub para disparar `.github/workflows/deploy-company.yml` com o nome base (primeira palavra do nome da empresa, sem
  acento; se ja existir, acrescenta o numero da filial).
- O workflow compila e publica `apps/storefront` e `apps/admin` (OpenNext + Cloudflare), em paralelo, com
  `NEXT_PUBLIC_API_MODE=rest` e `NEXT_PUBLIC_API_BASE_URL` apontando pra Edge Function.
- O CORS da Edge Function aceita o dominio de qualquer empresa ativa cadastrada em Empresas (nao precisa editar o backend).

## Configuracao unica (segredos)

1. GitHub (Settings -> Secrets and variables -> Actions): `CLOUDFLARE_API_TOKEN` (modelo "Edit Cloudflare Workers") e `CLOUDFLARE_ACCOUNT_ID`.
2. Supabase (Edge Functions -> Secrets): `GITHUB_DEPLOY_TOKEN` = token do GitHub com permissao de **Actions: Read and write** neste repositorio.

Sem o segundo, a empresa e criada normalmente e os enderecos sao definidos, mas a publicacao nao e disparada (a tela avisa
`GITHUB_TOKEN_MISSING`); depois e so usar **Publicar sites**.

## Atencao

- Empresas com sites publicados a mao (ex: Odoya, via `cf:deploy:odoya`) sao substituidas se alguem clicar em Publicar sites.
- Quando o dominio proprio for comprado, o caminho ideal e um unico worker com rota curinga (`*.dominio`), sem publicar nada por empresa.

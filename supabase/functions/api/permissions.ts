// Catálogo de permissões do admin e cálculo da permissão efetiva de uma pessoa da equipe ("staff").
// Módulo puro (sem Deno nem Supabase) de propósito: dá pra testar com vitest. Usado pela Edge Function (index.ts).
//
// Modelo: permissão efetiva = (permissões do perfil + liberadas só pra pessoa) - bloqueadas só pra pessoa. Quem ainda não
// tem perfil usa a lista antiga por aba (`permissions`), traduzida por LEGACY_PERMISSIONS: ninguém ganha nem perde acesso.
// Configurações (loja, mensagens, regiões, equipe e perfis) e Empresas ficam FORA do catálogo de propósito: são só do
// administrador (platformAdmin) e do dono da plataforma.
//
// O catálogo para a tela (nomes e descrições) vive em packages/api-client/src/permissions-catalog.ts; um teste garante que
// as duas listas e as dependências não divergem.

export const PERMISSIONS = [
  "pedidos.ver",
  "pedidos.status",
  "pedidos.ajustar",
  "orcamentos.ver",
  "orcamentos.responder",
  "orcamentos.converter",
  "perdidos.ver",
  "promocoes.ver",
  "promocoes.editar",
  "atividades.acessar",
  "produtos.ver",
  "produtos.editar",
  "clientes.ver",
  "clientes.editar",
  "departamentos.gerenciar",
  "fornecedores.gerenciar",
  "financeiro.ver",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const KNOWN = new Set<string>(PERMISSIONS);

// Chaves antigas (uma por aba) -> permissões novas. A aba "pedidos" cobria Pedidos, Orçamentos e Perdidos juntos.
export const LEGACY_PERMISSIONS: Record<string, readonly Permission[]> = {
  produtos: ["produtos.ver", "produtos.editar"],
  pedidos: ["pedidos.ver", "pedidos.status", "pedidos.ajustar", "orcamentos.ver", "orcamentos.responder", "orcamentos.converter", "perdidos.ver"],
  clientes: ["clientes.ver", "clientes.editar"],
  financeiro: ["financeiro.ver"],
  promocoes: ["promocoes.ver", "promocoes.editar"],
  departamentos: ["departamentos.gerenciar"],
  fornecedores: ["fornecedores.gerenciar"],
  atividades: ["atividades.acessar"],
};

// Dependências: quem age sobre algo precisa poder ver. Perder o "ver" (por perfil ou por ajuste individual) derruba as ações.
export const PERMISSION_REQUIRES: Readonly<Partial<Record<Permission, Permission>>> = {
  "pedidos.status": "pedidos.ver",
  "pedidos.ajustar": "pedidos.ver",
  "orcamentos.responder": "orcamentos.ver",
  "orcamentos.converter": "orcamentos.ver",
  "promocoes.editar": "promocoes.ver",
  "produtos.editar": "produtos.ver",
  "clientes.editar": "clientes.ver",
};

function onlyKnown(list: readonly string[] | null | undefined): Permission[] {
  return (list ?? []).filter((p): p is Permission => KNOWN.has(p));
}

// Limpa uma lista vinda de fora (corpo de requisição): só chaves conhecidas, sem repetir.
export function sanitizePermissionList(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((p): p is Permission => typeof p === "string" && KNOWN.has(p)))];
}

// Acrescenta o "ver" de cada ação da lista (ao salvar um perfil ou uma liberação individual).
export function withRequirements(list: readonly Permission[]): Permission[] {
  const out = new Set<Permission>(list);
  for (const p of list) {
    const need = PERMISSION_REQUIRES[p];
    if (need) out.add(need);
  }
  return [...out];
}

export function expandLegacyPermissions(legacy: readonly string[] | null | undefined): Permission[] {
  const out = new Set<Permission>();
  for (const key of legacy ?? []) {
    if (!Object.prototype.hasOwnProperty.call(LEGACY_PERMISSIONS, key)) continue;
    for (const p of LEGACY_PERMISSIONS[key]) out.add(p);
  }
  return [...out];
}

// Caminho inverso, só pra compatibilidade com telas antigas que ainda leem a lista por aba: a aba aparece se a pessoa pode
// qualquer coisa dentro dela. Quem decide o acesso de verdade é sempre o servidor, pela permissão efetiva.
export function legacyTabsFor(effective: ReadonlySet<Permission>): string[] {
  return Object.entries(LEGACY_PERMISSIONS)
    .filter(([, list]) => list.some((p) => effective.has(p)))
    .map(([key]) => key);
}

export interface PermissionSource {
  role: string; // platformAdmin | staff | vendorAdmin
  permissions?: readonly string[] | null; // lista antiga por aba (usada enquanto não há perfil)
  profilePermissions?: readonly string[] | null; // permissões do perfil da pessoa, quando houver
  grants?: readonly string[] | null; // liberadas só pra esta pessoa
  revokes?: readonly string[] | null; // bloqueadas só pra esta pessoa (ganham de qualquer liberação)
}

export function effectivePermissions(src: PermissionSource): Set<Permission> {
  if (src.role === "platformAdmin") return new Set<Permission>(PERMISSIONS);
  const base = src.profilePermissions != null ? onlyKnown(src.profilePermissions) : expandLegacyPermissions(src.permissions);
  const out = new Set<Permission>(base);
  for (const p of onlyKnown(src.grants)) out.add(p);
  for (const p of onlyKnown(src.revokes)) out.delete(p);
  for (const [action, needs] of Object.entries(PERMISSION_REQUIRES) as [Permission, Permission][]) {
    if (out.has(action) && !out.has(needs)) out.delete(action);
  }
  return out;
}

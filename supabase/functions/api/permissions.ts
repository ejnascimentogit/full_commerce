// Catálogo de permissões do admin e cálculo da permissão efetiva de uma pessoa da equipe ("staff").
// Módulo puro (sem Deno nem Supabase) de propósito: dá pra testar com vitest. Usado pela Edge Function (index.ts).
//
// Modelo: permissão efetiva = (permissões do perfil + liberadas só pra pessoa) - bloqueadas só pra pessoa. Enquanto a
// pessoa não tem perfil (etapa 1), a base vem da lista antiga por aba (`permissions`), traduzida por LEGACY_PERMISSIONS:
// ninguém ganha nem perde acesso na virada. Perfis e ajustes por pessoa entram na etapa 2 (colunas/tabelas novas); o
// cálculo já aceita esses campos. Configurações (loja, mensagens, regiões, equipe e perfis) e Empresas ficam FORA do
// catálogo de propósito: são só do administrador (platformAdmin) e do dono da plataforma.

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

function onlyKnown(list: readonly string[] | null | undefined): Permission[] {
  return (list ?? []).filter((p): p is Permission => KNOWN.has(p));
}

export function expandLegacyPermissions(legacy: readonly string[] | null | undefined): Permission[] {
  const out = new Set<Permission>();
  for (const key of legacy ?? []) {
    if (!Object.prototype.hasOwnProperty.call(LEGACY_PERMISSIONS, key)) continue;
    for (const p of LEGACY_PERMISSIONS[key]) out.add(p);
  }
  return [...out];
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
  return out;
}

import type { AdminUser, PermissionKey } from "@ecommerce/types";

// Catálogo de permissões para a TELA (nomes, descrições, agrupamento). Quem decide o acesso de verdade é o servidor
// (supabase/functions/api/permissions.ts); o teste supabase/functions/api/catalog.test.ts garante que as duas listas batem.

export interface PermissionItem {
  key: PermissionKey;
  label: string;
  description: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  icon: string;
  items: PermissionItem[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "vendas",
    label: "Vendas",
    icon: "🧾",
    items: [
      { key: "pedidos.ver", label: "Ver pedidos", description: "Lista e abre os pedidos da loja." },
      { key: "pedidos.status", label: "Mudar o status do pedido", description: "Marca como pago, separado, enviado, entregue ou cancelado." },
      { key: "pedidos.ajustar", label: "Ajustar itens do pedido", description: "Corrige quantidade ou peso de um item na separação." },
      { key: "orcamentos.ver", label: "Ver orçamentos", description: "Lista e abre os orçamentos pedidos pelos clientes." },
      { key: "orcamentos.responder", label: "Responder orçamentos", description: "Define o valor e responde o cliente." },
      { key: "orcamentos.converter", label: "Converter orçamento em pedido", description: "Fecha a venda em nome do cliente." },
      { key: "perdidos.ver", label: "Ver carrinhos perdidos", description: "Acompanha os carrinhos abandonados pelos clientes." },
    ],
  },
  {
    id: "promocoes",
    label: "Promoções",
    icon: "🏷️",
    items: [
      { key: "promocoes.ver", label: "Ver promoções", description: "Consulta as promoções e cupons cadastrados." },
      { key: "promocoes.editar", label: "Criar e editar promoções", description: "Cria, altera e encerra promoções e cupons." },
    ],
  },
  {
    id: "atividades",
    label: "Atividades",
    icon: "📋",
    items: [
      {
        key: "atividades.acessar",
        label: "Acessar o quadro de Atividades",
        description: "O que a pessoa vê lá dentro continua dependendo do setor e do nível (usuário, supervisor, gerente).",
      },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    icon: "📇",
    items: [
      { key: "produtos.ver", label: "Ver produtos", description: "Consulta o catálogo de produtos." },
      { key: "produtos.editar", label: "Criar e editar produtos", description: "Cadastra produtos, preços, estoque e fotos." },
      { key: "clientes.ver", label: "Ver clientes", description: "Consulta os cadastros dos clientes." },
      { key: "clientes.editar", label: "Editar clientes", description: "Altera dados, endereços e situação dos clientes." },
      { key: "departamentos.gerenciar", label: "Gerenciar departamentos", description: "Cria, altera e remove departamentos (categorias)." },
      { key: "fornecedores.gerenciar", label: "Gerenciar fornecedores", description: "Cadastra e altera os fornecedores (marcas) da loja." },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: "💰",
    items: [{ key: "financeiro.ver", label: "Ver o financeiro", description: "Acompanha faturamento e recebimentos da empresa." }],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

/** Quem age sobre algo precisa poder ver. Espelha PERMISSION_REQUIRES do servidor. */
export const PERMISSION_REQUIRES: Partial<Record<PermissionKey, PermissionKey>> = {
  "pedidos.status": "pedidos.ver",
  "pedidos.ajustar": "pedidos.ver",
  "orcamentos.responder": "orcamentos.ver",
  "orcamentos.converter": "orcamentos.ver",
  "promocoes.editar": "promocoes.ver",
  "produtos.editar": "produtos.ver",
  "clientes.editar": "clientes.ver",
};

/** Lista antiga por aba -> permissões novas. Espelha LEGACY_PERMISSIONS do servidor (só usado enquanto a pessoa não tem a permissão efetiva). */
export const LEGACY_TABS: Record<string, PermissionKey[]> = {
  produtos: ["produtos.ver", "produtos.editar"],
  pedidos: ["pedidos.ver", "pedidos.status", "pedidos.ajustar", "orcamentos.ver", "orcamentos.responder", "orcamentos.converter", "perdidos.ver"],
  clientes: ["clientes.ver", "clientes.editar"],
  financeiro: ["financeiro.ver"],
  promocoes: ["promocoes.ver", "promocoes.editar"],
  departamentos: ["departamentos.gerenciar"],
  fornecedores: ["fornecedores.gerenciar"],
  atividades: ["atividades.acessar"],
};

const ITEM_BY_KEY = new Map<PermissionKey, PermissionItem>(PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i] as const)));

export function permissionLabel(key: PermissionKey): string {
  return ITEM_BY_KEY.get(key)?.label ?? key;
}

/** Liga ou desliga uma permissão respeitando as dependências: ligar uma ação liga o "ver"; desligar o "ver" desliga as ações. */
export function setPermission(current: readonly PermissionKey[], key: PermissionKey, on: boolean): PermissionKey[] {
  const next = new Set<PermissionKey>(current);
  if (on) {
    next.add(key);
    const need = PERMISSION_REQUIRES[key];
    if (need) next.add(need);
  } else {
    next.delete(key);
    for (const [action, needs] of Object.entries(PERMISSION_REQUIRES) as [PermissionKey, PermissionKey][]) {
      if (needs === key) next.delete(action);
    }
  }
  return ALL_PERMISSION_KEYS.filter((k) => next.has(k));
}

type UserLike = Pick<AdminUser, "role" | "permissions" | "effectivePermissions">;

/** A pessoa logada pode isto? Usa a permissão efetiva do servidor; se ela não veio (mock, login antigo), cai na lista antiga por aba. */
export function userCan(user: UserLike | null | undefined, key: PermissionKey): boolean {
  if (!user) return false;
  if (user.role !== "staff") return true;
  if (user.effectivePermissions) return user.effectivePermissions.includes(key);
  return (user.permissions ?? []).some((tab) => LEGACY_TABS[tab]?.includes(key));
}

export function userCanAny(user: UserLike | null | undefined, keys: PermissionKey[]): boolean {
  return keys.some((k) => userCan(user, k));
}

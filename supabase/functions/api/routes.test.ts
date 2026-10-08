import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Trava o mapa "rota -> proteção" da Edge Function. Se alguém criar ou mudar uma rota do admin sem pensar em permissão,
// este teste falha e obriga a decidir (default negado pra equipe). Lê o index.ts como texto: não precisa subir Deno.
const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

function parseGuards(): Record<string, string> {
  const guards: Record<string, string> = {};
  let current = "";
  for (const line of src.split("\n")) {
    const route = line.match(/^app\.(get|post|patch|put|delete)\("([^"]+)"/);
    if (route) {
      current = `${route[1].toUpperCase()} ${route[2]}`;
      continue;
    }
    const guard = line.match(/await (require\w+)\(c(?:, (.*))?\)/);
    if (guard && current && !(current in guards)) guards[current] = guard[2] ? `${guard[1]}(${guard[2]})` : `${guard[1]}()`;
  }
  return guards;
}

const P = (key: string) => `requirePerm("${key}")`;
const PRODUTOS_LOOKUP = 'requireAnyPerm(["produtos.ver", "pedidos.ver", "promocoes.ver", "promocoes.editar"])';
const PROMOCOES_LOOKUP = 'requireAnyPerm(["promocoes.ver", "produtos.ver", "produtos.editar"])';

const EXPECTED: Record<string, string> = {
  "POST /products": P("produtos.editar"),
  "PATCH /products/:id": P("produtos.editar"),
  "POST /products/:id/photos": P("produtos.editar"),
  "GET /admin/products": PRODUTOS_LOOKUP,
  "GET /admin/products/:id": PRODUTOS_LOOKUP,
  "POST /vendors": P("fornecedores.gerenciar"),
  "PATCH /vendors/:id": P("fornecedores.gerenciar"),
  "POST /regions": "requirePlatformAdmin()",
  "PATCH /regions/:id": "requirePlatformAdmin()",
  "GET /admin/customers": P("clientes.ver"),
  "PATCH /admin/customers/:id": P("clientes.editar"),
  "POST /admin/customers/:id/addresses": P("clientes.editar"),
  "PATCH /admin/addresses/:id": P("clientes.editar"),
  "GET /admin/orders": P("pedidos.ver"),
  "GET /admin/orders/:id": P("pedidos.ver"),
  "PATCH /admin/orders/:id/items": P("pedidos.ajustar"),
  "PATCH /orders/:id/status": P("pedidos.status"),
  "GET /admin/quotes": P("orcamentos.ver"),
  "PATCH /admin/quotes/:id": P("orcamentos.responder"),
  "POST /admin/quotes/:id/convert": P("orcamentos.converter"),
  "GET /admin/carts": P("perdidos.ver"),
  "PATCH /settings": "requirePlatformAdmin()",
  "POST /settings/logo": "requirePlatformAdmin()",
  "GET /admin/promotions": PROMOCOES_LOOKUP,
  "POST /admin/promotions": P("promocoes.editar"),
  "PATCH /admin/promotions/:id": P("promocoes.editar"),
  "POST /categories": P("departamentos.gerenciar"),
  "PATCH /categories/:id": P("departamentos.gerenciar"),
  "DELETE /categories/:id": P("departamentos.gerenciar"),
  "GET /admin/activity-clients": P("atividades.acessar"),
  "POST /admin/activity-clients": P("atividades.acessar"),
  "PATCH /admin/activity-clients/:id": P("atividades.acessar"),
  "GET /admin/activity-outcomes": P("atividades.acessar"),
  "POST /admin/activity-outcomes": P("atividades.acessar"),
  "PATCH /admin/activity-outcomes/:id": P("atividades.acessar"),
  "GET /admin/activities": P("atividades.acessar"),
  "POST /admin/activities": P("atividades.acessar"),
  "PATCH /admin/activities/:id": P("atividades.acessar"),
  "POST /admin/activities/photos": P("atividades.acessar"),
};

// Leituras que qualquer pessoa do admin precisa (listas usadas na tela de equipe e de atividades).
const QUALQUER_ADMIN = ["GET /admin/team-members", "GET /admin/staff-sectors"];

describe("mapa de proteção das rotas do servidor", () => {
  const guards = parseGuards();

  it("cada rota sensível tem a permissão esperada", () => {
    for (const [route, expected] of Object.entries(EXPECTED)) expect(guards[route], route).toBe(expected);
  });

  it("nenhuma rota usa a proteção antiga por aba", () => {
    expect(Object.entries(guards).filter(([, g]) => g.startsWith("requirePermission"))).toEqual([]);
  });

  it("nenhuma rota fica só com 'ser do admin', exceto as leituras permitidas", () => {
    const soloAdmin = Object.entries(guards)
      .filter(([, g]) => g === "requireAdmin()")
      .map(([route]) => route)
      .filter((route) => !QUALQUER_ADMIN.includes(route));
    expect(soloAdmin).toEqual([]);
  });
});

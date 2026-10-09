import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSION_KEYS,
  LEGACY_TABS,
  PERMISSION_REQUIRES as TELA_REQUIRES,
  setPermission,
  userCan,
} from "../../../packages/api-client/src/permissions-catalog";
import { LEGACY_PERMISSIONS, PERMISSION_REQUIRES, PERMISSIONS } from "./permissions";

// A tela (packages/api-client) e o servidor (aqui) mantêm cada um a sua cópia do catálogo, porque o servidor roda em Deno e
// não importa os pacotes do monorepo. Este teste falha se uma das cópias for alterada sem a outra.
describe("catálogo da tela x catálogo do servidor", () => {
  it("têm as mesmas permissões, sem repetir", () => {
    expect([...ALL_PERMISSION_KEYS].sort()).toEqual([...PERMISSIONS].sort());
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(ALL_PERMISSION_KEYS.length);
  });
  it("têm as mesmas dependências", () => {
    expect(TELA_REQUIRES).toEqual(PERMISSION_REQUIRES);
  });
  it("têm a mesma tradução das abas antigas", () => {
    expect(LEGACY_TABS).toEqual(LEGACY_PERMISSIONS);
  });
});

describe("setPermission (tela)", () => {
  it("ligar uma ação liga o 'ver'", () => {
    expect(setPermission([], "produtos.editar", true).sort()).toEqual(["produtos.editar", "produtos.ver"]);
  });
  it("desligar o 'ver' desliga as ações", () => {
    expect(setPermission(["pedidos.ver", "pedidos.status", "pedidos.ajustar", "clientes.ver"], "pedidos.ver", false)).toEqual(["clientes.ver"]);
  });
});

describe("userCan (tela)", () => {
  it("administrador pode tudo; equipe segue a permissão efetiva", () => {
    expect(userCan({ role: "platformAdmin" }, "financeiro.ver")).toBe(true);
    expect(userCan({ role: "staff", effectivePermissions: ["pedidos.ver"] }, "pedidos.ver")).toBe(true);
    expect(userCan({ role: "staff", effectivePermissions: ["pedidos.ver"] }, "pedidos.status")).toBe(false);
    expect(userCan(null, "pedidos.ver")).toBe(false);
  });
  it("sem permissão efetiva, cai na lista antiga por aba", () => {
    expect(userCan({ role: "staff", permissions: ["produtos"] }, "produtos.editar")).toBe(true);
    expect(userCan({ role: "staff", permissions: ["produtos"] }, "pedidos.ver")).toBe(false);
  });
});

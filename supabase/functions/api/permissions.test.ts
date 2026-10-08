import { describe, expect, it } from "vitest";
import { effectivePermissions, expandLegacyPermissions, PERMISSIONS } from "./permissions";

describe("expandLegacyPermissions", () => {
  it("traduz a aba antiga 'pedidos' para pedidos + orçamentos + perdidos", () => {
    const out = expandLegacyPermissions(["pedidos"]);
    expect(out).toContain("pedidos.status");
    expect(out).toContain("orcamentos.converter");
    expect(out).toContain("perdidos.ver");
    expect(out).not.toContain("produtos.editar");
  });
  it("ignora chaves desconhecidas e não quebra com nomes de propriedade do JS", () => {
    expect(expandLegacyPermissions(["nada", "constructor", "__proto__"])).toEqual([]);
    expect(expandLegacyPermissions(null)).toEqual([]);
    expect(expandLegacyPermissions(undefined)).toEqual([]);
  });
  it("não repete permissões", () => {
    const out = expandLegacyPermissions(["pedidos", "pedidos"]);
    expect(new Set(out).size).toBe(out.length);
  });
});

describe("effectivePermissions", () => {
  it("administrador da empresa tem tudo", () => {
    expect([...effectivePermissions({ role: "platformAdmin" })].sort()).toEqual([...PERMISSIONS].sort());
  });
  it("equipe sem nada não tem nada", () => {
    expect(effectivePermissions({ role: "staff" }).size).toBe(0);
    expect(effectivePermissions({ role: "staff", permissions: [] }).size).toBe(0);
  });
  it("sem perfil, usa a lista antiga por aba", () => {
    const p = effectivePermissions({ role: "staff", permissions: ["produtos", "atividades"] });
    expect(p.has("produtos.editar")).toBe(true);
    expect(p.has("atividades.acessar")).toBe(true);
    expect(p.has("pedidos.ver")).toBe(false);
  });
  it("com perfil, o perfil manda e a lista antiga é ignorada", () => {
    const p = effectivePermissions({ role: "staff", permissions: ["produtos"], profilePermissions: ["pedidos.ver"] });
    expect([...p]).toEqual(["pedidos.ver"]);
  });
  it("ajuste individual: libera só pra pessoa e bloqueia só pra pessoa", () => {
    const p = effectivePermissions({
      role: "staff",
      profilePermissions: ["pedidos.ver", "pedidos.status"],
      grants: ["clientes.ver"],
      revokes: ["pedidos.status"],
    });
    expect(p.has("clientes.ver")).toBe(true);
    expect(p.has("pedidos.status")).toBe(false);
    expect(p.has("pedidos.ver")).toBe(true);
  });
  it("bloqueio individual ganha da liberação individual", () => {
    const p = effectivePermissions({ role: "staff", profilePermissions: [], grants: ["clientes.ver"], revokes: ["clientes.ver"] });
    expect(p.has("clientes.ver")).toBe(false);
  });
  it("ignora permissões inexistentes em perfil e ajustes", () => {
    const p = effectivePermissions({ role: "staff", profilePermissions: ["x.y", "pedidos.ver"], grants: ["configuracoes.editar"] });
    expect([...p]).toEqual(["pedidos.ver"]);
  });
});

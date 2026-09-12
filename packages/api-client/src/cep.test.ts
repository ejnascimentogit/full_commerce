import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCep, lookupCep } from "./cep";

describe("formatCep", () => {
  it("aplica a máscara 00000-000", () => {
    expect(formatCep("01310930")).toBe("01310-930");
  });

  it("remove caracteres não numéricos antes de formatar", () => {
    expect(formatCep("01310-930")).toBe("01310-930");
  });

  it("trunca em 8 dígitos e formata parcialmente enquanto o usuário digita", () => {
    expect(formatCep("013109300000")).toBe("01310-930");
    expect(formatCep("0131")).toBe("0131");
    expect(formatCep("01310")).toBe("01310");
    expect(formatCep("013109")).toBe("01310-9");
  });
});

describe("lookupCep", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retorna null sem chamar a rede quando o CEP não tem 8 dígitos", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await lookupCep("123")).toBeNull();
    expect(await lookupCep("123456789")).toBeNull();
    expect(await lookupCep("")).toBeNull();
    expect(await lookupCep("abcdefgh")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retorna null quando a resposta HTTP não é ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );

    expect(await lookupCep("01310-930")).toBeNull();
  });

  it("retorna null quando o ViaCEP responde com { erro: true } (CEP inexistente)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ erro: true }) }),
    );

    expect(await lookupCep("00000000")).toBeNull();
  });

  it("mapeia o endereço retornado pelo ViaCEP, usando string vazia para campos ausentes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        logradouro: "Avenida Paulista",
        bairro: "Bela Vista",
        localidade: "São Paulo",
        uf: "SP",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupCep("01310-930");

    expect(result).toEqual({
      street: "Avenida Paulista",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
    });
    expect(fetchMock).toHaveBeenCalledWith("https://viacep.com.br/ws/01310930/json/");
  });

  it("preenche com string vazia campos que o ViaCEP não retornou", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );

    expect(await lookupCep("01310930")).toEqual({
      street: "",
      neighborhood: "",
      city: "",
      state: "",
    });
  });
});

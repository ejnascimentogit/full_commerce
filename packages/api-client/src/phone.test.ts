import { describe, expect, it } from "vitest";
import { formatPhone } from "./phone";

describe("formatPhone", () => {
  it("celular com 11 dígitos", () => {
    expect(formatPhone("81988453645")).toBe("(81) 98845-3645");
  });
  it("fixo com 10 dígitos", () => {
    expect(formatPhone("8134412087")).toBe("(81) 3441-2087");
  });
  it("padroniza qualquer jeito de digitar ou colar", () => {
    for (const entrada of ["(81)98845-3645", "81 98845 3645", "81-98845-3645", "(81) 98845-3645", "81.98845.3645", " 81988453645 "]) {
      expect(formatPhone(entrada)).toBe("(81) 98845-3645");
    }
    expect(formatPhone("8199945-3000")).toBe("(81) 99945-3000");
  });
  it("tira o código do país", () => {
    expect(formatPhone("+55 81 98845-3645")).toBe("(81) 98845-3645");
    expect(formatPhone("558134412087")).toBe("(81) 3441-2087");
  });
  it("não confunde DDD 55 (Rio Grande do Sul) com código do país", () => {
    expect(formatPhone("55999998888")).toBe("(55) 99999-8888");
  });
  it("monta a máscara aos poucos, sem travar o apagar", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("8")).toBe("(8");
    expect(formatPhone("81")).toBe("(81");
    expect(formatPhone("819")).toBe("(81) 9");
    expect(formatPhone("819884")).toBe("(81) 9884");
    expect(formatPhone("8198845")).toBe("(81) 9884-5");
    expect(formatPhone("(81) 9884")).toBe("(81) 9884");
  });
  it("ignora letras e passa de 11 dígitos sem estourar", () => {
    expect(formatPhone("abc81988453645xyz")).toBe("(81) 98845-3645");
    expect(formatPhone("819884536459999")).toBe("(81) 98845-3645");
  });
});

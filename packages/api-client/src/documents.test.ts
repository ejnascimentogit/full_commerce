import { describe, expect, it } from "vitest";
import {
  formatCNPJ,
  formatCPF,
  formatDocument,
  isValidCNPJ,
  isValidCPF,
  isValidDocument,
  onlyDigits,
} from "./documents";

describe("onlyDigits", () => {
  it("remove tudo que não for dígito", () => {
    expect(onlyDigits("123.456.789-09")).toBe("12345678909");
    expect(onlyDigits("12.345.678/0001-95")).toBe("12345678000195");
    expect(onlyDigits("abc")).toBe("");
  });
});

describe("isValidCPF", () => {
  it("aceita um CPF válido (dígito verificador correto), com ou sem máscara", () => {
    expect(isValidCPF("52998224725")).toBe(true);
    expect(isValidCPF("529.982.247-25")).toBe(true);
  });

  it("rejeita CPF com dígito verificador errado", () => {
    expect(isValidCPF("52998224726")).toBe(false);
  });

  it("rejeita CPF com todos os dígitos iguais (matematicamente passaria no mod 11, mas é sempre inválido)", () => {
    expect(isValidCPF("11111111111")).toBe(false);
    expect(isValidCPF("00000000000")).toBe(false);
  });

  it("rejeita CPF com quantidade errada de dígitos", () => {
    expect(isValidCPF("123456789")).toBe(false);
    expect(isValidCPF("529982247250")).toBe(false);
    expect(isValidCPF("")).toBe(false);
  });
});

describe("isValidCNPJ", () => {
  it("aceita um CNPJ válido (dígito verificador correto), com ou sem máscara", () => {
    expect(isValidCNPJ("11444777000161")).toBe(true);
    expect(isValidCNPJ("11.444.777/0001-61")).toBe(true);
  });

  it("rejeita CNPJ com dígito verificador errado", () => {
    expect(isValidCNPJ("11444777000162")).toBe(false);
  });

  it("rejeita CNPJ com todos os dígitos iguais", () => {
    expect(isValidCNPJ("11111111111111")).toBe(false);
  });

  it("rejeita CNPJ com quantidade errada de dígitos", () => {
    expect(isValidCNPJ("1144477700016")).toBe(false);
    expect(isValidCNPJ("")).toBe(false);
  });
});

describe("isValidDocument", () => {
  it("delega para isValidCPF ou isValidCNPJ conforme o tipo", () => {
    expect(isValidDocument("cpf", "52998224725")).toBe(true);
    expect(isValidDocument("cpf", "11444777000161")).toBe(false);
    expect(isValidDocument("cnpj", "11444777000161")).toBe(true);
    expect(isValidDocument("cnpj", "52998224725")).toBe(false);
  });
});

describe("formatCPF / formatCNPJ / formatDocument", () => {
  it("aplica a máscara de CPF (000.000.000-00)", () => {
    expect(formatCPF("52998224725")).toBe("529.982.247-25");
  });

  it("trunca em 11 dígitos e formata parcialmente enquanto o usuário digita", () => {
    expect(formatCPF("5299822472599999")).toBe("529.982.247-25");
    expect(formatCPF("529")).toBe("529");
    expect(formatCPF("5299")).toBe("529.9");
  });

  it("aplica a máscara de CNPJ (00.000.000/0000-00)", () => {
    expect(formatCNPJ("11444777000161")).toBe("11.444.777/0001-61");
  });

  it("trunca em 14 dígitos ao formatar CNPJ", () => {
    expect(formatCNPJ("1144477700016199999")).toBe("11.444.777/0001-61");
  });

  it("formatDocument delega para o formatador certo conforme o tipo", () => {
    expect(formatDocument("cpf", "52998224725")).toBe("529.982.247-25");
    expect(formatDocument("cnpj", "11444777000161")).toBe("11.444.777/0001-61");
  });
});

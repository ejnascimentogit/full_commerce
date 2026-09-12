import { defineConfig } from "vitest/config";

// Testes unitários das regras de negócio puras em packages/api-client (frete,
// cupom, CEP, CPF/CNPJ) — sem DOM, sem rede real (fetch é mockado nos testes
// de CEP). Ver DOCUMENTACAO.md, seção "Testes e CI".
export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/src/**/*.{test,spec}.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});

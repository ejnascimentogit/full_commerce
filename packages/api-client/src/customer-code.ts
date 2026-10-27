/** Número do cliente para exibir: o código interno ("CLI-1001") sem o prefixo, só "1001". Sem código -> "—". */
export function customerNumber(code: string | null | undefined): string {
  const digits = String(code ?? "").replace(/^CLI-/i, "").trim();
  return digits || "—";
}

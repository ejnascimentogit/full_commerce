// Validação e máscara de CPF/CNPJ — dígito verificador oficial (mod 11), não só
// contagem de caracteres. Puro/sem DOM, então funciona nos três apps (storefront,
// mobile, admin) exatamente como os outros helpers de packages/api-client/domain.

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const checkDigit = (base: string) => {
    let sum = 0;
    let weight = base.length + 1;
    for (const digit of base) {
      sum += Number(digit) * weight;
      weight--;
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const d1 = checkDigit(cpf.slice(0, 9));
  const d2 = checkDigit(cpf.slice(0, 9) + d1);
  return cpf === cpf.slice(0, 9) + String(d1) + String(d2);
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const checkDigit = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = checkDigit(cnpj.slice(0, 12), weights1);
  const d2 = checkDigit(cnpj.slice(0, 12) + d1, weights2);
  return cnpj === cnpj.slice(0, 12) + String(d1) + String(d2);
}

export function isValidDocument(documentType: "cpf" | "cnpj", value: string): boolean {
  return documentType === "cpf" ? isValidCPF(value) : isValidCNPJ(value);
}

export function formatCPF(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatCNPJ(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function formatDocument(documentType: "cpf" | "cnpj", value: string): string {
  return documentType === "cpf" ? formatCPF(value) : formatCNPJ(value);
}

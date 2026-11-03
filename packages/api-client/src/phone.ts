import { onlyDigits } from "./documents";

/**
 * Telefone brasileiro no formato padrão, não importa como foi digitado ou colado:
 * fixo "(81) 3441-2087" (10 dígitos) e celular "(81) 98845-3645" (11 dígitos).
 * Ignora letras e símbolos, tira o "+55"/"55" do começo e vai montando a máscara enquanto a pessoa digita.
 */
export function formatPhone(value: string): string {
  let digits = onlyDigits(value ?? "");
  // Código do país colado junto (+55 81 ...). Com 11 dígitos exatos o "55" é o DDD do Rio Grande do Sul, então só corta se passar de 11.
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (digits.length <= 6) return `(${ddd}) ${rest}`;
  if (digits.length <= 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

import { onlyDigits } from "./documents";

export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

// ViaCEP é um serviço público real (não faz parte do backend do projeto) — usado
// tanto em modo mock quanto rest, então mora aqui e não em mock/. Não envia
// nenhum dado do cliente, só o CEP em si.
export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.erro) return null;

  return {
    street: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
  };
}

export function formatCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, "$1-$2");
}

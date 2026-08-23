import { redirect } from "next/navigation";

// Roteirização virou uma seção dentro de Configurações — mantém o redirect
// pra não quebrar links/atalhos antigos apontando pra cá.
export default function RegioesRedirectPage() {
  redirect("/configuracoes");
}

import { redirect } from "next/navigation";

// Rota antiga: o conteudo agora fica no menu Comercial.
export default function Page() {
  redirect("/comercial/vendas?aba=pedidos");
}

import Link from "next/link";
import { apiClient } from "@ecommerce/api-client";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";

export default async function ContaPage() {
  const [regions, categories, customer] = await Promise.all([
    apiClient.getRegions(),
    apiClient.getCategories(),
    apiClient.getCurrentCustomer(),
  ]);

  return (
    <>
      <RegionBar region={regions[0]} />
      <Header categories={categories} />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Minha conta</h1>

        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-semibold text-slate-900 mb-3">Dados cadastrais</h2>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Nome</dt>
              <dd className="text-slate-900 font-medium">{customer.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Razão social</dt>
              <dd className="text-slate-900 font-medium">{customer.businessName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{customer.documentType.toUpperCase()}</dt>
              <dd className="text-slate-900 font-medium">{customer.document}</dd>
            </div>
            <div>
              <dt className="text-slate-500">E-mail</dt>
              <dd className="text-slate-900 font-medium">{customer.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Telefone</dt>
              <dd className="text-slate-900 font-medium">{customer.phone}</dd>
            </div>
          </dl>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-semibold text-slate-900 mb-3">Endereços</h2>
          <ul className="space-y-2 text-sm">
            {customer.addresses.map((a) => (
              <li key={a.id} className="text-slate-600">
                {a.street}, {a.number} — {a.neighborhood}, {a.city}/{a.state} — {a.zipCode}
                {a.isDefault && <span className="ml-2 text-brand-600 text-xs font-medium">(padrão)</span>}
              </li>
            ))}
          </ul>
        </section>

        <Link
          href="/conta/pedidos"
          className="block bg-white border border-slate-200 rounded-lg p-5 font-medium text-slate-900 hover:border-brand-300"
        >
          Meus pedidos →
        </Link>
      </div>
    </>
  );
}

import { fetchClients } from "@/lib/queries/clients";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ClientesClient from "./ClientesClient";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const clients = await fetchClients();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Base de Clientes</h1>
        <span className="text-sm text-[var(--muted)]">{clients.length} clientes</span>
      </div>
      <ClientesClient clients={clients} />
    </div>
  );
}

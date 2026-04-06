import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchTeamMembers, fetchPaymentMethods } from "@/lib/queries/admin";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const auth = await requireAdmin();
  if ("error" in auth) redirect("/login");

  const [team, paymentMethods] = await Promise.all([
    fetchTeamMembers(),
    fetchPaymentMethods(),
  ]);

  return <AdminClient team={team} paymentMethods={paymentMethods} />;
}

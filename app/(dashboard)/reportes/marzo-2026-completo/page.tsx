import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import MarzoCompletoReport from "./MarzoCompletoReport";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reporte Completo Marzo 2026 | Lauti CRM",
};

export default async function MarzoCompletoReportPage() {
  const auth = await requireAdmin();
  if ("error" in auth) redirect("/login");

  return <MarzoCompletoReport />;
}

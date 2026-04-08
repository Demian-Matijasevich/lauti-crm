import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getToday } from "@/lib/date-utils";
import MarzoReport from "./MarzoReport";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reporte Marzo 2026 | Lauti CRM",
};

export default async function MarzoReportPage() {
  const auth = await requireAdmin();
  if ("error" in auth) redirect("/login");

  const _today = getToday();

  return <MarzoReport />;
}

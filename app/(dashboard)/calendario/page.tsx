import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import CalendarioClient from "./CalendarioClient";
import type { Lead, Payment, RenewalQueueRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = createServerClient();

  // Fetch data for the current month range (we'll fetch 3 months to allow navigation)
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const startStr = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, "0")}-01`;
  const endStr = `${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, "0")}-${String(rangeEnd.getDate()).padStart(2, "0")}`;

  const [leadsRes, paymentsRes, renewalsRes] = await Promise.all([
    // Leads with fecha_llamada in range
    supabase
      .from("leads")
      .select("id, nombre, fecha_llamada, estado, closer_id, setter_id")
      .gte("fecha_llamada", startStr)
      .lte("fecha_llamada", endStr),
    // Payments with fecha_vencimiento in range and estado=pendiente
    supabase
      .from("payments")
      .select("id, client_id, lead_id, numero_cuota, monto_usd, fecha_vencimiento, estado")
      .gte("fecha_vencimiento", startStr)
      .lte("fecha_vencimiento", endStr)
      .eq("estado", "pendiente"),
    // Renewal queue
    supabase
      .from("v_renewal_queue")
      .select("*")
      .gte("fecha_vencimiento", startStr)
      .lte("fecha_vencimiento", endStr),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Calendario</h1>
      <CalendarioClient
        leads={(leadsRes.data ?? []) as Pick<Lead, "id" | "nombre" | "fecha_llamada" | "estado">[]}
        payments={(paymentsRes.data ?? []) as Pick<Payment, "id" | "client_id" | "lead_id" | "numero_cuota" | "monto_usd" | "fecha_vencimiento" | "estado">[]}
        renewals={(renewalsRes.data ?? []) as RenewalQueueRow[]}
      />
    </div>
  );
}

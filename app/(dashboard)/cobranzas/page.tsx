import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  fetchCobranzasQueue,
  fetchAllPendingPaymentsAsItems,
  fetchAllPaidPayments,
  fetchAuditCuotas,
  fetchAuditRenovaciones,
} from "@/lib/queries/cobranzas";
import { fetchAgentTasks } from "@/lib/queries/agent-tasks";
import CobranzasClient from "./CobranzasClient";

export const dynamic = "force-dynamic";

export default async function CobranzasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.is_admin && !session.roles.includes("cobranzas")) {
    redirect("/");
  }

  const [queue, allTasks, allPendingItems, allPaidPayments, auditCuotas, auditRenovaciones] =
    await Promise.all([
      fetchCobranzasQueue(),
      fetchAgentTasks(),
      fetchAllPendingPaymentsAsItems(),
      fetchAllPaidPayments(),
      fetchAuditCuotas(),
      fetchAuditRenovaciones(),
    ]);

  // Strip agent data for non-agent-visible users (Task 3)
  const sanitizedQueue = session.can_see_agent
    ? queue
    : queue.map((item) => ({
        ...item,
        task_asignado_a: item.task_asignado_a === "agent" ? null : item.task_asignado_a,
        last_log: null,
        task_estado:
          item.task_asignado_a === "agent" && item.task_estado === "done"
            ? "done"
            : item.task_estado,
      }));

  const sanitizedTasks = session.can_see_agent
    ? allTasks
    : allTasks.map((t) => ({
        ...t,
        asignado_a: t.asignado_a === "agent" ? ("human" as const) : t.asignado_a,
        contexto: {} as Record<string, unknown>,
      }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cobranzas</h1>
      </div>
      <CobranzasClient
        initialQueue={sanitizedQueue}
        allPendingItems={allPendingItems}
        allPaidPayments={allPaidPayments}
        allTasks={sanitizedTasks}
        auditCuotas={auditCuotas}
        auditRenovaciones={auditRenovaciones}
        session={session}
      />
    </div>
  );
}

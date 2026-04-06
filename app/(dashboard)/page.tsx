import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Placeholder — will be replaced with actual dashboard in Phase 5
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">
        Bienvenido, {session.nombre}
      </h1>
      <p className="text-[var(--muted)]">
        Dashboard en construcci&oacute;n. Roles: {session.roles.join(", ")}
      </p>
    </div>
  );
}

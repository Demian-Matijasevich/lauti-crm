import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase-server";
import LeaderboardClient from "./LeaderboardClient";
import type { Lead, AtCommission } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Visible to all roles — no admin check

  const supabase = createServerClient();

  const [leadsRes, commRes] = await Promise.all([
    supabase
      .from("leads")
      .select("*, closer:team_members!leads_closer_id_fkey(*)")
      .not("closer_id", "is", null),
    supabase
      .from("team_members")
      .select("id,nombre,at_comision_closer,at_comision_setter,at_comision_cobranzas,at_comision_total")
      .eq("activo", true),
  ]);

  return (
    <LeaderboardClient
      leads={(leadsRes.data as Lead[]) ?? []}
      currentMemberId={session.team_member_id}
      commissions={(commRes.data as AtCommission[]) ?? []}
    />
  );
}

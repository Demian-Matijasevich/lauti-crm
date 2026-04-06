import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase-server";
import LeaderboardClient from "./LeaderboardClient";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Visible to all roles — no admin check

  const supabase = createServerClient();

  const { data } = await supabase
    .from("leads")
    .select("*, closer:team_members!leads_closer_id_fkey(*)")
    .not("closer_id", "is", null);

  return (
    <LeaderboardClient
      leads={(data as Lead[]) ?? []}
      currentMemberId={session.team_member_id}
    />
  );
}

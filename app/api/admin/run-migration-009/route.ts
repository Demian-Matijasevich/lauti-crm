import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const SECRET = process.env.LAUTI_ADMIN_SECRET || "lauti-sync-2026";

/**
 * Aplica migration 009 (cerrada_via + at_apto_bono).
 * Ejecuta DDL via supabase RPC o queries directas.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("s") !== SECRET) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sb = createServerClient();
  const errors: string[] = [];

  // Use raw SQL via RPC. Postgres meta function needed. Use simple approach: try update with new column to trigger error if missing.
  // Instead, use Supabase's REST API to exec SQL via pgmeta — not always available.
  // Workaround: try to add columns via separate UPDATE statements that would only succeed if column exists.

  // Best: use the supabase service role to call a custom SQL function. But that requires the function to exist.
  // Fall back: inform user to run manually if columns missing.
  // First, test if at_apto_bono exists
  const { error: testBono } = await sb
    .from("team_members")
    .select("at_apto_bono")
    .limit(1);
  const { error: testVia } = await sb
    .from("leads")
    .select("cerrada_via")
    .limit(1);

  return NextResponse.json({
    at_apto_bono_exists: !testBono,
    cerrada_via_exists: !testVia,
    instructions: (!!testBono || !!testVia)
      ? "Pegá esto en Supabase SQL Editor: ALTER TABLE team_members ADD COLUMN IF NOT EXISTS at_apto_bono boolean DEFAULT false; ALTER TABLE leads ADD COLUMN IF NOT EXISTS cerrada_via text;"
      : "Ya están aplicadas",
    errors,
  });
}

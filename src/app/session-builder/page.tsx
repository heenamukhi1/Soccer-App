import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import SessionBuilder, { type PreviousAnalysis } from "./SessionBuilder";

async function ProtectedSessionBuilder() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("player_profiles")
    .select("name, position, positions, preferred_foot, age")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/profile");
  }

  let initialAnalysis: unknown = null;
  const { data: analysisRow } = await supabase
    .from("player_profiles")
    .select("latest_analysis")
    .eq("user_id", user.id)
    .maybeSingle();
  initialAnalysis = analysisRow?.latest_analysis ?? null;

  let initialAnalyses: PreviousAnalysis[] = [];
  const { data: analysisRows } = await supabase
    .from("player_analyses")
    .select("id, created_at, analysis")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (analysisRows) {
    initialAnalyses = analysisRows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      analysis: row.analysis,
    }));
  }

  return <SessionBuilder profile={profile} initialAnalysis={initialAnalysis} initialAnalyses={initialAnalyses} />;
}

export default function SessionBuilderPage() {
  return (
    <Suspense
      fallback={
        <main className="workspace auth-loading" role="status">
          Loading your session builder...
        </main>
      }
    >
      <ProtectedSessionBuilder />
    </Suspense>
  );
}

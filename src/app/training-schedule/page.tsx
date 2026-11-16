import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import TrainingSchedule from "./TrainingSchedule";

type PreviousAnalysis = {
  id: string;
  createdAt: string;
  analysis: unknown;
};

async function ProtectedTrainingSchedule() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("player_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) redirect("/profile");

  const { data: analysisRows, error: analysesError } = await supabase
    .from("player_analyses")
    .select("id, created_at, analysis")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (analysesError) {
    console.error("[training-schedule] Could not load previous analyses", analysesError);
  }

  const previousAnalyses: PreviousAnalysis[] = (analysisRows ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    analysis: row.analysis,
  }));

  return <TrainingSchedule initialAnalyses={previousAnalyses} />;
}

export default function TrainingSchedulePage() {
  return (
    <Suspense fallback={<main className="workspace auth-loading" role="status">Loading your training schedule...</main>}>
      <ProtectedTrainingSchedule />
    </Suspense>
  );
}

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import AnalysisDetail from "./AnalysisDetail";

async function ProtectedAnalysisDetail({ id }: { id: string }) {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: record } = await supabase
    .from("player_analyses")
    .select("id, created_at, analysis")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  return <AnalysisDetail id={id} record={record} />;
}

export default function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<main className="workspace auth-loading">Loading analysis...</main>}>
      <AnalysisPageParams params={params} />
    </Suspense>
  );
}

async function AnalysisPageParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProtectedAnalysisDetail id={id} />;
}

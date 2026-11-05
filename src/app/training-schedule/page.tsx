import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import TrainingSchedule from "./TrainingSchedule";

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

  return <TrainingSchedule />;
}

export default function TrainingSchedulePage() {
  return (
    <Suspense fallback={<main className="workspace auth-loading" role="status">Loading your training schedule...</main>}>
      <ProtectedTrainingSchedule />
    </Suspense>
  );
}

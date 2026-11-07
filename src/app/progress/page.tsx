import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Progress from "./Progress";

async function ProtectedProgress() {
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

  return <Progress />;
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<main className="workspace auth-loading" role="status">Loading your progress...</main>}>
      <ProtectedProgress />
    </Suspense>
  );
}

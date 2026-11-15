import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import WelcomeBack from "./WelcomeBack";

async function ProtectedWelcomeBack() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("player_profiles")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) redirect("/profile");

  return <WelcomeBack name={profile.name?.split(" ")[0] ?? ""} />;
}

export default function WelcomeBackPage() {
  return (
    <Suspense fallback={<main className="welcome-back-page" />}>
      <ProtectedWelcomeBack />
    </Suspense>
  );
}

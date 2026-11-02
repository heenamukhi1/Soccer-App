import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";

async function ProtectedProfile() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("player_profiles")
    .select("name, position, positions, preferred_foot, age")
    .eq("user_id", user.id)
    .maybeSingle();

  return <ProfileForm profile={profile ?? null} />;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<main className="workspace auth-loading" role="status">Loading your profile...</main>}>
      <ProtectedProfile />
    </Suspense>
  );
}

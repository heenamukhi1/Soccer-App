import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import SessionBuilder from "./SessionBuilder";

async function ProtectedSessionBuilder() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("player_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/profile");
  }

  return <SessionBuilder />;
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

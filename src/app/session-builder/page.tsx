import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SessionBuilder from "./SessionBuilder";

async function ProtectedSessionBuilder() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
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

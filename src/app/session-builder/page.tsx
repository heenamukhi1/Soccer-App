import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SessionBuilder from "./SessionBuilder";

async function ProtectedSessionBuilder() {
  const session = await auth();

  if (!session?.user) {
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

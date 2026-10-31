"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSignOut() {
    setError("");

    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not sign out. Please try again.");
    }
  }

  return (
    <div className="sign-out-control">
      <button className="sign-out-button" type="button" onClick={handleSignOut}>
        Sign out
      </button>
      {error && <span className="sign-out-error" role="alert">{error}</span>}
    </div>
  );
}

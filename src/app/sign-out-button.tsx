"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function SignOutButton() {
  const [error, setError] = useState("");

  async function handleSignOut() {
    setError("");

    try {
      await signOut({ redirectTo: "/" });
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

"use client";

import { useRouter } from "next/navigation";

export default function WelcomeBack({ name }: { name: string }) {
  const router = useRouter();

  return (
    <main className="welcome-back-page" role="status" aria-live="polite">
      <div className="welcome-back-card">
        <p>Good to see you again</p>
        <h1>Welcome back{name ? `, ${name}` : ""}!</h1>
        <button
          className="welcome-back-button"
          type="button"
          onClick={() => router.replace("/session-builder")}
        >
          Continue to session builder
        </button>
      </div>
    </main>
  );
}

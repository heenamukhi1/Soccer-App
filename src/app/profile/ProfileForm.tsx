"use client";

import { Activity, ArrowRight, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PlayerProfile = {
  name: string;
  position: string | string[] | null;
  positions?: string[] | null;
  preferred_foot: string;
  age: number;
};

const PITCH_POSITIONS = [
  { label: "11", left: 15, top: 34 },
  { label: "9", left: 50, top: 27 },
  { label: "7", left: 85, top: 34 },
  { label: "8", left: 31, top: 56 },
  { label: "10", left: 69, top: 56 },
  { label: "6", left: 50, top: 67 },
  { label: "3", left: 15, top: 79 },
  { label: "4", left: 38, top: 79 },
  { label: "5", left: 62, top: 79 },
  { label: "2", left: 85, top: 79 },
  { label: "GK", left: 50, top: 88 },
];

export default function ProfileForm({ profile }: { profile: PlayerProfile | null }) {
  const router = useRouter();
  const validPositionLabels = new Set(PITCH_POSITIONS.map(({ label }) => label));
  const rawInitialPositions = profile?.positions?.length
    ? profile.positions
    : Array.isArray(profile?.position)
      ? profile.position
      : typeof profile?.position === "string" && profile.position.trim()
        ? profile.position.split(/\s*,\s*/)
        : [];
  const initialPositions = rawInitialPositions.filter((position) => validPositionLabels.has(position));
  const [form, setForm] = useState<PlayerProfile>({
    name: profile?.name ?? "",
    position: initialPositions,
    preferred_foot: profile?.preferred_foot ?? "",
    age: profile?.age ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof PlayerProfile, value: string | number | string[]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function togglePosition(position: string) {
    setForm((current) => {
      const positions = Array.isArray(current.position) ? current.position : [];
      return {
        ...current,
        position: positions.includes(position)
          ? positions.filter((item) => item !== position)
          : [...positions, position],
      };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Please sign in again.");

      const positions = Array.isArray(form.position) ? form.position : [];
      const cleaned = {
        user_id: user.id,
        name: form.name.trim(),
        position: positions.join(", "),
        positions,
        preferred_foot: form.preferred_foot,
        age: Number(form.age),
      };

      if (!cleaned.name || !cleaned.positions.length || !cleaned.preferred_foot || cleaned.age < 5 || cleaned.age > 100) {
        throw new Error("Complete every box with a valid age.");
      }

      const { error: saveError } = await supabase
        .from("player_profiles")
        .upsert(cleaned, { onConflict: "user_id" });
      if (saveError) throw saveError;

      router.replace("/session-builder");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your profile.");
      setSaving(false);
    }
  }

  const selectedPositions = Array.isArray(form.position) ? form.position : [];

  return (
    <main className="workspace profile-page">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="NextLevel home">
          <span className="brand-mark" aria-hidden="true"><Activity size={20} strokeWidth={2.6} /></span>
          <span className="brand-name">Next<span>Level</span></span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-tagline">PERFORMANCE STUDIO</span>
        </Link>
      </header>

      <section className="profile-shell">
        <div className="profile-heading">
          <div className="eyebrow"><span className="live-dot" /> {profile ? "PLAYER PROFILE" : "WELCOME TO NEXTLEVEL"}</div>
          <h1>{profile ? "Edit your profile." : "Tell us about you."}</h1>
          <p>{profile ? "Keep your player details up to date." : "Set up your player profile so your training feedback starts with you."}</p>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <label>
            <span>Full name</span>
            <input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Your name" required />
          </label>
          <fieldset className="position-selector">
            <legend>Positions</legend>
            <div className="position-pitch" aria-label="Select all positions you play">
              <span className="pitch-halfway" aria-hidden="true" />
              <span className="pitch-circle" aria-hidden="true" />
              <span className="pitch-box pitch-box-top" aria-hidden="true" />
              <span className="pitch-box pitch-box-bottom" aria-hidden="true" />
              {PITCH_POSITIONS.map((position) => {
                const selected = selectedPositions.includes(position.label);
                return (
                  <button
                    key={position.label}
                    type="button"
                    className={`position-marker${selected ? " selected" : ""}`}
                    style={{ left: `${position.left}%`, top: `${position.top}%` }}
                    aria-pressed={selected}
                    aria-label={`${position.label} position`}
                    onClick={() => togglePosition(position.label)}
                  >
                    <span className="position-marker-label">{position.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="position-selection">Tap every player icon where you play</p>
          </fieldset>
          <label>
            <span>Preferred foot</span>
            <select value={form.preferred_foot} onChange={(event) => update("preferred_foot", event.target.value)} required>
              <option value="" disabled>Select preferred foot</option>
              <option value="Right">Right</option>
              <option value="Left">Left</option>
              <option value="Both">Both</option>
            </select>
          </label>
          <label>
            <span>Age</span>
            <input type="number" min="5" max="100" value={form.age || ""} onChange={(event) => update("age", Number(event.target.value))} placeholder="Your age" required />
          </label>
          {error && <p className="profile-error" role="alert">{error}</p>}
          <button className="profile-save-button" type="submit" disabled={saving}>
            {saving ? "Saving..." : profile ? <><Save size={16} /> Save changes</> : <>Save profile <ArrowRight size={16} /></>}
          </button>
        </form>
      </section>
    </main>
  );
}

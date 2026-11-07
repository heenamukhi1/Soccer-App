"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Clock3,
  Dumbbell,
  Gauge,
  LoaderCircle,
  Library,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SignOutButton from "../sign-out-button";

type Strength = { name: string; detail: string };
type Weakness = { name: string; detail: string };
type Drill = { name: string; detail: string; icon: typeof Target };
type SavedDrill = { id: string; name: string; detail: string; savedAt: string };
type AnalysisInsight = { name: string; detail: string };
type AnalysisResult = {
  rating: number;
  strengths: AnalysisInsight[];
  weaknesses: AnalysisInsight[];
  drills: string[];
  schedule: AnalysisScheduleItem[];
};
type AnalysisScheduleItem = {
  day: string;
  startTime: string;
  name: string;
  durationMinutes: number;
  type: "drill" | "break";
};
export type PreviousAnalysis = {
  id: string;
  createdAt: string;
  analysis: AnalysisResult;
};
export type SavedPlayerProfile = {
  name: string;
  position: string | null;
  positions: string[] | null;
  preferred_foot: string;
  age: number;
};

const SAVED_DRILLS_KEY = "nextlevel-saved-drills";
const SAVED_DRILLS_EVENT = "nextlevel-saved-drills-change";
const TRAINING_AVAILABILITY_KEY = "nextlevel-training-availability";
const TRAINING_EQUIPMENT_KEY = "nextlevel-training-equipment";
const TRAINING_SCHEDULE_KEY = "nextlevel-training-schedule";
const PROGRESS_HISTORY_KEY = "nextlevel-progress-history";
const TRAINING_WEEK_KEY = "nextlevel-training-week";
const TRAINING_COMPLETED_KEY = "nextlevel-training-completed";
const LATEST_ANALYSIS_KEY = "nextlevel-latest-analysis";
const PREVIOUS_ANALYSES_KEY = "nextlevel-previous-analyses";
const TRAINING_COMPLETED_HISTORY_KEY = "nextlevel-training-completed-history";

function getCurrentTrainingWeekStart() {
  const now = new Date();
  const start = new Date(now);
  const distanceFromMonday = start.getDay() === 0 ? 6 : start.getDay() - 1;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - distanceFromMonday);
  return start.toISOString().slice(0, 10);
}

function clearExpiredTrainingWeek() {
  const savedWeek = window.localStorage.getItem(TRAINING_WEEK_KEY);
  const currentWeek = getCurrentTrainingWeekStart();
  if (savedWeek === currentWeek) return;
  if (!savedWeek) {
    window.localStorage.setItem(TRAINING_WEEK_KEY, currentWeek);
    return;
  }
  window.localStorage.removeItem(TRAINING_AVAILABILITY_KEY);
  window.localStorage.removeItem(TRAINING_EQUIPMENT_KEY);
  window.localStorage.removeItem(TRAINING_SCHEDULE_KEY);
  window.localStorage.removeItem(TRAINING_COMPLETED_KEY);
  window.localStorage.removeItem(TRAINING_COMPLETED_HISTORY_KEY);
  window.localStorage.setItem(TRAINING_WEEK_KEY, currentWeek);
}

function normalizeScheduleText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function mergeWeeklySchedules(
  previous: unknown,
  incoming: AnalysisScheduleItem[],
) {
  const existing = Array.isArray(previous)
    ? previous.filter((item): item is AnalysisScheduleItem =>
        typeof item === "object" &&
        item !== null &&
        "day" in item &&
        typeof item.day === "string" &&
        "startTime" in item &&
        typeof item.startTime === "string" &&
        "name" in item &&
        typeof item.name === "string" &&
        "durationMinutes" in item &&
        typeof item.durationMinutes === "number" &&
        "type" in item &&
        (item.type === "drill" || item.type === "break"),
      )
    : [];

  const merged = [...existing];
  const seen = new Set(
    existing.map((item) =>
      `${item.type}-${item.day.toLowerCase()}-${item.startTime}-${normalizeScheduleText(item.name)}`,
    ),
  );

  incoming.forEach((item) => {
    const key = `${item.type}-${item.day.toLowerCase()}-${item.startTime}-${normalizeScheduleText(item.name)}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  });

  return merged.sort((a, b) => {
    const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const dayDifference =
      dayOrder.indexOf(a.day.toLowerCase()) - dayOrder.indexOf(b.day.toLowerCase());
    if (dayDifference !== 0) return dayDifference;
    return a.startTime.localeCompare(b.startTime);
  });
}

function subscribeToSavedDrills(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SAVED_DRILLS_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SAVED_DRILLS_EVENT, onStoreChange);
  };
}

function getSavedDrillsSnapshot() {
  try {
    return window.localStorage.getItem(SAVED_DRILLS_KEY) ?? "";
  } catch (error) {
    console.error("[drill-library] Could not read saved drills", error);
    return "";
  }
}

function getServerSavedDrillsSnapshot() {
  return "";
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;
  const hasThreeInsights = (items: unknown) =>
    Array.isArray(items) &&
    items.length === 3 &&
    items.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "name" in item &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        "detail" in item &&
        typeof item.detail === "string" &&
        item.detail.trim().length > 0,
    );
  const hasThreeStrings = (items: unknown) =>
    Array.isArray(items) &&
    items.length === 3 &&
    items.every((item) => typeof item === "string" && item.trim().length > 0);
  const hasValidSchedule = (items: unknown) =>
    Array.isArray(items) &&
    items.length <= 60 &&
    items.every((item) =>
    typeof item === "object" &&
    item !== null &&
    "day" in item &&
    typeof item.day === "string" &&
    "startTime" in item &&
    typeof item.startTime === "string" &&
    "name" in item &&
    typeof item.name === "string" &&
    "durationMinutes" in item &&
    typeof item.durationMinutes === "number" &&
    Number.isFinite(item.durationMinutes) &&
    item.durationMinutes >= 1 &&
    "type" in item &&
    (item.type === "drill" || item.type === "break"),
    );

  return (
    typeof result.rating === "number" &&
    Number.isFinite(result.rating) &&
    result.rating >= 1 &&
    result.rating <= 10 &&
    hasThreeInsights(result.strengths) &&
    hasThreeInsights(result.weaknesses) &&
    hasThreeStrings(result.drills) &&
    hasValidSchedule(result.schedule)
  );
}

function isSavedDrillList(value: unknown): value is SavedDrill[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "string" &&
        "name" in item &&
        typeof item.name === "string" &&
        "detail" in item &&
        typeof item.detail === "string" &&
        "savedAt" in item &&
        typeof item.savedAt === "string" &&
        Number.isFinite(Date.parse(item.savedAt)),
    )
  );
}

const initialStrengths: Strength[] = [
  { name: "Spatial awareness", detail: "Finds pockets of space early" },
  { name: "First touch", detail: "Clean control under pressure" },
  { name: "Work rate", detail: "Consistent defensive recovery" },
];

const initialWeaknesses: Weakness[] = [
  { name: "Weak-foot confidence", detail: "Left side limits final actions" },
  { name: "Decision speed", detail: "Hesitates around the box" },
  { name: "Aerial duels", detail: "Timing is inconsistent in the air" },
];

const initialDrills: Drill[] = [
  {
    name: "Weak-foot wall passes",
    detail: "3 sets × 20 each side · 12 min",
    icon: Target,
  },
  {
    name: "One-touch rondo",
    detail: "4 sets × 3 min · 15 min",
    icon: Activity,
  },
  {
    name: "Near-post reaction run",
    detail: "3 sets × 8 repetitions · 10 min",
    icon: Zap,
  },
];

export default function SessionBuilder({
  profile,
  initialAnalysis,
  initialAnalyses = [],
}: {
  profile: SavedPlayerProfile;
  initialAnalysis?: unknown;
  initialAnalyses?: PreviousAnalysis[];
}) {
  const searchParams = useSearchParams();
  const selectedPositions = profile.positions?.length
    ? profile.positions
    : typeof profile.position === "string" && profile.position.trim()
      ? profile.position.split(/\s*,\s*/).filter(Boolean)
      : [];
  const positionText = selectedPositions.join(" · ");
  const profileText = `${profile.name}\nAge: ${profile.age}\nPositions: ${positionText || "Not set"}\nPreferred foot: ${profile.preferred_foot}`;
  const [activeView, setActiveView] = useState<"session" | "library">(
    searchParams.get("view") === "library" ? "library" : "session",
  );
  useEffect(() => {
    const nextView = searchParams.get("view") === "library" ? "library" : "session";
    queueMicrotask(() => setActiveView(nextView));
  }, [searchParams]);
  const savedDrillsJson = useSyncExternalStore(
    subscribeToSavedDrills,
    getSavedDrillsSnapshot,
    getServerSavedDrillsSnapshot,
  );
  const savedDrills = useMemo(() => {
    if (!savedDrillsJson) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(savedDrillsJson);
      if (isSavedDrillList(parsed)) {
        return parsed;
      }
      console.error("[drill-library] Saved drill data has an unexpected format.");
    } catch (error) {
      console.error("[drill-library] Could not parse saved drills", error);
    }
    return [];
  }, [savedDrillsJson]);
  const [storageError, setStorageError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [playerAssessment, setPlayerAssessment] = useState("");
  const restoredAnalysis = isAnalysisResult(initialAnalysis) ? initialAnalysis : null;
  const [score, setScore] = useState(restoredAnalysis?.rating ?? 8.4);
  const [confidence, setConfidence] = useState(91);
  const [playerMeta, setPlayerMeta] = useState(positionText ? `${positionText} / U${profile.age}` : `U${profile.age}`);
  const [hasAnalyzed, setHasAnalyzed] = useState(Boolean(restoredAnalysis));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [playerName, setPlayerName] = useState(profile.name);
  const [strengths, setStrengths] = useState(restoredAnalysis?.strengths ?? initialStrengths);
  const [weaknesses, setWeaknesses] = useState(restoredAnalysis?.weaknesses ?? initialWeaknesses);
  const [drills, setDrills] = useState<Drill[]>(
    restoredAnalysis?.drills.map((drill, index) => ({
      name: drill,
      detail: "Recommended for this player",
      icon: [Target, Activity, Zap][index],
    })) ?? initialDrills,
  );
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const dashboardRef = useRef<HTMLElement>(null);
  const [previousAnalyses, setPreviousAnalyses] = useState<PreviousAnalysis[]>(initialAnalyses);

  useEffect(() => {
    if (restoredAnalysis) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(LATEST_ANALYSIS_KEY) ?? "null") as unknown;
      if (!isAnalysisResult(saved)) return;
      queueMicrotask(() => {
        setScore(saved.rating);
        setStrengths(saved.strengths);
        setWeaknesses(saved.weaknesses);
        setDrills(saved.drills.map((drill, index) => ({
          name: drill,
          detail: "Recommended for this player",
          icon: [Target, Activity, Zap][index],
        })));
        setHasAnalyzed(true);
      });
    } catch (error) {
      console.error("[session-builder] Could not restore the latest analysis", error);
    }
  }, [restoredAnalysis]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(PREVIOUS_ANALYSES_KEY) ?? "[]") as unknown;
      if (!Array.isArray(saved)) return;
      const local = saved.filter((item): item is PreviousAnalysis =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as PreviousAnalysis).id === "string" &&
        typeof (item as PreviousAnalysis).createdAt === "string" &&
        isAnalysisResult((item as PreviousAnalysis).analysis),
      );
      if (local.length && initialAnalyses.length === 0) {
        queueMicrotask(() => setPreviousAnalyses(local));
      }
    } catch (error) {
      console.error("[session-builder] Could not restore previous analyses", error);
    }
  }, [initialAnalyses.length]);

  function persistSavedDrills(nextDrills: SavedDrill[]) {
    try {
      const serialized = JSON.stringify(nextDrills);
      window.localStorage.setItem(SAVED_DRILLS_KEY, serialized);
      window.dispatchEvent(new Event(SAVED_DRILLS_EVENT));
      setStorageError("");
    } catch (error) {
      console.error("[drill-library] Could not save drills", error);
      setStorageError("Changes could not be saved in this browser.");
    }
  }

  function removeSavedDrill(id: string) {
    persistSavedDrills(savedDrills.filter((drill) => drill.id !== id));
  }

  function toggleInsight(id: string) {
    setExpandedInsights((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleAnalyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAnalyzing(true);
    setAnalysisError("");
    const requestId = crypto.randomUUID();
    const startedAt = performance.now();

    console.info("[analysis] Request started", {
      requestId,
      profileLength: profileText.length,
      matchNotesLength: feedback.length,
      playerAssessmentLength: playerAssessment.length,
    });

    if (window.matchMedia("(max-width: 950px)").matches) {
      dashboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    try {
      let trainingAvailability: unknown = [];
      let trainingEquipment: unknown = [];
      try {
        clearExpiredTrainingWeek();
        trainingAvailability = JSON.parse(window.localStorage.getItem(TRAINING_AVAILABILITY_KEY) ?? "[]");
        trainingEquipment = JSON.parse(window.localStorage.getItem(TRAINING_EQUIPMENT_KEY) ?? "[]");
      } catch {
        trainingAvailability = [];
        trainingEquipment = [];
      }
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
        body: JSON.stringify({
          playerProfile: profileText,
          matchNotes: feedback,
          playerAssessment,
          trainingAvailability,
          trainingEquipment,
        }),
      });
      const elapsedMs = Math.round(performance.now() - startedAt);
      const serverRequestId = response.headers.get("X-Request-ID") || requestId;
      const data: unknown = await response.json().catch(() => null);

      console.info("[analysis] Response received", {
        requestId: serverRequestId,
        status: response.status,
        durationMs: elapsedMs,
      });

      if (!response.ok) {
        const message =
          typeof data === "object" && data !== null && "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Analysis failed. Please try again.";

        console.warn("[analysis] API returned an error", {
          requestId: serverRequestId,
          status: response.status,
          error: message,
        });
        throw new Error(`${message} (reference: ${serverRequestId})`);
      }

      if (!isAnalysisResult(data)) {
        console.warn("[analysis] Successful response failed client validation", {
          requestId: serverRequestId,
          durationMs: elapsedMs,
        });
        throw new Error("Gemini returned an unexpected analysis format.");
      }

      console.info("[analysis] Response validated", {
        requestId: serverRequestId,
        rating: data.rating,
        strengthCount: data.strengths.length,
        weaknessCount: data.weaknesses.length,
        drillCount: data.drills.length,
        durationMs: elapsedMs,
      });

      setPlayerName(profile.name);
      setPlayerMeta(positionText ? `${positionText} / U${profile.age}` : `U${profile.age}`);
      setScore(data.rating);
      setStrengths(
        data.strengths.map((strength) => ({
          ...strength,
        })),
      );
      setWeaknesses(
        data.weaknesses.map((weakness) => ({
          ...weakness,
        })),
      );
      setDrills(
        data.drills.map((drill, index) => ({
          name: drill,
          detail: "Recommended for this player",
          icon: [Target, Activity, Zap][index],
        })),
      );
      const savedAt = new Date().toISOString();
      const previousAnalysisId = crypto.randomUUID();
      const previousAnalysisRecord: PreviousAnalysis = {
        id: previousAnalysisId,
        createdAt: savedAt,
        analysis: data,
      };
      setPreviousAnalyses((current) => {
        const next = [previousAnalysisRecord, ...current.filter((item) => item.id !== previousAnalysisId)].slice(0, 50);
        try {
          window.localStorage.setItem(PREVIOUS_ANALYSES_KEY, JSON.stringify(next));
        } catch (error) {
          console.error("[session-builder] Could not save analysis history", error);
        }
        return next;
      });
      try {
        const previousRaw = window.localStorage.getItem(PROGRESS_HISTORY_KEY);
        const previous: unknown = previousRaw ? JSON.parse(previousRaw) : [];
        const progressEntry = {
          id: crypto.randomUUID(),
          date: savedAt,
          rating: data.rating,
          strengths: data.strengths.map((item) => item.name),
          weaknesses: data.weaknesses.map((item) => item.name),
        };
        const nextHistory = [
          ...(Array.isArray(previous) ? previous : []),
          progressEntry,
        ].slice(-10);
        window.localStorage.setItem(PROGRESS_HISTORY_KEY, JSON.stringify(nextHistory));
        window.dispatchEvent(new Event("nextlevel:progress-updated"));
      } catch (error) {
        console.error("[session-builder] Could not save progress history", error);
      }
      persistSavedDrills([
        ...data.drills.map((drill) => ({
          id: crypto.randomUUID(),
          name: drill,
          detail: "Recommended for this player",
          savedAt,
        })),
        ...savedDrills,
      ]);
      try {
        clearExpiredTrainingWeek();
        const savedScheduleRaw = window.localStorage.getItem(TRAINING_SCHEDULE_KEY);
        let savedSchedule: unknown = [];
        try {
          savedSchedule = savedScheduleRaw ? JSON.parse(savedScheduleRaw) : [];
        } catch (error) {
          console.error("[session-builder] Could not parse existing training schedule", error);
        }
        window.localStorage.setItem(
          TRAINING_SCHEDULE_KEY,
          JSON.stringify(mergeWeeklySchedules(savedSchedule, data.schedule)),
        );
        window.localStorage.setItem(TRAINING_WEEK_KEY, getCurrentTrainingWeekStart());
        window.dispatchEvent(new Event("nextlevel:schedule-updated"));
      } catch (error) {
        console.error(
          "[session-builder] Could not save training schedule",
          error,
        );
      }
      try {
        window.localStorage.setItem(LATEST_ANALYSIS_KEY, JSON.stringify(data));
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          throw new Error("Could not identify the signed-in player.");
        }
        const { error: saveError } = await supabase
          .from("player_profiles")
          .update({
            latest_analysis: data,
            latest_analysis_at: savedAt,
          })
          .eq("user_id", user.id);
        if (saveError) throw saveError;
        await supabase.from("player_analyses").insert({
          id: previousAnalysisId,
          user_id: user.id,
          analysis: data,
          created_at: savedAt,
        });
      } catch (error) {
        console.error("[session-builder] Could not save latest analysis", error);
      }
      setConfidence(0);
      setHasAnalyzed(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Analysis failed. Please try again.";

      console.warn("[analysis] Request failed", {
        requestId,
        durationMs: Math.round(performance.now() - startedAt),
        errorName: error instanceof Error ? error.name : "UnknownError",
        error: message,
      });
      setAnalysisError(message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const savedDrillGroups = savedDrills.reduce<
    { dateKey: string; savedAt: string; drills: SavedDrill[] }[]
  >((groups, drill) => {
    const dateKey = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
      new Date(drill.savedAt),
    );
    const group = groups.find((item) => item.dateKey === dateKey);
    if (group) {
      group.drills.push(drill);
    } else {
      groups.push({ dateKey, savedAt: drill.savedAt, drills: [drill] });
    }
    return groups;
  }, []);

  return (
    <main className="workspace">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="NextLevel home">
          <span className="brand-mark" aria-hidden="true">
            <Activity size={20} strokeWidth={2.6} />
          </span>
          <span className="brand-name">
            Next<span>Level</span>
          </span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-tagline">PERFORMANCE STUDIO</span>
        </a>
        <div className="topbar-right">
          <span className="season-label">PLAYER DEVELOPMENT <span>·</span> 2025 / 26</span>
          <Link className="edit-profile-button" href="/profile">Edit profile</Link>
          <button
            className="side-nav-button"
            type="button"
            onClick={() => setActiveView("library")}
          >
            <Library size={14} aria-hidden="true" />
            Library
            <span className="side-nav-count">{savedDrills.length}</span>
          </button>
          <Link className="side-nav-button" href="/training-schedule">
            <CalendarDays size={14} aria-hidden="true" />
            Training Schedule
          </Link>
          <Link className="side-nav-button" href="/progress">
            <TrendingUp size={14} aria-hidden="true" />
            Progress
          </Link>
          <SignOutButton />
        </div>
      </header>

      <section className="page-heading" id="home">
        <div>
          <div className="eyebrow"><span className="live-dot" /> YOUR NEXT EDGE STARTS HERE</div>
          <h1>Make every session <span>count.</span></h1>
          <p className="page-description">Turn the coach&apos;s eye into a clearer plan for the pitch.</p>
        </div>
      </section>

      {activeView === "session" ? (
      <div className="split-layout" id="session-view" role="tabpanel" aria-labelledby="session-tab">
        <section className="input-panel" aria-labelledby="input-heading">
          <div className="section-topline">
            <div className="section-index">01</div>
            <span className="section-kicker">START WITH THE DETAILS</span>
            <span className="section-line" />
            <ShieldCheck className="subtle-icon" size={17} aria-hidden="true" />
          </div>

          <div className="panel-heading">
            <div>
              <h2 id="input-heading">The player</h2>
              <p>A little context makes all the difference.</p>
            </div>
            <span className="required-tag"><span /> REQUIRED</span>
          </div>

          <form className="analysis-form" onSubmit={handleAnalyze}>
            <div className="field-group player-profile-summary-group">
              <div className="profile-summary-heading">
                <label htmlFor="player-profile-edit">Player Profile</label>
                <Link className="profile-summary-edit" href="/profile" aria-label="Edit player profile">Edit</Link>
              </div>
              <textarea
                id="player-profile-edit"
                className="profile-summary-input"
                value={profileText}
                readOnly
                rows={4}
                required
                aria-label="Player profile text"
              />
            </div>

            <div className="field-group">
              <label htmlFor="coach-feedback">Coach&apos;s Feedback Notes</label>
              <textarea
                id="coach-feedback"
                name="coach-feedback"
                placeholder={"e.g. Excellent vision and reads the game well. Needs to commit to the weaker foot in tight spaces and get shots off faster around the box."}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                required
              />
              <span className="field-hint">MATCH OBSERVATIONS, HABITS &amp; AREAS TO WORK ON</span>
            </div>

            <div className="field-group player-assessment-group">
              <label htmlFor="player-assessment">
                Your assessment <span>(optional)</span>
              </label>
              <textarea
                id="player-assessment"
                name="player-assessment"
                placeholder="e.g. I feel confident receiving with my right foot, but I struggle to stay composed when defenders close me down."
                value={playerAssessment}
                onChange={(event) => setPlayerAssessment(event.target.value)}
                maxLength={10_000}
              />
              <span className="field-hint">YOUR PERSPECTIVE ON STRENGTHS, CHALLENGES &amp; MATCH EXPERIENCES</span>
            </div>

            <div className="form-bottom">
              <p className="privacy-note"><ShieldCheck size={15} aria-hidden="true" /> NOTES SHARED WITH GEMINI FOR ANALYSIS</p>
              {analysisError && <p className="analysis-error" role="alert">{analysisError}</p>}
              <button className="analyze-button" type="submit" disabled={isAnalyzing} aria-busy={isAnalyzing}>
                <Sparkles size={17} aria-hidden="true" />
                <span>{isAnalyzing ? "Analyzing notes..." : "Analyze performance"}</span>
                <ArrowRight className="button-arrow" size={17} aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>

        <section className="dashboard-panel" aria-labelledby="dashboard-heading" ref={dashboardRef}>
          <div className="section-topline dashboard-topline">
            <div className="section-index">02</div>
            <span className="section-kicker">THE SCOUT&apos;S VIEW</span>
            <span className="section-line" />
            <span className="sample-label"><span /> {hasAnalyzed ? "SESSION ANALYSIS" : "AWAITING ANALYSIS"}</span>
          </div>

          <div className="dashboard-title-row">
            <div>
              <h2 id="dashboard-heading">Analysis dashboard</h2>
              <p className="player-line">
                {hasAnalyzed ? (
                  <><span className="player-indicator" /> {playerName} <span className="player-divider">/</span> {playerMeta}</>
                ) : (
                  "Your report will appear here after analysis"
                )}
              </p>
            </div>
            {hasAnalyzed && (
              <button className="icon-button" type="button" aria-label="Analysis updated just now" title="Updated just now">
                <Clock3 size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          {hasAnalyzed ? (
            <>
          <div className="overview-grid">
            <article className="score-card">
              <div className="score-topline"><Gauge size={15} /> OVERALL RATING <span className="live-score-indicator" /></div>
              <div className="score-content">
                <div className="score-ring" style={{ "--score-angle": `${score * 36}deg` } as React.CSSProperties}>
                  <div className="score-inner"><strong>{score.toFixed(1)}</strong><span>/ 10</span></div>
                </div>
                <div className="score-details">
                  <span className="rating-label">{hasAnalyzed ? "MATCH RATING" : "STRONG FOUNDATION"}</span>
                  <span className="score-player">An exciting<br />all-round profile.</span>
                  {!hasAnalyzed && <span className="rating-change"><TrendingUp size={13} /> TOP 18% OF POSITION</span>}
                </div>
              </div>
              {!hasAnalyzed && <><div className="confidence-track"><span style={{ width: `${confidence}%` }} /></div>
                <div className="confidence-label"><span>ANALYSIS CONFIDENCE</span><strong>{confidence}%</strong></div></>}
            </article>

            <article className="snapshot-card">
              <div className="snapshot-heading"><span>MATCH SNAPSHOT</span><span className="snapshot-dot" /></div>
              <div className="snapshot-stat"><span>Biggest asset</span><span>{strengths[0].name}</span></div>
              <div className="snapshot-stat"><span>Growth focus</span><span>{weaknesses[0].name}</span></div>
              <div className="snapshot-stat"><span>{hasAnalyzed ? "Analysis" : "Readiness"}</span><span className="readiness"><BadgeCheck size={13} /> {hasAnalyzed ? "Complete" : "Match ready"}</span></div>
              <div className="snapshot-footer"><ArrowUpRight size={13} /> {hasAnalyzed ? "PLAYER RATING" : "PROJECTION"} <strong>{hasAnalyzed ? `${score.toFixed(1)} / 10` : "HIGH CEILING"}</strong></div>
            </article>
          </div>

          <article className="insights-card strengths-card">
            <div className="insight-header">
              <div className="insight-icon strengths-icon"><ArrowUpRight size={17} /></div>
              <div className="insight-title"><h3>Strengths</h3><p>Where the game comes naturally.</p></div>
              <span className="insight-count green-count">03 AREAS</span>
            </div>
            <div className="weakness-list">
              {strengths.map((strength, index) => {
                const insightId = `strength-${index}`;
                const isExpanded = expandedInsights.has(insightId);
                return (
                  <div className="weakness-item" key={`${insightId}-${strength.name}`}>
                    <button
                      className={`weakness-row insight-row-toggle${isExpanded ? " is-expanded" : ""}`}
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`${insightId}-details`}
                      onClick={() => toggleInsight(insightId)}
                    >
                      <span className="strength-number" aria-hidden="true">0{index + 1}</span>
                      <span className="weakness-copy insight-row-copy"><strong>{strength.name}</strong></span>
                      <ChevronDown className="insight-chevron" size={14} aria-hidden="true" />
                    </button>
                    <div
                      id={`${insightId}-details`}
                      className="insight-detail-scroll"
                      role="region"
                      aria-label={`${strength.name} details`}
                      hidden={!isExpanded}
                    >
                      {strength.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="insights-card weaknesses-card">
            <div className="insight-header">
              <div className="insight-icon weaknesses-icon"><ArrowDownRight size={17} /></div>
              <div className="insight-title"><h3>Weaknesses</h3><p>Specifics make better players.</p></div>
              <span className="insight-count red-count">03 FOCUS AREAS</span>
            </div>
            <div className="weakness-list">
              {weaknesses.map((weakness, index) => {
                const insightId = `weakness-${index}`;
                const isExpanded = expandedInsights.has(insightId);
                return (
                  <div className="weakness-item" key={`${insightId}-${weakness.name}`}>
                    <button
                      className={`weakness-row insight-row-toggle${isExpanded ? " is-expanded" : ""}`}
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`${insightId}-details`}
                      onClick={() => toggleInsight(insightId)}
                    >
                      <span className="weakness-number" aria-hidden="true">0{index + 1}</span>
                      <span className="weakness-copy insight-row-copy"><strong>{weakness.name}</strong></span>
                      <ChevronDown className="insight-chevron" size={14} aria-hidden="true" />
                    </button>
                    <div
                      id={`${insightId}-details`}
                      className="insight-detail-scroll"
                      role="region"
                      aria-label={`${weakness.name} details`}
                      hidden={!isExpanded}
                    >
                      {weakness.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="insights-card drills-card">
            <div className="insight-header drills-header">
              <div className="insight-icon drills-icon"><Dumbbell size={16} /></div>
              <div className="insight-title"><h3>Training drills</h3><p>Targeted work. Measurable progress.</p></div>
              <span className="drill-time"><Clock3 size={13} /> 37 MIN</span>
            </div>
            <div className="drill-list">
              {drills.map((drill, index) => {
                const DrillIcon = drill.icon;
                return (
                  <div className="drill-row" key={drill.name}>
                    <span className="drill-number">0{index + 1}</span>
                    <span className="drill-icon"><DrillIcon size={15} /></span>
                    <span className="drill-copy"><strong>{drill.name}</strong><small>{drill.detail}</small></span>
                    <a
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${drill.name} soccer drill tutorial`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Find a YouTube tutorial for ${drill.name}`}
                    >
                      <ArrowRight className="drill-arrow" size={15} />
                    </a>
                  </div>
                );
              })}
            </div>
            <div className="drill-footer"><span>BUILT AROUND THIS PLAYER</span><span>{hasAnalyzed ? "MATCH-BASED PLAN" : <>WEEK 01 <span className="footer-divider">/</span> FOUNDATION</>}</span></div>
          </article>

          <footer className="dashboard-footer">
            <span><span className="footer-live-dot" /> JUST ANALYZED</span>
            <span>BUILT FOR THE NEXT 90 MINUTES <Zap size={12} /></span>
          </footer>
            </>
          ) : (
            !isAnalyzing && (
              <div className="dashboard-empty">
                <Sparkles size={20} aria-hidden="true" />
                <p>Enter your coach&apos;s match notes, then select <strong>Analyze performance</strong> to see the results.</p>
              </div>
            )
          )}

          {isAnalyzing && (
            <div className="analysis-loading" role="status" aria-live="polite">
              <div className="loading-orbit" aria-hidden="true">
                <span className="loading-orbit-ring" />
                <LoaderCircle className="loading-spinner" size={42} strokeWidth={1.5} />
                <Activity className="loading-center-icon" size={16} />
              </div>
              <span className="loading-kicker">LIVE PERFORMANCE ANALYSIS</span>
              <p className="loading-title">Finding your next edge<span>...</span></p>
              <p className="loading-description">Reviewing the details. Building your match plan.</p>
              <div className="loading-progress" aria-hidden="true"><span /></div>
            </div>
          )}
        </section>
      </div>
      ) : (
        <section className="library-panel" id="library-view">
          <div className="section-topline">
            <div className="section-index"><Library size={14} aria-hidden="true" /></div>
            <span className="section-kicker">YOUR SAVED TRAINING</span>
            <span className="section-line" />
            <span className="sample-label"><span /> {savedDrills.length} SAVED</span>
          </div>
          <div className="library-heading">
            <div>
              <h2>Library</h2>
              <p>Your drills and previous session analyses.</p>
            </div>
          </div>
          {storageError && <p className="analysis-error" role="alert">{storageError}</p>}
          {savedDrills.length > 0 ? (
            <div className="saved-drill-list">
              {savedDrillGroups.map((group) => (
                <details className="saved-drill-group" key={group.dateKey}>
                  <summary className="saved-drill-date">
                    <time dateTime={group.savedAt}>{group.dateKey}</time>
                    <span>{group.drills.length} {group.drills.length === 1 ? "drill" : "drills"}</span>
                    <ChevronDown className="saved-drill-chevron" size={14} aria-hidden="true" />
                  </summary>
                  {group.drills.map((drill) => (
                    <article className="saved-drill-card" key={drill.id}>
                      <div className="saved-drill-icon"><Target size={17} aria-hidden="true" /></div>
                      <div className="saved-drill-content">
                        <h4>{drill.name}</h4>
                        <p>{drill.detail}</p>
                      </div>
                      <a
                        className="saved-drill-link"
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${drill.name} soccer drill tutorial`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Find a YouTube tutorial for ${drill.name}`}
                      >
                        <ArrowRight size={16} aria-hidden="true" />
                      </a>
                      <button
                        className="saved-drill-delete"
                        type="button"
                        aria-label={`Remove ${drill.name} from your drill library`}
                        onClick={() => removeSavedDrill(drill.id)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </article>
                  ))}
                </details>
              ))}
            </div>
          ) : (
            <div className="library-empty">
              <Library size={23} aria-hidden="true" />
              <h3>Your library is empty</h3>
              <p>Analyze a session and its recommended drills will be saved here automatically.</p>
              <button type="button" className="library-return-button" onClick={() => setActiveView("session")}>
                Go to Session Builder <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          <section className="previous-analyses-section" aria-labelledby="previous-analyses-heading">
            <h3 id="previous-analyses-heading">Previous analyses</h3>
            {previousAnalyses.length ? (
              <div className="previous-analysis-list">
                {previousAnalyses.map((record) => (
                  <Link
                    className="previous-analysis-card"
                    href={`/analysis/${record.id}`}
                    key={record.id}
                  >
                    <span>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(record.createdAt))}</span>
                    <strong>{typeof record.analysis?.rating === "number" ? record.analysis.rating.toFixed(1) : "0.0"} / 10</strong>
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="previous-analysis-empty">No previous analyses yet.</p>
            )}
          </section>
        </section>
      )}

      <footer className="page-footer"><span>NextLevel <span>PERFORMANCE STUDIO</span></span><span>BETTER SESSIONS. BETTER PLAYERS.</span></footer>
    </main>
  );
}

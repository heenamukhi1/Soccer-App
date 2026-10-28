"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
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
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
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
};

const SAVED_DRILLS_KEY = "nextlevel-saved-drills";
const SAVED_DRILLS_EVENT = "nextlevel-saved-drills-change";

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

  return (
    typeof result.rating === "number" &&
    Number.isFinite(result.rating) &&
    result.rating >= 1 &&
    result.rating <= 10 &&
    hasThreeInsights(result.strengths) &&
    hasThreeInsights(result.weaknesses) &&
    hasThreeStrings(result.drills)
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

export default function SessionBuilder() {
  const [activeView, setActiveView] = useState<"session" | "library">("session");
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
  const [profile, setProfile] = useState("");
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState(8.4);
  const [confidence, setConfidence] = useState(91);
  const [playerMeta, setPlayerMeta] = useState("CM / U17");
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [playerName, setPlayerName] = useState("Jordan Mitchell");
  const [strengths, setStrengths] = useState(initialStrengths);
  const [weaknesses, setWeaknesses] = useState(initialWeaknesses);
  const [drills, setDrills] = useState(initialDrills);
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const dashboardRef = useRef<HTMLElement>(null);

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
      profileLength: profile.length,
      matchNotesLength: feedback.length,
    });

    if (window.matchMedia("(max-width: 950px)").matches) {
      dashboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
        body: JSON.stringify({ playerProfile: profile, matchNotes: feedback }),
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

      const [name, age, position] = profile.trim().split("\n")[0].split(",");

      setPlayerName(name?.trim() || "Your player");
      setPlayerMeta(
        [position?.trim(), age?.trim() ? `U${age.trim()}` : undefined]
          .filter(Boolean)
          .join(" / ") || "PLAYER",
      );
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
      persistSavedDrills([
        ...data.drills.map((drill) => ({
          id: crypto.randomUUID(),
          name: drill,
          detail: "Recommended for this player",
          savedAt,
        })),
        ...savedDrills,
      ]);
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
          <SignOutButton />
        </div>
      </header>

      <section className="page-heading" id="home">
        <div>
          <div className="eyebrow"><span className="live-dot" /> YOUR NEXT EDGE STARTS HERE</div>
          <h1>Make every session <span>count.</span></h1>
          <p className="page-description">Turn the coach&apos;s eye into a clearer plan for the pitch.</p>
        </div>
        <nav className="view-tabs" aria-label="Main views" role="tablist">
          <button
            id="session-tab"
            className={`view-tab${activeView === "session" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeView === "session"}
            aria-controls="session-view"
            onClick={() => setActiveView("session")}
          >
            <Dumbbell size={14} aria-hidden="true" />
            Session Builder
          </button>
          <button
            id="library-tab"
            className={`view-tab${activeView === "library" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeView === "library"}
            aria-controls="library-view"
            onClick={() => setActiveView("library")}
          >
            <Library size={14} aria-hidden="true" />
            Drill Library
            <span className="view-tab-count">{savedDrills.length}</span>
          </button>
        </nav>
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
            <div className="field-group">
              <label htmlFor="player-profile">Player Profile <span>(Name, Age, Position)</span></label>
              <textarea
                id="player-profile"
                name="player-profile"
                placeholder={"e.g. Jordan Mitchell, 17, Central Midfielder\nClub: Eastside FC · Preferred foot: right"}
                value={profile}
                onChange={(event) => setProfile(event.target.value)}
                required
              />
              <span className="field-hint">INCLUDE POSITION, PREFERRED FOOT &amp; LEVEL</span>
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
                <p>Enter the player profile and match notes, then select <strong>Analyze performance</strong> to see the results.</p>
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
        <section className="library-panel" id="library-view" role="tabpanel" aria-labelledby="library-tab">
          <div className="section-topline">
            <div className="section-index"><Library size={14} aria-hidden="true" /></div>
            <span className="section-kicker">YOUR SAVED TRAINING</span>
            <span className="section-line" />
            <span className="sample-label"><span /> {savedDrills.length} SAVED</span>
          </div>
          <div className="library-heading">
            <div>
              <h2>Drill Library</h2>
              <p>Your recommended drills, saved so you can come back to them anytime.</p>
            </div>
          </div>
          {storageError && <p className="analysis-error" role="alert">{storageError}</p>}
          {savedDrills.length > 0 ? (
            <div className="saved-drill-list">
              {savedDrillGroups.map((group) => (
                <section className="saved-drill-group" key={group.dateKey} aria-label={`Drills saved ${group.dateKey}`}>
                  <h3 className="saved-drill-date">
                    <time dateTime={group.savedAt}>{group.dateKey}</time>
                  </h3>
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
                </section>
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
        </section>
      )}

      <footer className="page-footer"><span>NextLevel <span>PERFORMANCE STUDIO</span></span><span>BETTER SESSIONS. BETTER PLAYERS.</span></footer>
    </main>
  );
}

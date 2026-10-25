"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Clock3,
  Dumbbell,
  Gauge,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";

type Strength = { name: string; detail: string; value?: number };
type Weakness = { name: string; detail: string };
type Drill = { name: string; detail: string; icon: typeof Target };
type AnalysisResult = {
  rating: number;
  strengths: string[];
  weaknesses: string[];
  drills: string[];
};

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;
  const hasThreeStrings = (items: unknown) =>
    Array.isArray(items) &&
    items.length === 3 &&
    items.every((item) => typeof item === "string" && item.trim().length > 0);

  return (
    typeof result.rating === "number" &&
    Number.isFinite(result.rating) &&
    result.rating >= 1 &&
    result.rating <= 10 &&
    hasThreeStrings(result.strengths) &&
    hasThreeStrings(result.weaknesses) &&
    hasThreeStrings(result.drills)
  );
}

const initialStrengths: Strength[] = [
  { name: "Spatial awareness", detail: "Finds pockets of space early", value: 88 },
  { name: "First touch", detail: "Clean control under pressure", value: 82 },
  { name: "Work rate", detail: "Consistent defensive recovery", value: 76 },
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

export default function Home() {
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
  const dashboardRef = useRef<HTMLElement>(null);

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
          name: strength,
          detail: "Identified from your match notes",
        })),
      );
      setWeaknesses(
        data.weaknesses.map((weakness) => ({
          name: weakness,
          detail: "Development area from your match notes",
        })),
      );
      setDrills(
        data.drills.map((drill, index) => ({
          name: drill,
          detail: "Recommended for this player",
          icon: [Target, Activity, Zap][index],
        })),
      );
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
          <span className="coach-avatar" aria-label="Coach profile">C</span>
        </div>
      </header>

      <section className="page-heading" id="home">
        <div>
          <div className="eyebrow"><span className="live-dot" /> YOUR NEXT EDGE STARTS HERE</div>
          <h1>Make every session <span>count.</span></h1>
          <p className="page-description">Turn the coach&apos;s eye into a clearer plan for the pitch.</p>
        </div>
        <div className="session-chip"><span className="session-chip-dot" /> SESSION BUILDER <span className="session-chip-divider" /> 01</div>
      </section>

      <div className="split-layout">
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
            <span className="sample-label"><span /> {hasAnalyzed ? "SESSION ANALYSIS" : "SAMPLE ANALYSIS"}</span>
          </div>

          <div className="dashboard-title-row">
            <div>
              <h2 id="dashboard-heading">Analysis dashboard</h2>
              <p className="player-line"><span className="player-indicator" /> {playerName} <span className="player-divider">/</span> {playerMeta}</p>
            </div>
            <button className="icon-button" type="button" aria-label="Analysis updated just now" title="Updated just now">
              <Clock3 size={16} aria-hidden="true" />
            </button>
          </div>

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
            <div className="strength-list">
              {strengths.map((strength) => (
                <div className="strength-row" key={strength.name}>
                  <div className="strength-name"><span className="strength-check">✓</span><span><strong>{strength.name}</strong><small>{strength.detail}</small></span></div>
                  <div className="strength-meter">{strength.value !== undefined && <span style={{ width: `${strength.value}%` }} />}</div>
                  <span className="strength-value">{strength.value ?? ""}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="insights-card weaknesses-card">
            <div className="insight-header">
              <div className="insight-icon weaknesses-icon"><ArrowDownRight size={17} /></div>
              <div className="insight-title"><h3>Weaknesses</h3><p>Specifics make better players.</p></div>
              <span className="insight-count red-count">03 FOCUS AREAS</span>
            </div>
            <div className="weakness-list">
              {weaknesses.map((weakness, index) => (
                <div className="weakness-row" key={weakness.name}>
                  <span className="weakness-number">0{index + 1}</span>
                  <span className="weakness-copy"><strong>{weakness.name}</strong><small>{weakness.detail}</small></span>
                  <ArrowRight className="weakness-arrow" size={14} />
                </div>
              ))}
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
                    <ArrowRight className="drill-arrow" size={15} />
                  </div>
                );
              })}
            </div>
            <div className="drill-footer"><span>BUILT AROUND THIS PLAYER</span><span>{hasAnalyzed ? "MATCH-BASED PLAN" : <>WEEK 01 <span className="footer-divider">/</span> FOUNDATION</>}</span></div>
          </article>

          <footer className="dashboard-footer">
            <span><span className="footer-live-dot" /> {hasAnalyzed ? "JUST ANALYZED" : "DEMO DATA"}</span>
            <span>BUILT FOR THE NEXT 90 MINUTES <Zap size={12} /></span>
          </footer>

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

      <footer className="page-footer"><span>NextLevel <span>PERFORMANCE STUDIO</span></span><span>BETTER SESSIONS. BETTER PLAYERS.</span></footer>
    </main>
  );
}

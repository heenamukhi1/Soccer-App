"use client";

import { Activity, CalendarDays, Clock3, Package, Plus, Trash2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import SignOutButton from "../sign-out-button";

type ProgressEntry = {
  id: string;
  date: string;
  rating: number;
  strengths: string[];
  weaknesses: string[];
};

type PlayerGoal = {
  id: string;
  title: string;
  category: string;
  targetRating: number;
  startingRating: number;
  startingCategoryRating?: number;
};

type ScheduleItem = {
  day: string;
  startTime: string;
  name: string;
  durationMinutes: number;
  type: "drill" | "break";
};

const PROGRESS_HISTORY_KEY = "nextlevel-progress-history";
const PLAYER_GOALS_KEY = "nextlevel-player-goals";
const TRAINING_SCHEDULE_KEY = "nextlevel-training-schedule";
const TRAINING_COMPLETED_KEY = "nextlevel-training-completed";
const TRAINING_COMPLETED_HISTORY_KEY = "nextlevel-training-completed-history";
const RADAR_CATEGORIES = ["Passing", "Physicality", "Tactical", "Finishing", "Ball control"];

function categoryForText(text: string) {
  const value = text.toLowerCase();
  if (/pass|vision|distribution|cross/.test(value)) return "Passing";
  if (/speed|strength|fitness|physical|press|stamina|recovery/.test(value)) return "Physicality";
  if (/tactic|position|decision|awareness|shape|defen/.test(value)) return "Tactical";
  if (/finish|shot|shoot|strik|goal/.test(value)) return "Finishing";
  return "Ball control";
}

function matchesGoal(text: string, goal: PlayerGoal) {
  const normalizedText = text.toLowerCase();
  if (categoryForText(text) === goal.category) return true;
  const titleWords = goal.title.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  return titleWords.some((word) => normalizedText.includes(word));
}

function normalizedDrillName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function completionMatchesScheduleItem(completedId: string, item: ScheduleItem) {
  const normalizedId = normalizedDrillName(completedId);
  const normalizedName = normalizedDrillName(item.name);
  return normalizedName.length > 0 && normalizedId.includes(normalizedName);
}

function completedIdMatchesGoal(completedId: string, goal: PlayerGoal) {
  const text = completedId.toLowerCase();
  const categoryAliases: Record<string, RegExp> = {
    Passing: /\b(pass|passing|vision|distribution|distributing|cross|crossing)\b/,
    Physicality: /\b(speed|sprint|strength|fitness|physical|stamina|conditioning|press|pressing|recovery)\b/,
    Tactical: /\b(tactic|tactical|position|positioning|decision|awareness|shape|defen\w*)\b/,
    Finishing: /\b(finish|finishing|shot|shots|shoot|shooting|strike|striking|goal|scoring)\b/,
    "Ball control": /\b(control|dribble|dribbling|touch|trapping|ball mastery)\b/,
  };

  if (categoryAliases[goal.category]?.test(text)) return true;
  const titleWords = goal.title.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  return titleWords.some((word) => text.includes(word));
}

function categoryFeedbackScore(entry: ProgressEntry | undefined, goal: PlayerGoal) {
  if (!entry) return goal.startingCategoryRating ?? goal.startingRating ?? 5;
  const strengths = entry.strengths.filter((text) => matchesGoal(text, goal)).length;
  const weaknesses = entry.weaknesses.filter((text) => matchesGoal(text, goal)).length;
  return Math.max(1, Math.min(10, entry.rating + strengths * 1.2 - weaknesses * 1.0));
}

export default function Progress() {
  const [history, setHistory] = useState<ProgressEntry[]>([]);
  const [goals, setGoals] = useState<PlayerGoal[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [completedDrillIds, setCompletedDrillIds] = useState<string[]>([]);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalCategory, setGoalCategory] = useState("Passing");
  const [goalTarget, setGoalTarget] = useState("8");

  useEffect(() => {
    function loadHistory() {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(PROGRESS_HISTORY_KEY) ?? "[]");
        if (Array.isArray(saved)) {
          const valid = saved.filter((item): item is ProgressEntry =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as ProgressEntry).id === "string" &&
            typeof (item as ProgressEntry).date === "string" &&
            typeof (item as ProgressEntry).rating === "number" &&
            Array.isArray((item as ProgressEntry).strengths) &&
            Array.isArray((item as ProgressEntry).weaknesses),
          ).slice(-10);
          queueMicrotask(() => setHistory(valid));
          return;
        }
      } catch (error) {
        console.error("[progress] Could not read progress history", error);
      }
      queueMicrotask(() => setHistory([]));
    }

    try {
      const savedGoals: unknown = JSON.parse(localStorage.getItem(PLAYER_GOALS_KEY) ?? "[]");
      if (Array.isArray(savedGoals)) {
        const validGoals = savedGoals.filter((item): item is PlayerGoal =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as PlayerGoal).id === "string" &&
          typeof (item as PlayerGoal).title === "string" &&
          typeof (item as PlayerGoal).category === "string" &&
          typeof (item as PlayerGoal).targetRating === "number" &&
          typeof (item as PlayerGoal).startingRating === "number",
        ).slice(0, 4);
        queueMicrotask(() => setGoals(validGoals));
      }
    } catch (error) {
      console.error("[progress] Could not read player goals", error);
    }

    try {
      const savedSchedule: unknown = JSON.parse(localStorage.getItem(TRAINING_SCHEDULE_KEY) ?? "[]");
      if (Array.isArray(savedSchedule)) {
        queueMicrotask(() => setSchedule(savedSchedule.filter((item): item is ScheduleItem =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as ScheduleItem).day === "string" &&
          typeof (item as ScheduleItem).startTime === "string" &&
          typeof (item as ScheduleItem).name === "string" &&
          typeof (item as ScheduleItem).durationMinutes === "number" &&
          ((item as ScheduleItem).type === "drill" || (item as ScheduleItem).type === "break"),
        ) as ScheduleItem[]));
      }
      const savedCompleted: unknown = JSON.parse(localStorage.getItem(TRAINING_COMPLETED_KEY) ?? "[]");
      const savedCompletedHistory: unknown = JSON.parse(localStorage.getItem(TRAINING_COMPLETED_HISTORY_KEY) ?? "[]");
      const completedIds = [
        ...(Array.isArray(savedCompleted) ? savedCompleted : []),
        ...(Array.isArray(savedCompletedHistory) ? savedCompletedHistory : []),
      ].filter((item): item is string => typeof item === "string");
      if (Array.isArray(savedCompleted)) {
        queueMicrotask(() => setCompletedDrillIds(Array.from(new Set(completedIds))));
      }
    } catch (error) {
      console.error("[progress] Could not read training activity", error);
    }

    loadHistory();
    const loadTrainingActivity = () => {
      try {
        const savedSchedule: unknown = JSON.parse(localStorage.getItem(TRAINING_SCHEDULE_KEY) ?? "[]");
        if (Array.isArray(savedSchedule)) {
          setSchedule(savedSchedule.filter((item): item is ScheduleItem =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as ScheduleItem).day === "string" &&
            typeof (item as ScheduleItem).startTime === "string" &&
            typeof (item as ScheduleItem).name === "string" &&
            typeof (item as ScheduleItem).durationMinutes === "number" &&
            ((item as ScheduleItem).type === "drill" || (item as ScheduleItem).type === "break"),
          ));
        }
        const savedCompleted: unknown = JSON.parse(localStorage.getItem(TRAINING_COMPLETED_KEY) ?? "[]");
        const savedCompletedHistory: unknown = JSON.parse(localStorage.getItem(TRAINING_COMPLETED_HISTORY_KEY) ?? "[]");
        const completedIds = [
          ...(Array.isArray(savedCompleted) ? savedCompleted : []),
          ...(Array.isArray(savedCompletedHistory) ? savedCompletedHistory : []),
        ].filter((item): item is string => typeof item === "string");
        setCompletedDrillIds(Array.from(new Set(completedIds)));
      } catch (error) {
        console.error("[progress] Could not refresh training activity", error);
      }
    };
    window.addEventListener("storage", loadHistory);
    window.addEventListener("nextlevel:progress-updated", loadHistory);
    window.addEventListener("nextlevel:training-completed", loadTrainingActivity);
    window.addEventListener("nextlevel:schedule-updated", loadTrainingActivity);
    return () => {
      window.removeEventListener("storage", loadHistory);
      window.removeEventListener("nextlevel:progress-updated", loadHistory);
      window.removeEventListener("nextlevel:training-completed", loadTrainingActivity);
      window.removeEventListener("nextlevel:schedule-updated", loadTrainingActivity);
    };
  }, []);

  const recent = history.slice(-10);
  const latest = recent.at(-1);
  const chartWidth = 700;
  const chartHeight = 250;
  const chartLeft = 44;
  const chartRight = 676;
  const chartTop = 24;
  const chartBottom = 210;
  const points = recent.map((entry, index) => {
    const x = recent.length === 1
      ? (chartLeft + chartRight) / 2
      : chartLeft + (index / (recent.length - 1)) * (chartRight - chartLeft);
    const y = chartBottom - ((entry.rating - 1) / 9) * (chartBottom - chartTop);
    return { x, y, entry };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = points.length
    ? `${chartLeft},${chartBottom} ${linePoints} ${points.at(-1)?.x ?? chartRight},${chartBottom}`
    : "";

  const radarValues = RADAR_CATEGORIES.map((category) => {
    let value = latest ? latest.rating : 5;
    if (latest) {
      const strengths = latest.strengths.filter((text) => categoryForText(text) === category).length;
      const weaknesses = latest.weaknesses.filter((text) => categoryForText(text) === category).length;
      value = Math.max(1, Math.min(10, latest.rating + strengths * 0.7 - weaknesses * 1.1));
    }
    return value;
  });
  const radarCenterX = 180;
  const radarCenterY = 145;
  const radarRadius = 105;
  const radarPoints = radarValues.map((value, index) => {
    const angle = -Math.PI / 2 + index * (2 * Math.PI / RADAR_CATEGORIES.length);
    const radius = (value / 10) * radarRadius;
    return `${radarCenterX + Math.cos(angle) * radius},${radarCenterY + Math.sin(angle) * radius}`;
  }).join(" ");

  const focusCounts = new Map<string, number>();
  recent.forEach((entry) => {
    entry.weaknesses.forEach((weakness) => {
      const category = categoryForText(weakness);
      focusCounts.set(category, (focusCounts.get(category) ?? 0) + 1);
    });
  });
  const recurringFocus = [...focusCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  function addGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = goalTitle.trim();
    const targetRating = Number(goalTarget);
    if (!title || !Number.isFinite(targetRating) || targetRating < 1 || targetRating > 10) return;
    const inferredCategory = categoryForText(title) !== "Ball control" || goalCategory === "Ball control"
      ? categoryForText(title)
      : goalCategory;

    const currentRating = latest?.rating ?? 5;
    const startingCategoryRating = categoryFeedbackScore(latest, {
      id: "",
      title,
      category: inferredCategory,
      targetRating,
      startingRating: currentRating,
    });
    const nextGoal: PlayerGoal = {
      id: crypto.randomUUID(),
      title,
      category: inferredCategory,
      targetRating,
      startingRating: currentRating,
      startingCategoryRating,
    };
    const nextGoals = [...goals, nextGoal].slice(0, 4);
    setGoals(nextGoals);
    try {
      localStorage.setItem(PLAYER_GOALS_KEY, JSON.stringify(nextGoals));
    } catch (error) {
      console.error("[progress] Could not save player goal", error);
    }
    setGoalTitle("");
  }

  function removeGoal(goalId: string) {
    const nextGoals = goals.filter((goal) => goal.id !== goalId);
    setGoals(nextGoals);
    try {
      localStorage.setItem(PLAYER_GOALS_KEY, JSON.stringify(nextGoals));
    } catch (error) {
      console.error("[progress] Could not remove player goal", error);
    }
  }

  return (
    <main className="workspace progress-page">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="NextLevel home">
          <span className="brand-mark" aria-hidden="true"><Activity size={20} strokeWidth={2.6} /></span>
          <span className="brand-name">Next<span>Level</span></span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-tagline">PERFORMANCE STUDIO</span>
        </Link>
        <div className="topbar-right">
          <span className="season-label">PLAYER DEVELOPMENT <span>·</span> 2025 / 26</span>
          <Link className="edit-profile-button" href="/session-builder?view=session">Session Builder</Link>
          <Link className="side-nav-button" href="/session-builder?view=library"><Package size={14} /> Library</Link>
          <Link className="side-nav-button" href="/training-schedule"><Clock3 size={14} /> Training Schedule</Link>
          <SignOutButton />
        </div>
      </header>

      <section className="page-heading">
        <div>
          <div className="eyebrow"><span className="live-dot" /> PERFORMANCE HISTORY</div>
          <h1>Progress <span>over time.</span></h1>
          <p className="page-description">Track ratings and recurring focus areas across your latest analyses.</p>
        </div>
      </section>

      <div className="progress-summary">
        <div><span>ANALYSES</span><strong>{recent.length}</strong></div>
        <div><span>LATEST RATING</span><strong>{latest ? `${latest.rating.toFixed(1)}/10` : "—"}</strong></div>
        <div><span>TOP FOCUS</span><strong>{recurringFocus[0]?.[0] ?? "No data"}</strong></div>
      </div>

      {recent.length ? (
        <div className="progress-grid">
          <section className="progress-card rating-chart-card">
            <div className="progress-card-heading">
              <div><TrendingUp size={15} /><h2>Match ratings</h2></div>
              <span>LAST {recent.length} {recent.length === 1 ? "GAME" : "GAMES"}</span>
            </div>
            <svg className="rating-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Match rating line chart">
              {[1, 3, 5, 7, 9].map((rating) => {
                const y = chartBottom - ((rating - 1) / 9) * (chartBottom - chartTop);
                return <g key={rating}><line x1={chartLeft} y1={y} x2={chartRight} y2={y} /><text x="15" y={y + 4}>{rating}</text></g>;
              })}
              <polygon points={areaPoints} className="rating-area" />
              <polyline points={linePoints} className="rating-line" />
              {points.map((point) => (
                <g key={point.entry.id}>
                  <circle cx={point.x} cy={point.y} r="6" className="rating-point" />
                  <text x={point.x} y="238" textAnchor="middle" className="rating-date">
                    {new Date(point.entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </text>
                </g>
              ))}
            </svg>
          </section>

          <section className="progress-card radar-card">
            <div className="progress-card-heading">
              <div><CalendarDays size={15} /><h2>Performance profile</h2></div>
              <span>LATEST GAME</span>
            </div>
            <svg className="radar-chart" viewBox="0 0 360 290" role="img" aria-label="Latest game performance radar chart">
              {[0.25, 0.5, 0.75, 1].map((scale) => (
                <polygon
                  key={scale}
                  points={RADAR_CATEGORIES.map((_, index) => {
                    const angle = -Math.PI / 2 + index * (2 * Math.PI / RADAR_CATEGORIES.length);
                    const radius = radarRadius * scale;
                    return `${radarCenterX + Math.cos(angle) * radius},${radarCenterY + Math.sin(angle) * radius}`;
                  }).join(" ")}
                  className="radar-grid"
                />
              ))}
              <polygon points={radarPoints} className="radar-area" />
              {RADAR_CATEGORIES.map((category, index) => {
                const angle = -Math.PI / 2 + index * (2 * Math.PI / RADAR_CATEGORIES.length);
                const x = radarCenterX + Math.cos(angle) * (radarRadius + 22);
                const y = radarCenterY + Math.sin(angle) * (radarRadius + 22);
                return <text key={category} x={x} y={y + 4} textAnchor="middle" className="radar-label">{category}</text>;
              })}
            </svg>
          </section>

          <section className="progress-card focus-card">
            <div className="progress-card-heading">
              <div><Activity size={15} /><h2>Recurring focus areas</h2></div>
              <span>LAST {recent.length} {recent.length === 1 ? "GAME" : "GAMES"}</span>
            </div>
            {recurringFocus.length ? (
              <div className="focus-list">
                {recurringFocus.map(([name, count], index) => (
                  <div className="focus-row" key={name}>
                    <span className="focus-rank">{String(index + 1).padStart(2, "0")}</span>
                    <strong>{name}</strong>
                    <div className="focus-track"><span style={{ width: `${Math.max(20, (count / recent.length) * 100)}%` }} /></div>
                    <small>{count} {count === 1 ? "mention" : "mentions"}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="focus-empty">No recurring weakness areas yet.</p>
            )}
          </section>
        </div>
      ) : (
        <section className="progress-empty">
          <TrendingUp size={28} />
          <h2>No progress history yet</h2>
          <p>Analyze a session in the Session Builder. Your ratings and focus areas will appear here.</p>
          <Link className="library-return-button" href="/session-builder?view=session">Analyze a session</Link>
        </section>
      )}

      <section className="progress-card goals-card">
        <div className="progress-card-heading">
          <div><TrendingUp size={15} /><h2>Player goals</h2></div>
          <span>{goals.length}/4 ACTIVE</span>
        </div>

        <form className="goal-form" onSubmit={addGoal}>
          <input
            aria-label="Goal title"
            value={goalTitle}
            onChange={(event) => setGoalTitle(event.target.value)}
            placeholder="New goal, e.g. Improve passing"
            maxLength={80}
          />
          <select
            aria-label="Goal category"
            value={goalCategory}
            onChange={(event) => setGoalCategory(event.target.value)}
          >
            {RADAR_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
          <label className="goal-target">
            <span>Target</span>
            <input
              aria-label="Target rating"
              type="number"
              min="1"
              max="10"
              step="0.1"
              value={goalTarget}
              onChange={(event) => setGoalTarget(event.target.value)}
            />
          </label>
          <button type="submit" className="goal-add-button" disabled={!goalTitle.trim() || goals.length >= 4}>
            <Plus size={14} /> Add goal
          </button>
        </form>

        {goals.length ? (
          <div className="goal-list">
            {goals.map((goal) => {
              const currentRating = categoryFeedbackScore(latest, goal);
              const matchingFeedback = history.filter((entry) =>
                entry.strengths.some((text) => matchesGoal(text, goal) || categoryForText(text) === goal.category),
              ).length;
              const feedbackProgress = Math.min(50, matchingFeedback * 10);
              const completedDrills = schedule.filter((item) => {
                if (item.type !== "drill") return false;
                if (categoryForText(item.name) !== goal.category && !matchesGoal(item.name, goal)) return false;
                return completedDrillIds.some((completedId) => completionMatchesScheduleItem(completedId, item));
              }).length;
              const completedIdsByCategory = new Set(
                completedDrillIds.filter((completedId) => completedIdMatchesGoal(completedId, goal)),
              );
              const detectedCompletedDrills = Math.max(completedDrills, completedIdsByCategory.size);
              const drillProgress = Math.min(20, detectedCompletedDrills * 2);
              const targetReachedBonus =
                currentRating >= goal.targetRating && matchingFeedback > 0 ? 30 : 0;
              const progress = Math.max(0, Math.min(100, feedbackProgress + drillProgress + targetReachedBonus));
              const completed = progress >= 100;

              return (
                <article className={`goal-row${completed ? " is-complete" : ""}`} key={goal.id}>
                  <div className="goal-copy">
                    <span>{goal.category}</span>
                    <strong>{goal.title}</strong>
                  </div>
                  <div className="goal-progress">
                    <div className="goal-progress-label">
                      <span>{completed ? "Goal reached" : `${progress.toFixed(0)}% complete`}</span>
                      <small>{currentRating.toFixed(1)} / {goal.targetRating.toFixed(1)}</small>
                    </div>
                    <div className="goal-track"><span style={{ width: `${progress}%` }} /></div>
                    <p className="goal-breakdown">
                      Coach feedback: {feedbackProgress.toFixed(0)}% · Completed drills: {drillProgress.toFixed(0)}%
                    </p>
                  </div>
                  <button type="button" className="goal-delete" onClick={() => removeGoal(goal.id)} aria-label={`Remove ${goal.title}`}>
                    <Trash2 size={14} />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="goal-empty">Create a goal to track your next target.</p>
        )}
      </section>
    </main>
  );
}

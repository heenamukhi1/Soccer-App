"use client";

import { Activity, CalendarDays, Clock3, Package, Plus, Trash2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import SignOutButton from "../sign-out-button";

type Availability = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
};

type ScheduleItem = {
  day: string;
  startTime: string;
  name: string;
  durationMinutes: number;
  type: "drill" | "break";
};

type PreviousAnalysis = {
  id: string;
  createdAt: string;
  analysis: {
    rating: number;
    drills: string[];
  };
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const EQUIPMENT_OPTIONS = [
  "Soccer ball",
  "Cones",
  "Training goals",
  "Rebounder",
  "Agility ladder",
  "Resistance bands",
  "Access to a pitch",
  "Training partner",
];

const AVAILABILITY_KEY = "nextlevel-training-availability";
const EQUIPMENT_KEY = "nextlevel-training-equipment";
const SCHEDULE_KEY = "nextlevel-training-schedule";
const COMPLETED_KEY = "nextlevel-training-completed";
const COMPLETED_HISTORY_KEY = "nextlevel-training-completed-history";
const WEEK_KEY = "nextlevel-training-week";
const PREVIOUS_ANALYSES_KEY = "nextlevel-previous-analyses";

const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hours = String(Math.floor(index / 4)).padStart(2, "0");
  const minutes = String((index % 4) * 15).padStart(2, "0");
  return `${hours}:${minutes}`;
});

function formatTime12Hour(value: string) {
  const [hoursText, minutesText = "00"] = value.split(":");
  const hours = Number(hoursText);
  if (!Number.isFinite(hours) || hours < 0 || hours > 23) return value;
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutesText.padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function getTimeOptions(currentValue: string) {
  return TIME_OPTIONS.includes(currentValue) ? TIME_OPTIONS : [currentValue, ...TIME_OPTIONS];
}

function normalizeScheduleText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getCurrentWeekStart() {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - distanceFromMonday);
  return start.toISOString().slice(0, 10);
}

function clearExpiredWeeklyData() {
  const currentWeek = getCurrentWeekStart();
  const savedWeek = localStorage.getItem(WEEK_KEY);
  if (savedWeek === currentWeek) return false;
  if (!savedWeek) {
    localStorage.setItem(WEEK_KEY, currentWeek);
    return false;
  }

  localStorage.removeItem(AVAILABILITY_KEY);
  localStorage.removeItem(EQUIPMENT_KEY);
  localStorage.removeItem(SCHEDULE_KEY);
  localStorage.removeItem(COMPLETED_KEY);
  localStorage.removeItem(COMPLETED_HISTORY_KEY);
  localStorage.setItem(WEEK_KEY, currentWeek);
  return true;
}

function getStableScheduleItemId(item: ScheduleItem) {
  return `${item.day}-${item.startTime}-${item.name}`;
}

function normalizeCompletedIds(completedIds: string[], schedule: ScheduleItem[]) {
  return Array.from(new Set(completedIds.map((completedId) => {
    const normalizedId = normalizeScheduleText(completedId);
    const matchingItem = schedule.find((item) =>
      item.type === "drill" &&
      normalizedId.includes(normalizeScheduleText(item.name)),
    );
    return matchingItem ? getStableScheduleItemId(matchingItem) : completedId;
  })));
}

function isPreviousAnalysis(value: unknown): value is PreviousAnalysis {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.analysis !== "object" ||
    record.analysis === null
  ) {
    return false;
  }
  const analysis = record.analysis as Record<string, unknown>;
  return (
    typeof analysis.rating === "number" &&
    Number.isFinite(analysis.rating) &&
    Array.isArray(analysis.drills) &&
    analysis.drills.length > 0 &&
    analysis.drills.every((drill) => typeof drill === "string" && drill.trim().length > 0)
  );
}

function adaptDrillForEquipment(name: string, equipment: string[]) {
  const normalizedName = name.toLowerCase();

  if (!equipment.includes("Rebounder")) {
    if (normalizedName.includes("rebounder")) {
      if (equipment.includes("Training partner")) {
        return "Partner Pass and Turn Receiving Drill";
      }
      if (equipment.includes("Cones")) {
        return "Cone Gate First-Touch and Turn";
      }
      if (equipment.includes("Soccer ball")) {
        return "Ball Control and Turn Drill";
      }
      return "Ground Control and Turn Drill";
    }
  }

  if (equipment.includes("Rebounder")) {
    if (normalizedName.startsWith("partner pass and receive")) {
      return "Rebounder Partner Pass and Turn";
    }
    if (normalizedName.startsWith("cone gate first-touch")) {
      return "Rebounder First-Touch and Turn";
    }
    if (normalizedName.startsWith("directional ball control")) {
      return "Rebounder Ball Control and Turn";
    }
    if (normalizedName === "ground control and turn drill") {
      return "Rebounder First-Touch and Turn";
    }
  }

  return name;
}

function buildScheduleFromDrills(drills: string[], availability: Availability[], equipment: string[]) {
  const schedule: ScheduleItem[] = [];
  const drillCounts = new Map<string, number>();
  const dayOrder = new Map(DAYS.map((day, index) => [day, index]));
  const windows = [...availability].sort((a, b) => {
    const dayDifference = (dayOrder.get(a.day) ?? DAYS.length) - (dayOrder.get(b.day) ?? DAYS.length);
    return dayDifference || a.startTime.localeCompare(b.startTime);
  });
  let drillIndex = 0;

  for (const window of windows) {
    const [startHour, startMinute] = window.startTime.split(":").map(Number);
    const [endHour, endMinute] = window.endTime.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 20) continue;

    let cursor = start;
    let sessionsInWindow = 0;
    while (cursor + 20 <= end && sessionsInWindow < 2) {
      let drill = drills[drillIndex % drills.length];
      let attempts = 0;
      while ((drillCounts.get(drill) ?? 0) >= 2 && attempts < drills.length) {
        drillIndex += 1;
        drill = drills[drillIndex % drills.length];
        attempts += 1;
      }
      if ((drillCounts.get(drill) ?? 0) >= 2) break;

      schedule.push({
        day: window.day,
        startTime: `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`,
        name: adaptDrillForEquipment(drill, equipment),
        durationMinutes: 20,
        type: "drill",
      });
      drillCounts.set(drill, (drillCounts.get(drill) ?? 0) + 1);
      cursor += 20;
      sessionsInWindow += 1;
      drillIndex += 1;

      if (sessionsInWindow < 2 && cursor + 25 <= end) {
        schedule.push({
          day: window.day,
          startTime: `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`,
          name: "Rest break",
          durationMinutes: 5,
          type: "break",
        });
        cursor += 5;
      }
    }
  }

  return schedule;
}

export default function TrainingSchedule({
  initialAnalyses,
}: {
  initialAnalyses: { id: string; createdAt: string; analysis: unknown }[];
}) {
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [previousAnalyses, setPreviousAnalyses] = useState<PreviousAnalysis[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState("");
  const [showAnalysisPicker, setShowAnalysisPicker] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [mounted, setMounted] = useState(false);

  function getScheduleItemId(item: ScheduleItem) {
    return getStableScheduleItemId(item);
  }

  function toggleCompleted(itemId: string) {
    setCompleted((current) => {
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];
      try {
        localStorage.setItem(COMPLETED_KEY, JSON.stringify(next));
        if (!current.includes(itemId)) {
          const previousHistory: unknown = JSON.parse(
            localStorage.getItem(COMPLETED_HISTORY_KEY) ?? "[]",
          );
          const history = Array.isArray(previousHistory)
            ? previousHistory.filter((value): value is string => typeof value === "string")
            : [];
          if (!history.includes(itemId)) {
            localStorage.setItem(
              COMPLETED_HISTORY_KEY,
              JSON.stringify([...history, itemId]),
            );
          }
        }
        window.dispatchEvent(new Event("nextlevel:training-completed"));
        const drillIds = schedule.filter((item) => item.type === "drill").map(getStableScheduleItemId);
        const allDrillsCompleted =
          drillIds.length > 0 && drillIds.every((drillId) => next.includes(drillId));
        if (allDrillsCompleted) {
          setSchedule([]);
          setCompleted([]);
          localStorage.setItem(SCHEDULE_KEY, "[]");
          localStorage.removeItem(COMPLETED_KEY);
          window.dispatchEvent(new Event("nextlevel:schedule-updated"));
          window.dispatchEvent(new Event("nextlevel:training-completed"));
        }
      } catch (error) {
        console.error("[training-schedule] Could not save completed drills", error);
      }
      return next;
    });
  }

  function createScheduleFromAnalysis() {
    const analysis = previousAnalyses.find((item) => item.id === selectedAnalysisId);
    if (!analysis) {
      setScheduleError("Choose a previous analysis first.");
      return;
    }
    if (availability.length === 0) {
      setScheduleError("Add at least one free time before creating a training plan.");
      return;
    }

    const nextSchedule = buildScheduleFromDrills(analysis.analysis.drills, availability, equipment);
    if (nextSchedule.length === 0) {
      setScheduleError("Your availability needs at least 20 minutes for a training session.");
      return;
    }

    try {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(nextSchedule));
      localStorage.setItem(COMPLETED_KEY, "[]");
      localStorage.setItem(WEEK_KEY, getCurrentWeekStart());
      setSchedule(nextSchedule);
      setCompleted([]);
      setScheduleError("");
      setShowAnalysisPicker(false);
      window.dispatchEvent(new Event("nextlevel:schedule-updated"));
    } catch (error) {
      console.error("[training-schedule] Could not create a plan from previous analysis", error);
      setScheduleError("Could not save this training plan. Please try again.");
    }
  }

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
    const expired = clearExpiredWeeklyData();
    if (expired) {
      queueMicrotask(() => {
        setAvailability([]);
        setEquipment([]);
      });
    }
    try {
      const savedAvailability: unknown = JSON.parse(localStorage.getItem(AVAILABILITY_KEY) ?? "[]");
      if (Array.isArray(savedAvailability)) {
        const nextAvailability = savedAvailability.filter((item) =>
          typeof item === "object" &&
          item !== null &&
          "id" in item &&
          typeof item.id === "string" &&
          "day" in item &&
          typeof item.day === "string" &&
          "startTime" in item &&
          typeof item.startTime === "string" &&
          "endTime" in item &&
          typeof item.endTime === "string",
        ) as Availability[];
        queueMicrotask(() => setAvailability(nextAvailability));
      }
    } catch (error) {
      console.error("[training-schedule] Could not read saved availability", error);
    }

    try {
      const savedEquipment: unknown = JSON.parse(localStorage.getItem(EQUIPMENT_KEY) ?? "[]");
      if (Array.isArray(savedEquipment)) {
        const nextEquipment = savedEquipment.filter((item): item is string => typeof item === "string");
        queueMicrotask(() => setEquipment(nextEquipment));
      }
    } catch (error) {
      console.error("[training-schedule] Could not read saved equipment", error);
    }

    try {
      const savedCompleted: unknown = JSON.parse(localStorage.getItem(COMPLETED_KEY) ?? "[]");
      if (Array.isArray(savedCompleted)) {
        const nextCompleted = savedCompleted.filter((item): item is string => typeof item === "string");
        queueMicrotask(() => setCompleted(nextCompleted));
      }
    } catch (error) {
      console.error("[training-schedule] Could not read completed drills", error);
    }

    const weekCheck = window.setInterval(() => {
      if (clearExpiredWeeklyData()) {
        queueMicrotask(() => {
          setAvailability([]);
          setEquipment([]);
          setCompleted([]);
          setSchedule([]);
        });
        window.dispatchEvent(new Event("nextlevel:schedule-updated"));
      }
    }, 60_000);

    return () => window.clearInterval(weekCheck);
  }, []);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(PREVIOUS_ANALYSES_KEY) ?? "[]");
      const localAnalyses = Array.isArray(saved) ? saved.filter(isPreviousAnalysis) : [];
      const serverAnalyses = initialAnalyses.filter(isPreviousAnalysis);
      const byId = new Map<string, PreviousAnalysis>();
      [...serverAnalyses, ...localAnalyses].forEach((analysis) => byId.set(analysis.id, analysis));
      const nextAnalyses = Array.from(byId.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      queueMicrotask(() => {
        setPreviousAnalyses(nextAnalyses);
        setSelectedAnalysisId((current) =>
          nextAnalyses.some((analysis) => analysis.id === current)
            ? current
            : nextAnalyses[0]?.id ?? "",
        );
      });
    } catch (error) {
      console.error("[training-schedule] Could not read previous analyses", error);
      const serverAnalyses = initialAnalyses.filter(isPreviousAnalysis);
      queueMicrotask(() => {
        setPreviousAnalyses(serverAnalyses);
        setSelectedAnalysisId(serverAnalyses[0]?.id ?? "");
      });
    }
  }, [initialAnalyses]);

  useEffect(() => {
    function loadSchedule() {
      clearExpiredWeeklyData();
    try {
      const savedSchedule: unknown = JSON.parse(localStorage.getItem(SCHEDULE_KEY) ?? "[]");
      if (Array.isArray(savedSchedule)) {
          const nextSchedule = savedSchedule.filter((item) =>
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
          ) as ScheduleItem[];
          queueMicrotask(() => {
            setSchedule(nextSchedule);
            setCompleted((current) => {
              const normalized = normalizeCompletedIds(current, nextSchedule);
              localStorage.setItem(COMPLETED_KEY, JSON.stringify(normalized));
              return normalized;
            });
          });
      }
    } catch (error) {
      console.error("[training-schedule] Could not read saved schedule", error);
    }
    }

    loadSchedule();
    window.addEventListener("storage", loadSchedule);
    window.addEventListener("nextlevel:schedule-updated", loadSchedule);
    return () => {
      window.removeEventListener("storage", loadSchedule);
      window.removeEventListener("nextlevel:schedule-updated", loadSchedule);
    };
  }, []);

  function addAvailability() {
    setAvailability((current) => {
      const next = [
        ...current,
        {
        id: crypto.randomUUID(),
        day: "Monday",
        startTime: "16:00",
        endTime: "17:00",
        },
      ];
      localStorage.setItem(AVAILABILITY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function updateAvailability(id: string, field: "day" | "startTime" | "endTime", value: string) {
    setAvailability((current) => {
      const next = current.map((item) => (item.id === id ? { ...item, [field]: value } : item));
      localStorage.setItem(AVAILABILITY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function removeAvailability(id: string) {
    setAvailability((current) => {
      const next = current.filter((item) => item.id !== id);
      localStorage.setItem(AVAILABILITY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleEquipment(item: string) {
    setEquipment((current) => {
      const next = current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item];
      localStorage.setItem(EQUIPMENT_KEY, JSON.stringify(next));

      setSchedule((currentSchedule) => {
        const nextSchedule = currentSchedule.map((scheduleItem) =>
          scheduleItem.type === "drill"
            ? { ...scheduleItem, name: adaptDrillForEquipment(scheduleItem.name, next) }
            : scheduleItem,
        );
        localStorage.setItem(SCHEDULE_KEY, JSON.stringify(nextSchedule));
          setCompleted((currentCompleted) => {
            const normalizedCompleted = normalizeCompletedIds(currentCompleted, nextSchedule);
            localStorage.setItem(COMPLETED_KEY, JSON.stringify(normalizedCompleted));
            return normalizedCompleted;
          });
        window.dispatchEvent(new Event("nextlevel:schedule-updated"));
        return nextSchedule;
      });

      return next;
    });
  }

  return (
    <main className="workspace training-schedule-page">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="NextLevel home">
          <span className="brand-mark" aria-hidden="true"><Activity size={20} strokeWidth={2.6} /></span>
          <span className="brand-name">Next<span>Level</span></span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-tagline">PERFORMANCE STUDIO</span>
        </Link>
        <div className="topbar-right">
          <span className="season-label">PLAYER DEVELOPMENT <span>·</span> 2026 / 27</span>
          <Link className="edit-profile-button" href="/session-builder?view=session">
            Session Builder
          </Link>
          <Link className="side-nav-button" href="/session-builder?view=library">
            <Package size={14} aria-hidden="true" />
            Library
          </Link>
          <Link className="side-nav-button" href="/progress">
            <TrendingUp size={14} aria-hidden="true" />
            Progress
          </Link>
          <SignOutButton />
        </div>
      </header>

      <section className="page-heading">
        <div>
          <div className="eyebrow"><span className="live-dot" /> PLAN FOR THE WEEK</div>
          <h1>Training <span>schedule.</span></h1>
          <p className="page-description">Tell Gemini when you are free and what equipment you have.</p>
        </div>
      </section>

      <div className="training-layout">
        <aside className="training-settings">
          <div className="section-topline">
            <div className="section-index"><CalendarDays size={14} aria-hidden="true" /></div>
            <span className="section-kicker">YOUR WEEK</span>
            <span className="section-line" />
          </div>

          <div className="schedule-settings-heading">
            <div>
              <h2>Availability</h2>
              <p>Add the times you can train each week.</p>
            </div>
            <button className="schedule-add-button" type="button" onClick={addAvailability}>
              <Plus size={14} aria-hidden="true" /> Add time
            </button>
          </div>

          {mounted && availability.length ? (
            <div className="availability-list">
              {availability.map((item) => (
                <div className="availability-row" key={item.id}>
                  <label>
                    <span>Day</span>
                    <select value={item.day} onChange={(event) => updateAvailability(item.id, "day", event.target.value)}>
                      {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>From</span>
                    <select value={item.startTime} onChange={(event) => updateAvailability(item.id, "startTime", event.target.value)}>
                      {getTimeOptions(item.startTime).map((value) => (
                        <option key={value} value={value}>{formatTime12Hour(value)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>To</span>
                    <select value={item.endTime} onChange={(event) => updateAvailability(item.id, "endTime", event.target.value)}>
                      {getTimeOptions(item.endTime).map((value) => (
                        <option key={value} value={value}>{formatTime12Hour(value)}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="availability-delete"
                    type="button"
                    aria-label={`Remove ${item.day} availability`}
                    onClick={() => removeAvailability(item.id)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : mounted ? (
            <p className="availability-empty">No free times added yet. Add a time to build your week.</p>
          ) : (
            <p className="availability-empty">Loading your saved availability...</p>
          )}

          <div className="equipment-heading">
            <Package size={15} aria-hidden="true" />
            <h2>Equipment</h2>
          </div>
          <div className="equipment-options">
            {EQUIPMENT_OPTIONS.map((item) => (
              <label className={`equipment-option${equipment.includes(item) ? " is-selected" : ""}`} key={item}>
                <input
                  type="checkbox"
                  checked={equipment.includes(item)}
                  onChange={() => toggleEquipment(item)}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </aside>

        <section className="generated-schedule">
          <div className="section-topline">
            <div className="section-index"><Clock3 size={14} aria-hidden="true" /></div>
            <span className="section-kicker">MATCH-BASED PLAN</span>
            <span className="section-line" />
            <span className="sample-label"><span /> {schedule.filter((item) => item.type === "drill").length} DRILLS</span>
          </div>
          <div className="schedule-heading">
            <div>
              <h2>Your week</h2>
              <p>Choose a new or saved analysis to build a plan around your availability and equipment.</p>
            </div>
          </div>

          <div className="schedule-plan-actions">
            <div className="schedule-plan-action-buttons">
              <Link className="schedule-new-analysis-button" href="/session-builder?view=session">
                <Plus size={15} aria-hidden="true" />
                Create a new analysis
              </Link>
              <button
                className="schedule-previous-analysis-button"
                type="button"
                onClick={() => {
                  setShowAnalysisPicker((current) => !current);
                  setScheduleError("");
                }}
                disabled={previousAnalyses.length === 0}
              >
                <Clock3 size={14} aria-hidden="true" />
                Use a previous analysis
              </button>
            </div>
            {previousAnalyses.length === 0 && (
              <p className="schedule-analysis-note">
                No saved analyses yet. Create one in Session Builder first.
              </p>
            )}
            {showAnalysisPicker && previousAnalyses.length > 0 && (
              <div className="schedule-analysis-picker">
                <label htmlFor="schedule-analysis-select">Choose an analysis from your Library</label>
                <div className="schedule-analysis-picker-row">
                  <select
                    id="schedule-analysis-select"
                    value={selectedAnalysisId}
                    onChange={(event) => {
                      setSelectedAnalysisId(event.target.value);
                      setScheduleError("");
                    }}
                  >
                    {previousAnalyses.map((analysis) => {
                      const createdAt = new Date(analysis.createdAt);
                      const dateLabel = Number.isNaN(createdAt.getTime())
                        ? "Previous analysis"
                        : createdAt.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          });
                      return (
                        <option key={analysis.id} value={analysis.id}>
                          {dateLabel} · {analysis.analysis.rating.toFixed(1)}/10 · {analysis.analysis.drills.length} drills
                        </option>
                      );
                    })}
                  </select>
                  <button
                    className="schedule-create-plan-button"
                    type="button"
                    onClick={createScheduleFromAnalysis}
                  >
                    Build schedule
                  </button>
                </div>
                {schedule.length > 0 && (
                  <p className="schedule-analysis-note">This will replace your current weekly schedule.</p>
                )}
              </div>
            )}
            {scheduleError && <p className="schedule-build-error" role="alert">{scheduleError}</p>}
          </div>

          {mounted && schedule.length ? (
            <div className="schedule-week">
              {DAYS.map((day) => {
                const dayItems = schedule
                  .filter((item) => item.day.toLowerCase() === day.toLowerCase())
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                if (!dayItems.length) return null;
                return (
                  <section className="schedule-day" key={day}>
                    <h3>{day}</h3>
                    <div className="schedule-items">
                      {dayItems.map((item, index) => (
                        <article
                          className={`schedule-item${item.type === "break" ? " is-break" : ""}${item.type === "drill" && completed.includes(getScheduleItemId(item)) ? " is-completed" : ""}`}
                          key={`${day}-${item.startTime}-${item.name}-${index}`}
                        >
                          <time>{formatTime12Hour(item.startTime)}</time>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.durationMinutes} minutes</span>
                          </div>
                          {item.type === "drill" && (
                            <label className="schedule-complete" aria-label={`Mark ${item.name} as completed`}>
                              <input
                                type="checkbox"
                                checked={completed.includes(getScheduleItemId(item))}
                                onChange={() => toggleCompleted(getScheduleItemId(item))}
                              />
                              <span aria-hidden="true">✓</span>
                            </label>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="schedule-empty">
              <CalendarDays size={24} aria-hidden="true" />
              <h3>No training plan yet</h3>
              <p>Add your availability, then create a new analysis or build a plan from one in your Library.</p>
            </div>
          )}
        </section>
      </div>

      <footer className="page-footer"><span>NextLevel <span>PERFORMANCE STUDIO</span></span><span>BETTER SESSIONS. BETTER PLAYERS.</span></footer>
    </main>
  );
}

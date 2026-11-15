"use client";

import { Activity, ArrowDownRight, ArrowLeft, ArrowUpRight, Dumbbell, Gauge, Library } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Insight = { name: string; detail: string };
type Analysis = {
  rating: number;
  strengths: Insight[];
  weaknesses: Insight[];
  drills: string[];
};

function normalizeAnalysis(value: unknown): Analysis {
  if (typeof value !== "object" || value === null) {
    return { rating: 0, strengths: [], weaknesses: [], drills: [] };
  }

  const source = value as {
    rating?: unknown;
    strengths?: unknown;
    weaknesses?: unknown;
    drills?: unknown;
  };

  const normalizeInsights = (items: unknown): Insight[] => {
    if (!Array.isArray(items)) return [];
    return items.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const insight = item as { name?: unknown; detail?: unknown };
      return [{
        name: typeof insight.name === "string" ? insight.name : "",
        detail: typeof insight.detail === "string" ? insight.detail : "",
      }];
    }).filter((item) => item.name || item.detail);
  };

  const normalizeDrills = (items: unknown): string[] => {
    if (!Array.isArray(items)) return [];
    return items.flatMap((item) => {
      if (typeof item === "string") return item.trim() ? [item] : [];
      if (typeof item === "object" && item !== null) {
        const drill = item as { name?: unknown };
        return typeof drill.name === "string" && drill.name.trim() ? [drill.name] : [];
      }
      return [];
    });
  };

  return {
    rating: typeof source.rating === "number" ? source.rating : 0,
    strengths: normalizeInsights(source.strengths),
    weaknesses: normalizeInsights(source.weaknesses),
    drills: normalizeDrills(source.drills),
  };
}

export default function AnalysisDetail({
  id,
  record,
}: {
  id: string;
  record: { id: string; created_at: string; analysis: Analysis } | null;
}) {
  const [resolvedRecord, setResolvedRecord] = useState<{
    id: string;
    created_at: string;
    analysis: Analysis;
  } | null>(() => record ? {
    ...record,
    analysis: normalizeAnalysis(record.analysis),
  } : null);

  useEffect(() => {
    if (resolvedRecord || typeof window === "undefined") return;

    try {
      const saved = JSON.parse(window.localStorage.getItem("nextlevel-previous-analyses") ?? "[]") as unknown;
      if (!Array.isArray(saved)) return;
      const localRecord = saved.find((item) => {
        if (typeof item !== "object" || item === null) return false;
        const candidate = item as { id?: unknown; createdAt?: unknown; analysis?: unknown };
        return candidate.id === id &&
          typeof candidate.createdAt === "string" &&
          typeof candidate.analysis === "object" &&
          candidate.analysis !== null;
      }) as { id: string; createdAt: string; analysis: Analysis } | undefined;

      if (localRecord) {
        queueMicrotask(() => {
          setResolvedRecord({
            id: localRecord.id,
            created_at: localRecord.createdAt,
            analysis: normalizeAnalysis(localRecord.analysis),
          });
        });
      }
    } catch (error) {
      console.error("[analysis-detail] Could not restore local analysis", error);
    }
  }, [id, resolvedRecord]);

  if (!resolvedRecord) {
    return (
      <main className="workspace analysis-detail-page">
        <header className="topbar">
          <Link className="brand" href="/" aria-label="NextLevel home">
            <span className="brand-mark"><Activity size={20} strokeWidth={2.6} /></span>
            <span className="brand-name">Next<span>Level</span></span>
          </Link>
          <Link className="library-exit-button" href="/session-builder?view=library">
            <ArrowLeft size={15} aria-hidden="true" /> Exit
          </Link>
        </header>
        <section className="library-empty" role="alert">
          <h3>Analysis unavailable</h3>
          <p>This analysis could not be found on this account or in this browser.</p>
          <Link href="/session-builder?view=library" className="library-return-button">
            <Library size={14} aria-hidden="true" /> Back to library
          </Link>
        </section>
      </main>
    );
  }

  const analysis = resolvedRecord?.analysis ?? normalizeAnalysis(null);
  const rating = analysis.rating;
  const strengths = analysis.strengths;
  const weaknesses = analysis.weaknesses;
  const drills = analysis.drills;
  const date = new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(resolvedRecord.created_at));

  return (
    <main className="workspace analysis-detail-page">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="NextLevel home">
          <span className="brand-mark"><Activity size={20} strokeWidth={2.6} /></span>
          <span className="brand-name">Next<span>Level</span></span>
        </Link>
        <Link className="library-exit-button" href="/session-builder?view=library">
          <ArrowLeft size={15} aria-hidden="true" /> Exit
        </Link>
      </header>

      <section className="analysis-detail-heading">
        <div>
          <span className="section-kicker">PREVIOUS ANALYSIS</span>
          <h1>{date}</h1>
        </div>
        <Link href="/session-builder?view=library" className="library-return-button">
          <Library size={14} aria-hidden="true" /> Back to library
        </Link>
      </section>

      <div className="analysis-detail-grid">
        <article className="score-card analysis-detail-rating">
          <div className="score-topline"><Gauge size={15} /> OVERALL RATING</div>
          <div className="analysis-detail-score">{rating.toFixed(1)} <span>/ 10</span></div>
        </article>

        <article className="insights-card strengths-card">
          <div className="insight-header">
            <div className="insight-icon strengths-icon"><ArrowUpRight size={17} /></div>
            <div className="insight-title"><h3>Strengths</h3><p>Where the game comes naturally.</p></div>
          </div>
          <div className="weakness-list">
            {strengths.map((item, index) => (
              <div className="weakness-item" key={`${item.name}-${index}`}>
                <div className="weakness-row"><span className="strength-number">0{index + 1}</span><span className="weakness-copy"><strong>{item.name}</strong><small>{item.detail}</small></span></div>
              </div>
            ))}
          </div>
        </article>

        <article className="insights-card weaknesses-card">
          <div className="insight-header">
            <div className="insight-icon weaknesses-icon"><ArrowDownRight size={17} /></div>
            <div className="insight-title"><h3>Weaknesses</h3><p>Specific areas to improve.</p></div>
          </div>
          <div className="weakness-list">
            {weaknesses.map((item, index) => (
              <div className="weakness-item" key={`${item.name}-${index}`}>
                <div className="weakness-row"><span className="weakness-number">0{index + 1}</span><span className="weakness-copy"><strong>{item.name}</strong><small>{item.detail}</small></span></div>
              </div>
            ))}
          </div>
        </article>

        <article className="insights-card drills-card">
          <div className="insight-header">
            <div className="insight-icon drills-icon"><Dumbbell size={16} /></div>
            <div className="insight-title"><h3>Training drills</h3><p>Recommended from this analysis.</p></div>
          </div>
          <div className="drill-list">
            {drills.map((drill, index) => (
              <div className="drill-row" key={`${drill}-${index}`}>
                <span className="drill-number">0{index + 1}</span>
                <span className="drill-copy"><strong>{drill}</strong></span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}

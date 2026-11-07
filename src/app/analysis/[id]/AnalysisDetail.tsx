"use client";

import { Activity, ArrowDownRight, ArrowLeft, ArrowUpRight, Dumbbell, Gauge, Library } from "lucide-react";
import Link from "next/link";

type Insight = { name: string; detail: string };
type Analysis = {
  rating: number;
  strengths: Insight[];
  weaknesses: Insight[];
  drills: string[];
};

export default function AnalysisDetail({
  record,
}: {
  record: { id: string; created_at: string; analysis: Analysis };
}) {
  const analysis = record.analysis;
  const date = new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(record.created_at));

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
          <div className="analysis-detail-score">{analysis.rating.toFixed(1)} <span>/ 10</span></div>
        </article>

        <article className="insights-card strengths-card">
          <div className="insight-header">
            <div className="insight-icon strengths-icon"><ArrowUpRight size={17} /></div>
            <div className="insight-title"><h3>Strengths</h3><p>Where the game comes naturally.</p></div>
          </div>
          <div className="weakness-list">
            {analysis.strengths.map((item, index) => (
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
            {analysis.weaknesses.map((item, index) => (
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
            {analysis.drills.map((drill, index) => (
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

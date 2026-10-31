import { Activity, ArrowRight, Check, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import SignInButton from "./sign-in-button";

const benefits = [
  {
    icon: Target,
    title: "Advice based on your match",
    detail: "Turn real coach notes into feedback that relates to what happened on the pitch.",
  },
  {
    icon: TrendingUp,
    title: "Know what to work on",
    detail: "See your strengths and growth areas, with clear explanations for each.",
  },
  {
    icon: Sparkles,
    title: "Leave with a plan",
    detail: "Get focused training drills and keep useful ones together in your drill library.",
  },
];

function LandingPage() {
  const googleConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  return (
    <main className="workspace landing">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="NextLevel home">
          <span className="brand-mark" aria-hidden="true">
            <Activity size={20} strokeWidth={2.6} />
          </span>
          <span className="brand-name">Next<span>Level</span></span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-tagline">PERFORMANCE STUDIO</span>
        </a>
        <span className="landing-top-note">PLAYER DEVELOPMENT</span>
      </header>

      <section className="landing-hero" id="home">
        <div className="landing-copy">
          <div className="eyebrow"><span className="live-dot" /> YOUR NEXT EDGE STARTS HERE</div>
          <h1>Make every session <span>count.</span></h1>
          <p className="landing-lede">
            Good feedback should lead to better training. NextLevel turns your coach&apos;s match
            notes into a personal plan to help you keep improving.
          </p>
          <SignInButton configured={googleConfigured} />
          {googleConfigured ? (
            <p className="landing-sign-in-note"><ShieldCheck size={14} /> Secure sign-in with your Google account</p>
          ) : (
            <p className="landing-sign-in-setup" role="status">
              Supabase sign-in is not configured. Add NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, enable Google in Supabase Auth,
              and add the local callback URL. Then restart the app.
            </p>
          )}
        </div>

        <aside className="landing-preview" aria-label="Example player development report">
          <div className="preview-topline">
            <span className="preview-icon"><Activity size={16} /></span>
            <span>YOUR PLAYER PLAN</span>
            <span className="preview-live"><i /> EXAMPLE</span>
          </div>
          <div className="preview-rating">
            <div className="preview-score">8.4<span>/10</span></div>
            <div><strong>A strong foundation</strong><small>Built from your match notes</small></div>
          </div>
          <div className="preview-divider" />
          <div className="preview-item">
            <span className="preview-item-icon preview-strength"><Check size={15} /></span>
            <div><strong>What you do well</strong><small>Clear strengths, with match evidence</small></div>
            <ArrowRight size={15} />
          </div>
          <div className="preview-item">
            <span className="preview-item-icon preview-focus"><Target size={15} /></span>
            <div><strong>What to work on</strong><small>Practical drills picked for your needs</small></div>
            <ArrowRight size={15} />
          </div>
          <div className="preview-foot"><span>FROM FEEDBACK</span><span className="preview-foot-line" /><span>TO YOUR NEXT STEP</span></div>
        </aside>
      </section>

      <section className="landing-benefits" aria-labelledby="benefits-title">
        <div className="landing-section-heading">
          <span className="section-kicker">A CLEARER WAY TO IMPROVE</span>
          <h2 id="benefits-title">From coach&apos;s notes to your next step.</h2>
        </div>
        <div className="benefit-grid">
          {benefits.map(({ icon: Icon, title, detail }, index) => (
            <article className="benefit-card" key={title}>
              <span className="benefit-number">0{index + 1}</span>
              <span className="benefit-icon"><Icon size={18} /></span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-bottom">
        <div>
          <span className="section-kicker">YOUR NEXT SESSION STARTS HERE</span>
          <h2>Ready to find your next edge?</h2>
        </div>
        <SignInButton configured={googleConfigured} />
      </section>

      <footer className="page-footer">
        <span>NextLevel <span>PERFORMANCE STUDIO</span></span>
        <span>BETTER SESSIONS. BETTER PLAYERS.</span>
      </footer>
    </main>
  );
}

export default function Home() {
  return <LandingPage />;
}

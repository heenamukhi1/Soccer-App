import { Activity, ArrowRight, Check, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import { Suspense } from "react";
import { signIn } from "@/auth";
import { connection } from "next/server";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="google-mark">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.62 5.91c4.44-4.1 7.15-10.15 7.15-17.56Z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a24 24 0 0 0 0 21.56l7.98-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.89l-7.62-5.91c-2.12 1.43-4.84 2.27-8.28 2.27-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

function SignInButton({ configured }: { configured: boolean }) {
  if (!configured) {
    return (
      <button className="google-sign-in" type="button" disabled>
        <GoogleMark />
        <span>Google sign-in setup required</span>
      </button>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/session-builder" });
      }}
    >
      <button className="google-sign-in" type="submit">
        <GoogleMark />
        <span>Sign in with Google</span>
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </form>
  );
}

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

async function LandingPage() {
  await connection();
  const googleConfigured =
    Boolean(process.env.AUTH_GOOGLE_ID?.trim()) &&
    Boolean(process.env.AUTH_GOOGLE_SECRET?.trim());

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
              Gemini&apos;s API key does not enable sign-in. To turn on Google sign-in, create a
              Google OAuth web client and add its client ID and secret as AUTH_GOOGLE_ID and
              AUTH_GOOGLE_SECRET in .env.local. Then restart the app.
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
  return (
    <Suspense
      fallback={
        <main className="workspace auth-loading" role="status">
          Loading NextLevel...
        </main>
      }
    >
      <LandingPage />
    </Suspense>
  );
}

// Static UI render — no theme/lang/viewport toggles, just the landing markup
import React from "react";
type LandingCopy = {
  nav: {
    howItWorks: string;
    features: string;
    faq: string;
    login: string;
    register: string;
  };
};
declare global {
  interface Window {
    Icon: any;
    HeroDashboard: any;
    UseCases: any;
    HowItWorks: any;
    Features: any;
    Trust: any;
    FAQ: any;
    FinalCTA: any;
    Footer: any;
    LANDING_COPY: any;
  }
}
/* ── Nav ─────────────────────────────────────────────────── */
export function Nav({ t }: { t: LandingCopy }) {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 dark:border-stone-800 bg-stone-50/85 dark:bg-stone-950/85 backdrop-blur-md backdrop-saturate-150">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-4 h-16 flex items-center gap-3">
        <a href="#top" className="flex items-center gap-2 font-semibold text-[15px] tracking-tight text-stone-950 dark:text-stone-50 flex-shrink-0">
          <span className="text-indigo-500">{/* <window.Icon name="logo" size={26} />*/}</span>
          <span><strong>Arkalyn</strong><span className="text-stone-400 font-medium">-Kitty</span></span>
        </a>
        <nav className="hidden lg:flex items-center gap-1 ml-2">
          {[[t.nav.howItWorks,"#how"],[t.nav.features,"#features"],[t.nav.faq,"#faq"]].map(([label,href]) => (
            <a key={href} href={href} className="px-3 py-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors">{label}</a>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <div className="flex items-center h-9 p-0.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-full">
            <button className="h-8 px-2.5 rounded-full text-xs font-medium bg-stone-950 dark:bg-stone-100 text-white dark:text-stone-950">EN</button>
            <button className="h-8 px-2.5 rounded-full text-xs font-medium text-stone-400 hover:text-stone-700 dark:hover:text-stone-300">தமிழ்</button>
          </div>
          <button aria-label="Toggle theme" className="w-9 h-9 flex items-center justify-center rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:border-stone-300 dark:hover:border-stone-600 transition-colors">
           {/* <window.Icon name="moon" size={16} /> */}
          </button>
          <button className="hidden lg:inline-flex h-9 px-4 rounded-lg text-sm font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">{t.nav.login}</button>
          <button className="hidden lg:inline-flex h-9 px-4 rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white transition-colors shadow-sm shadow-indigo-500/20">{t.nav.register}</button>
        </div>
      </div>
    </header>
  );
}

/* ── Hero ────────────────────────────────────────────────── */
export function Hero({ t }: { t: LandingCopy }) {
  return (
    <section id="top" className="relative overflow-hidden border-b border-stone-200 dark:border-stone-800">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(1200px 500px at 78% -5%, rgba(99,102,241,0.13), transparent 62%), radial-gradient(900px 400px at 3% 12%, rgba(16,185,129,0.07), transparent 68%)"
      }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.45] dark:opacity-[0.2]" style={{
        backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        color: "rgba(120,113,108,0.18)",
        maskImage: "linear-gradient(to bottom, black, transparent 78%)",
        WebkitMaskImage: "linear-gradient(to bottom, black, transparent 78%)",
      }} />

      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 relative">
        <div className="grid lg:grid-cols-[1fr_1.12fr] gap-16 max-[1023px]:gap-10 items-center py-20 lg:py-28 max-[767px]:py-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-full text-xs font-medium text-stone-500 shadow-sm mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" style={{ boxShadow: "0 0 0 3px rgba(16,185,129,0.2)" }} />
              {t.hero.eyebrow}
            </div>
            <h1 className="text-[64px] max-[1279px]:text-[56px] max-[1023px]:text-5xl max-[767px]:text-[34px] font-bold leading-[1.05] tracking-[-0.025em] text-stone-950 dark:text-stone-50 text-balance mb-5">{t.hero.title}</h1>
            <p className="text-lg max-[767px]:text-[15px] text-stone-500 dark:text-stone-400 leading-relaxed max-w-[520px] mb-8 text-pretty">{t.hero.sub}</p>
            <div className="flex flex-wrap gap-3">
              <button className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-[15px] font-semibold bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white transition-colors shadow-md shadow-indigo-500/20">
                {t.hero.ctaPrimary}
                <window.Icon name="arrow" size={16} />
              </button>
              <a href="#how" className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-[15px] font-medium bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-500 transition-colors">{t.hero.ctaSecondary}</a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-7 text-sm text-stone-400">
              {["Free to try","No card required","Built in India"].map(s => (
                <span key={s} className="flex items-center gap-1.5">
                  <window.Icon name="check" size={14} className="text-emerald-500 flex-shrink-0" />
                  {s}
                </span>
              ))}
            </div>
          </div>
          <window.HeroDashboard t={t} />
        </div>
      </div>
    </section>
  );
}

/* ── App root — static, English, light theme ──────────── */
function App() {
  const t = window.LANDING_COPY.en;
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-950 dark:text-stone-50 font-sans antialiased">
      <Nav t={t} />
      <Hero t={t} />
      <window.UseCases t={t} />
      <window.HowItWorks t={t} />
      <window.Features t={t} />
      <window.Trust t={t} />
      <window.FAQ t={t} />
      <window.FinalCTA t={t} />
      <window.Footer t={t} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SegmentedToggle } from "../components/ui";

type Mode = "summary" | "detailed";

interface HowStep {
  step: string;
  title: string;
  summary: string;
  detail: string;
}

interface FeatureItem {
  title: string;
  summary: string;
  detail: string;
}

interface WhyPoint {
  title: string;
  body: string;
}

interface Audience {
  title: string;
  body: string;
}

interface Faq {
  q: string;
  a: string;
}

const AUDIENCE_ICONS = ["🏠", "✈️", "👨‍👩‍👧", "🧑‍🤝‍🧑", "🏢", "🎓"];

function Nav() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("ta") ? "ta" : "en";

  const changeLang = (next: "en" | "ta") => {
    i18n.changeLanguage(next);
    localStorage.setItem("i18n_lang", next);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 dark:border-stone-800 bg-stone-50/85 dark:bg-stone-950/85 backdrop-blur-md backdrop-saturate-150">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-4 h-16 flex items-center gap-3">
        <a href="#top" className="flex items-center gap-2 font-semibold text-[15px] tracking-tight text-stone-950 dark:text-stone-50 flex-shrink-0">
          <span className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-500" />
          <span>
            <strong>Arkalyn</strong>
            <span className="text-stone-400 font-medium">-Kitty</span>
          </span>
        </a>
        <nav className="hidden lg:flex items-center gap-1 ml-2">
          {[
            [t("landing.nav.why"), "#why"],
            [t("landing.nav.howItWorks"), "#how"],
            [t("landing.nav.whoFor"), "#who"],
            [t("landing.nav.features"), "#features"],
            [t("landing.nav.faq"), "#faq"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="px-3 py-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <SegmentedToggle
            variant="light"
            ariaLabel="Language"
            value={lang}
            onChange={changeLang}
            options={[
              { value: "en", label: "EN" },
              { value: "ta", label: "தமிழ்" },
            ]}
          />
          <Link
            to="/login"
            className="hidden lg:inline-flex h-9 px-4 items-center rounded-lg text-sm font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            {t("landing.nav.login")}
          </Link>
          <Link
            to="/register"
            className="inline-flex h-9 px-4 items-center rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white transition-colors shadow-sm shadow-indigo-500/20"
          >
            {t("landing.nav.register")}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { t } = useTranslation();
  const badges = t("landing.hero.badges", { returnObjects: true }) as string[];

  return (
    <section
      id="top"
      className="relative overflow-hidden border-b border-stone-200 dark:border-stone-800"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(1200px 500px at 78% -5%, rgba(99,102,241,0.13), transparent 62%), radial-gradient(900px 400px at 3% 12%, rgba(16,185,129,0.07), transparent 68%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.45] dark:opacity-[0.2]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          color: "rgba(120,113,108,0.18)",
          maskImage: "linear-gradient(to bottom, black, transparent 78%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 78%)",
        }}
      />

      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 relative">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-16 max-[1023px]:gap-10 items-center py-20 lg:py-28 max-[767px]:py-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-full text-xs font-medium text-stone-500 shadow-sm mb-5">
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"
                style={{ boxShadow: "0 0 0 3px rgba(16,185,129,0.2)" }}
              />
              {t("landing.hero.eyebrow")}
            </div>
            <h1 className="text-[64px] max-[1279px]:text-[56px] max-[1023px]:text-5xl max-[767px]:text-[34px] font-bold leading-[1.05] tracking-[-0.025em] text-stone-950 dark:text-stone-50 text-balance mb-5">
              {t("landing.hero.title")}
            </h1>
            <p className="text-lg max-[767px]:text-[15px] text-stone-500 dark:text-stone-400 leading-relaxed max-w-[520px] mb-8 text-pretty">
              {t("landing.hero.sub")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-[15px] font-semibold bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white transition-colors shadow-md shadow-indigo-500/20"
              >
                {t("landing.hero.ctaPrimary")}
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-[15px] font-medium bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
              >
                {t("landing.hero.ctaSecondary")}
              </a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-7 text-sm text-stone-400">
              {badges.map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xl shadow-stone-200/50 dark:shadow-black/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-stone-400">Goa Trip · Grp-26-001</p>
                  <p className="text-2xl font-semibold tracking-tight">₹ 18,400</p>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  {t("landing.hero.cardStatus")}
                </span>
              </div>
              <div className="h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden mb-5">
                <div className="h-full w-[62%] bg-gradient-to-r from-indigo-500 to-violet-500" />
              </div>
              <div className="space-y-3">
                {[
                  { name: "Dinner @ Curlies", who: "Asha", amt: 2400 },
                  { name: "Scooter rental", who: "Karthik", amt: 1800 },
                  { name: "Beach shack stay", who: "Priya", amt: 6200 },
                ].map((e) => (
                  <div key={e.name} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{e.name}</p>
                      <p className="text-xs text-stone-400">{t("landing.hero.cardPaidVia")} · {e.who}</p>
                    </div>
                    <p className="text-sm font-mono text-stone-700 dark:text-stone-300">
                      ₹{e.amt.toLocaleString("en-IN")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl mb-12 max-[767px]:mb-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500 mb-3">{kicker}</p>
      <h2 className="text-4xl max-[767px]:text-3xl font-bold tracking-[-0.02em] text-stone-950 dark:text-stone-50 mb-3">
        {title}
      </h2>
      {sub && (
        <p className="text-base text-stone-500 dark:text-stone-400 leading-relaxed">{sub}</p>
      )}
    </div>
  );
}

function Why() {
  const { t } = useTranslation();
  const points = t("landing.why.points", { returnObjects: true }) as WhyPoint[];

  return (
    <section id="why" className="border-b border-stone-200 dark:border-stone-800">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-20 max-[767px]:py-14">
        <SectionHeader
          kicker={t("landing.why.kicker")}
          title={t("landing.why.title")}
          sub={t("landing.why.sub")}
        />
        <div className="grid md:grid-cols-3 gap-5">
          {points.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6"
            >
              <p className="text-base font-semibold text-stone-950 dark:text-stone-50 mb-2">{p.title}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("summary");
  const steps = t("landing.howItWorks.steps", { returnObjects: true }) as HowStep[];

  return (
    <section id="how" className="border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/40">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-20 max-[767px]:py-14">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <SectionHeader
            kicker={t("landing.howItWorks.kicker")}
            title={t("landing.howItWorks.title")}
            sub={t("landing.howItWorks.sub")}
          />
          <SegmentedToggle
            variant="light"
            ariaLabel={t("landing.howItWorks.kicker")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "summary", label: t("landing.howItWorks.modeSummary") },
              { value: "detailed", label: t("landing.howItWorks.modeDetailed") },
            ]}
          />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s) => (
            <div
              key={s.step}
              className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 p-6"
            >
              <p className="text-xs font-mono text-indigo-500 mb-3">{s.step}</p>
              <p className="text-base font-semibold text-stone-950 dark:text-stone-50 mb-2">{s.title}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">{s.summary}</p>
              {mode === "detailed" && (
                <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mt-3 pt-3 border-t border-stone-200 dark:border-stone-800">
                  {s.detail}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhoFor() {
  const { t } = useTranslation();
  const audiences = t("landing.whoFor.audiences", { returnObjects: true }) as Audience[];

  return (
    <section id="who" className="border-b border-stone-200 dark:border-stone-800">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-20 max-[767px]:py-14">
        <SectionHeader
          kicker={t("landing.whoFor.kicker")}
          title={t("landing.whoFor.title")}
          sub={t("landing.whoFor.sub")}
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {audiences.map((a, i) => (
            <div
              key={a.title}
              className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6"
            >
              <div className="text-2xl mb-3">{AUDIENCE_ICONS[i]}</div>
              <p className="text-base font-semibold text-stone-950 dark:text-stone-50 mb-2">{a.title}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("summary");
  const items = t("landing.features.items", { returnObjects: true }) as FeatureItem[];

  return (
    <section id="features" className="border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/40">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-20 max-[767px]:py-14">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <SectionHeader kicker={t("landing.features.kicker")} title={t("landing.features.title")} />
          <SegmentedToggle
            variant="light"
            ariaLabel={t("landing.features.kicker")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "summary", label: t("landing.features.modeSummary") },
              { value: "detailed", label: t("landing.features.modeDetailed") },
            ]}
          />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 p-6"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/15 to-violet-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-500 mb-4">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2 7.5L5.5 11L12 3.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-base font-semibold text-stone-950 dark:text-stone-50 mb-2">{f.title}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">{f.summary}</p>
              {mode === "detailed" && (
                <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mt-3 pt-3 border-t border-stone-200 dark:border-stone-800">
                  {f.detail}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const { t } = useTranslation();
  const items = t("landing.faq.items", { returnObjects: true }) as Faq[];

  return (
    <section id="faq" className="border-b border-stone-200 dark:border-stone-800">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-20 max-[767px]:py-14">
        <SectionHeader kicker={t("landing.faq.kicker")} title={t("landing.faq.title")} />
        <div className="max-w-3xl divide-y divide-stone-200 dark:divide-stone-800 border-y border-stone-200 dark:border-stone-800">
          {items.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none">
                <span className="text-base font-semibold text-stone-950 dark:text-stone-50">{f.q}</span>
                <span className="w-6 h-6 flex items-center justify-center text-stone-400 group-open:rotate-45 transition-transform">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mt-3 pr-10">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  const { t } = useTranslation();

  return (
    <section className="bg-white dark:bg-stone-900/40">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-20 max-[767px]:py-14 text-center">
        <h2 className="text-4xl max-[767px]:text-3xl font-bold tracking-[-0.02em] text-stone-950 dark:text-stone-50 mb-3">
          {t("landing.finalCTA.title")}
        </h2>
        <p className="text-base text-stone-500 dark:text-stone-400 mb-7">
          {t("landing.finalCTA.sub")}
        </p>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-[15px] font-semibold bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white transition-colors shadow-md shadow-indigo-500/20"
        >
          {t("landing.finalCTA.cta")}
        </Link>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-950 dark:text-stone-50 font-sans antialiased">
      <Nav />
      <Hero />
      <Why />
      <HowItWorks />
      <WhoFor />
      <Features />
      <FAQ />
      <FinalCTA />
    </div>
  );
}

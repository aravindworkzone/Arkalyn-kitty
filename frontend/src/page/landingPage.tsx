import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SegmentedToggle, Logo } from "../components/ui";
import DemoShowcase from "../components/landing/DemoShowcase";
import { PUBLIC_PLANS, TIER_ORDER, planFeatureLines } from "../helpers/plans";
import type { PlanTier } from "../interface/subscription";
import ContactModal from "../components/ContactModal";
import type { ContactKind } from "../interface/contact";

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
  const [menuOpen, setMenuOpen] = useState(false);

  const changeLang = (next: "en" | "ta") => {
    i18n.changeLanguage(next);
    localStorage.setItem("i18n_lang", next);
  };

  const navLinks: [string, string][] = [
    [t("landing.nav.why"), "#why"],
    [t("landing.nav.howItWorks"), "#how"],
    [t("landing.nav.whoFor"), "#who"],
    [t("landing.nav.features"), "#features"],
    [t("landing.nav.pricing"), "#pricing"],
    [t("landing.nav.faq"), "#faq"],
  ];

  const ScrollSmooth = (href: string) => {
    if(!href) return;
    document.querySelector(href)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface-hover/85 /85 backdrop-blur-md backdrop-saturate-150 pt-safe">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-4 h-16 sm:h-20 flex items-center gap-3">
        <a onClick={() => ScrollSmooth("#top")} className="flex items-center gap-2 font-semibold text-theme-sm tracking-tight text-fg flex-shrink-0">
          <Logo variant="mini" className="h-10 w-10 sm:h-12 sm:w-12 rounded-md" />
          <Logo variant="word" className="h-10 w-24 sm:h-12 sm:w-28 rounded-md" />
        </a>
        <nav className="hidden lg:flex items-center gap-1 ml-2">
          {navLinks.map(([label, href]) => (
            <a
              key={href}
              onClick={() => ScrollSmooth(href)}
              className="px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-brand-50 dark:hover:bg-brand-950/30 rounded-lg transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <SegmentedToggle
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
            className="hidden lg:inline-flex h-9 px-4 items-center rounded-lg text-sm font-medium text-fg hover:bg-surface-hover transition-colors"
          >
            {t("landing.nav.login")}
          </Link>
          <Link
            to="/register"
            className="hidden sm:inline-flex h-9 px-4 items-center rounded-lg text-sm font-semibold bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-on-accent transition-colors shadow-sm shadow-brand-500/20"
          >
            {t("landing.nav.register")}
          </Link>

          {/* Mobile hamburger — hidden on lg+ where full nav shows */}
          <button
            type="button"
            onClick={() => setMenuOpen((p) => !p)}
            className="lg:hidden min-h-touch min-w-touch flex items-center justify-center rounded-lg text-fg hover:bg-surface-hover active:bg-surface-hover transition-colors"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              {menuOpen ? (
                <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {menuOpen && (
        <div className="lg:hidden border-t border-line bg-surface pb-safe">
          <nav className="max-w-screen-xl mx-auto px-4 py-3 flex flex-col gap-1">
            {navLinks.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="px-3 min-h-touch flex items-center text-theme-sm font-medium text-fg hover:bg-brand-50 dark:hover:bg-brand-950/30 active:bg-brand-50 dark:active:bg-brand-950/30 rounded-lg transition-colors"
              >
                {label}
              </a>
            ))}
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 px-3 min-h-touch flex items-center text-theme-sm font-medium text-fg border-t border-line pt-3"
            >
              {t("landing.nav.login")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero() {
  const { t } = useTranslation();
  const badges = t("landing.hero.badges", { returnObjects: true }) as string[];

  return (
    <section
      id="top"
      className="relative overflow-hidden border-b border-line"
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
        <div className="grid lg:grid-cols-[1fr_1fr] gap-16 max-[1023px]:gap-10 items-center py-24 lg:py-32 max-[767px]:py-14">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-raised border border-line rounded-full text-xs font-medium text-fg-muted shadow-sm mb-5">
              <span
                className="w-1.5 h-1.5 rounded-full bg-success-500 flex-shrink-0"
                style={{ boxShadow: "0 0 0 3px rgba(16,185,129,0.2)" }}
              />
              {t("landing.hero.eyebrow")}
            </div>
            <h1 className="text-title-md max-[1279px]:text-title-md max-[1023px]:text-5xl max-[767px]:text-title-md font-bold leading-[1.05] tracking-[-0.025em] text-fg text-balance mb-5">
              {t("landing.hero.title")}
            </h1>
            <p className="text-lg max-[767px]:text-theme-sm text-fg-muted leading-relaxed max-w-[520px] mb-8 text-pretty">
              {t("landing.hero.sub")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-theme-sm font-semibold bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-on-accent transition-colors shadow-md shadow-brand-500/20"
              >
                {t("landing.hero.ctaPrimary")}
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-theme-sm font-medium bg-surface-raised border border-line text-fg hover:border-line-strong active:border-line-strong transition-colors"
              >
                {t("landing.hero.ctaSecondary")}
              </a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-7 text-sm text-fg-muted">
              {badges.map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-success-500" />
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <DemoShowcase />
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl mb-12 max-[767px]:mb-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-500 mb-3">{kicker}</p>
      <h2 className="text-4xl max-[767px]:text-3xl font-bold tracking-[-0.02em] text-fg mb-3">
        {title}
      </h2>
      {sub && (
        <p className="text-base text-fg-muted leading-relaxed">{sub}</p>
      )}
    </div>
  );
}

function Why() {
  const { t } = useTranslation();
  const points = t("landing.why.points", { returnObjects: true }) as WhyPoint[];

  return (
    <section id="why" className="border-b border-line">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-24 max-[767px]:py-16">
        <SectionHeader
          kicker={t("landing.why.kicker")}
          title={t("landing.why.title")}
          sub={t("landing.why.sub")}
        />
        <div className="grid md:grid-cols-3 gap-5">
          {points.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-line bg-surface-raised p-6"
            >
              <p className="text-base font-semibold text-fg mb-2">{p.title}</p>
              <p className="text-sm text-fg-muted leading-relaxed">{p.body}</p>
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
    <section id="how" className="border-b border-line bg-surface-raised/40">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-24 max-[767px]:py-16">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <SectionHeader
            kicker={t("landing.howItWorks.kicker")}
            title={t("landing.howItWorks.title")}
            sub={t("landing.howItWorks.sub")}
          />
          <SegmentedToggle
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
              className="rounded-2xl border border-line bg-surface p-6"
            >
              <p className="text-xs font-mono text-brand-500 mb-3">{s.step}</p>
              <p className="text-base font-semibold text-fg mb-2">{s.title}</p>
              <p className="text-sm text-fg-muted leading-relaxed">{s.summary}</p>
              {mode === "detailed" && (
                <p className="text-sm text-fg-muted leading-relaxed mt-3 pt-3 border-t border-line">
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
    <section id="who" className="border-b border-line">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-24 max-[767px]:py-16">
        <SectionHeader
          kicker={t("landing.whoFor.kicker")}
          title={t("landing.whoFor.title")}
          sub={t("landing.whoFor.sub")}
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {audiences.map((a, i) => (
            <div
              key={a.title}
              className="rounded-2xl border border-line bg-surface-raised p-6"
            >
              <div className="text-2xl mb-3">{AUDIENCE_ICONS[i]}</div>
              <p className="text-base font-semibold text-fg mb-2">{a.title}</p>
              <p className="text-sm text-fg-muted leading-relaxed">{a.body}</p>
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
    <section id="features" className="border-b border-line bg-surface-raised/40">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-24 max-[767px]:py-16">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <SectionHeader kicker={t("landing.features.kicker")} title={t("landing.features.title")} />
          <SegmentedToggle
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
              className="rounded-2xl border border-line bg-surface p-6"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500/15 to-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-500 mb-4">
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
              <p className="text-base font-semibold text-fg mb-2">{f.title}</p>
              <p className="text-sm text-fg-muted leading-relaxed">{f.summary}</p>
              {mode === "detailed" && (
                <p className="text-sm text-fg-muted leading-relaxed mt-3 pt-3 border-t border-line">
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

const PRICING_THEME: Record<PlanTier, { accent: string; chip: string }> = {
  FREE: { accent: "text-fg-muted", chip: "bg-surface-hover text-fg-muted" },
  PRO: { accent: "text-brand-500", chip: "bg-brand-100 dark:bg-brand-950/40 text-brand-500" },
  PREMIUM: { accent: "text-warning-500", chip: "bg-warning-100 dark:bg-warning-950/40 text-warning-500" },
};

function Pricing() {
  const { t } = useTranslation();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  return (
    <section id="pricing" className="border-b border-line">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-24 max-[767px]:py-16">
        <SectionHeader
          kicker={t("landing.pricing.kicker")}
          title={t("landing.pricing.title")}
          sub={t("landing.pricing.sub")}
        />

        {/* Billing cycle toggle */}
        <div className="mb-10 max-[767px]:mb-8">
          <SegmentedToggle
            ariaLabel={t("landing.pricing.kicker")}
            value={cycle}
            onChange={setCycle}
            options={[
              { value: "monthly", label: t("landing.pricing.monthly") },
              { value: "yearly", label: `${t("landing.pricing.yearly")} · ${t("landing.pricing.save")}` },
            ]}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-start">
          {TIER_ORDER.map((tier) => {
            const cfg = PUBLIC_PLANS[tier];
            const theme = PRICING_THEME[tier];
            const isPopular = tier === "PRO";
            const price = cycle === "yearly" ? cfg.priceYearly : cfg.priceMonthly;
            const perMonth = cycle === "yearly" && price > 0 ? Math.round(price / 12) : null;

            return (
              <div
                key={tier}
                className={`relative rounded-2xl border bg-surface-raised p-6 flex flex-col ${
                  isPopular
                    ? "border-brand-300 dark:border-brand-800 ring-1 ring-brand-200 dark:ring-brand-900/50 md:-translate-y-3"
                    : "border-line"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand-500 text-on-accent text-theme-2xs font-bold uppercase tracking-wider shadow-md shadow-brand-500/30">
                    {t("landing.pricing.popular")}
                  </div>
                )}

                <div className="flex items-center gap-2.5 mb-4">
                  <span className={`text-sm font-bold uppercase tracking-wide ${theme.accent}`} translate="no">
                    {cfg.name}
                  </span>
                </div>

                <div className="mb-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold tracking-tight text-fg" translate="no">
                      ₹{price}
                    </span>
                    {tier !== "FREE" && (
                      <span className="text-sm text-fg-muted">
                        {cycle === "yearly" ? t("landing.pricing.perYear") : t("landing.pricing.perMonth")}
                      </span>
                    )}
                  </div>
                  <p className="text-theme-xs text-fg-muted mt-1 h-4" translate="no">
                    {tier === "FREE"
                      ? t("landing.pricing.freeForever")
                      : perMonth !== null
                      ? `≈ ₹${perMonth}${t("landing.pricing.perMonth")}`
                      : ""}
                  </p>
                </div>

                <div className="my-5 h-px bg-line " />

                <ul className="space-y-2.5 flex-1">
                  {planFeatureLines(tier, cfg).map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2.5 text-theme-sm text-fg leading-snug"
                    >
                      <svg className="w-4 h-4 mt-0.5 shrink-0 text-success-500" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.12" />
                        <path d="M5 8.2l2 2 4-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {line}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/register"
                  className={`mt-6 w-full inline-flex items-center justify-center rounded-xl py-3 text-sm font-semibold transition-colors ${
                    isPopular
                      ? "bg-brand-500 hover:bg-brand-600 text-on-accent shadow-md shadow-brand-500/20"
                      : "bg-surface-hover hover:bg-line text-fg"
                  }`}
                >
                  {tier === "FREE" ? t("landing.pricing.ctaFree") : t("landing.pricing.ctaUpgrade", { plan: cfg.name })}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-theme-xs text-fg-muted">{t("landing.pricing.note")}</p>
          <Link
            to="/plans"
            className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-500 transition-colors"
          >
            {t("landing.pricing.detailsLink")}
          </Link>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const { t } = useTranslation();
  const items = t("landing.faq.items", { returnObjects: true }) as Faq[];

  return (
    <section id="faq" className="border-b border-line">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-24 max-[767px]:py-16">
        <SectionHeader kicker={t("landing.faq.kicker")} title={t("landing.faq.title")} />
        <div className="max-w-3xl divide-y divide-line border-y border-line">
          {items.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none">
                <span className="text-base font-semibold text-fg">{f.q}</span>
                <span className="w-6 h-6 flex items-center justify-center text-fg-muted group-open:rotate-45 transition-transform">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="text-sm text-fg-muted leading-relaxed mt-3 pr-10">{f.a}</p>
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
    <section className="bg-surface-raised/40">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-24 max-[767px]:py-16 text-center">
        <h2 className="text-4xl max-[767px]:text-3xl font-bold tracking-[-0.02em] text-fg mb-3">
          {t("landing.finalCTA.title")}
        </h2>
        <p className="text-base text-fg-muted mb-7">
          {t("landing.finalCTA.sub")}
        </p>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-theme-sm font-semibold bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-on-accent transition-colors shadow-md shadow-brand-500/20"
        >
          {t("landing.finalCTA.cta")}
        </Link>
      </div>
    </section>
  );
}

function Footer({ onContact }: { onContact: (kind: ContactKind) => void }) {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-line bg-surface">
      <div className="max-w-screen-xl mx-auto px-8 max-[767px]:px-5 py-16 max-[767px]:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <Logo variant="word" className="h-9 w-28 rounded-md mb-3" />
            <p className="text-sm text-fg-muted max-w-xs leading-relaxed">
              {t("landing.support.tagline")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onContact("question")}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-medium bg-surface-raised border border-line text-fg hover:border-line-strong transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M6.2 6.3a1.8 1.8 0 113.1 1.2c-.5.5-1.1.8-1.1 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="8" cy="11.4" r="0.7" fill="currentColor" />
              </svg>
              {t("landing.support.askCta")}
            </button>
            <button
              type="button"
              onClick={() => onContact("report")}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-medium bg-surface-raised border border-line text-fg hover:border-line-strong transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M8 2.5l6 11H2l6-11z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M8 6.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="8" cy="11.4" r="0.7" fill="currentColor" />
              </svg>
              {t("landing.support.reportCta")}
            </button>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs text-fg-muted">
          <span>© {new Date().getFullYear()} {t("brand")}</span>
          <Link to="/plans" className="hover:text-fg transition-colors">
            {t("landing.nav.pricing")}
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const [contactOpen, setContactOpen] = useState(false);
  const [contactKind, setContactKind] = useState<ContactKind>("question");

  const openContact = (kind: ContactKind) => {
    setContactKind(kind);
    setContactOpen(true);
  };

  return (
    <div className="min-h-screen bg-surface text-fg font-sans antialiased">
      <Nav />
      <Hero />
      <Why />
      <HowItWorks />
      <WhoFor />
      <Features />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer onContact={openContact} />
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} initialKind={contactKind} />
    </div>
  );
}

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, animate, useReducedMotion } from "framer-motion";

/* ------------------------------------------------------------------ *
 * DemoShowcase — a self-contained, looping 6-screen product walkthrough
 * rendered inside a phone mockup. Drops into the landing hero (right).
 * Auto-advances every 2.5s; pauses while hovered.
 * ------------------------------------------------------------------ */

const ADVANCE_MS = 2500;
const GROUP_NAME = "Trip to Ooty";

// Cubic-bezier tuples kept as mutable tuples so they satisfy framer's Easing type.
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EASE_SLIDE: [number, number, number, number] = [0.4, 0, 0.2, 1];

const SCREENS = [
  "Create Group",
  "Add Members",
  "Contribute to Pool",
  "Add Expense",
  "View Report",
  "Close Group",
] as const;

type Member = { name: string; initials: string; avatar: string };

const MEMBERS: Member[] = [
  { name: "Aravind", initials: "A", avatar: "bg-brand-500" },
  { name: "Priya", initials: "P", avatar: "bg-success-500" },
  { name: "Karthik", initials: "K", avatar: "bg-warning-500" },
];

// Report data — single Travel expense (₹1,200) is the only spend so far,
// keeping the demo internally consistent: ₹3,000 pool − ₹1,200 = ₹1,800 left.
const CATEGORIES = [
  { name: "Travel", amount: 1200, fill: "bg-brand-500", dot: "bg-brand-500" },
  { name: "Food", amount: 0, fill: "bg-line", dot: "bg-line " },
  { name: "Stay", amount: 0, fill: "bg-line", dot: "bg-line " },
];

/* ---------------------------- animation helpers --------------------------- */

const rise = (delay: number, reduced: boolean) =>
  reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25 } }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, delay, ease: EASE },
      };

const listContainer = (reduced: boolean, delayChildren = 0.28) => ({
  initial: "hidden" as const,
  animate: "show" as const,
  variants: {
    hidden: {},
    show: {
      transition: {
        delayChildren: reduced ? 0 : delayChildren,
        staggerChildren: reduced ? 0 : 0.1,
      },
    },
  },
});

const listItem = (reduced: boolean) => ({
  hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
});

/* -------------------------------- primitives ------------------------------ */

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function SignalIcon() {
  return (
    <svg viewBox="0 0 18 12" className="h-[10px] w-[18px]" fill="currentColor" aria-hidden="true">
      <rect x="0" y="8" width="3" height="4" rx="1" />
      <rect x="5" y="6" width="3" height="6" rx="1" />
      <rect x="10" y="3.5" width="3" height="8.5" rx="1" />
      <rect x="15" y="1" width="3" height="11" rx="1" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg viewBox="0 0 28 12" className="h-3 w-7" fill="none" aria-hidden="true">
      <rect x="0.5" y="1" width="23" height="10" rx="3" stroke="currentColor" strokeOpacity="0.4" />
      <rect x="2.5" y="3" width="16" height="6" rx="1.5" fill="currentColor" />
      <rect x="25" y="4" width="2" height="4" rx="1" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

function Spinner() {
  return (
    <motion.span
      className="block h-3.5 w-3.5 rounded-full border-2 border-line-strong border-t-white"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
    />
  );
}

function Avatar({ member, size = 36 }: { member: Member; size?: number }) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-on-accent ${member.avatar}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {member.initials}
    </div>
  );
}

function MemberBadge() {
  return (
    <span className="rounded-md border border-brand-500/20 bg-brand-500/10 px-1.5 py-0.5 text-theme-2xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
      Member
    </span>
  );
}

/** Counts up to `to` and renders it as a formatted ₹ amount. */
function Counter({ to, duration = 1.4, delay = 0.35 }: { to: number; duration?: number; delay?: number }) {
  const reduced = !!useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (reduced) {
      setValue(to);
      return;
    }
    const controls = animate(0, to, {
      duration,
      delay,
      ease: "easeOut",
      onUpdate: (latest) => setValue(latest),
    });
    return () => controls.stop();
  }, [to, duration, delay, reduced]);

  return <span>{`₹${Math.round(value).toLocaleString("en-IN")}`}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-theme-2xs font-semibold uppercase tracking-wide text-fg-muted">
        {label}
      </p>
      <div className="flex min-h-[46px] items-center rounded-xl border border-line bg-surface-hover px-3.5 text-theme-sm font-medium text-fg /60 ">
        {children}
      </div>
    </div>
  );
}

/** Shared per-screen layout: animated eyebrow + title + optional sub. */
function ScreenShell({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  const reduced = !!useReducedMotion();
  return (
    <div className="flex h-full flex-col">
      <motion.p
        {...rise(0.04, reduced)}
        className="text-theme-xs font-semibold uppercase tracking-wider text-brand-500"
      >
        {eyebrow}
      </motion.p>
      <motion.h3
        {...rise(0.1, reduced)}
        className="mt-1 text-theme-xl font-bold tracking-tight text-fg"
      >
        {title}
      </motion.h3>
      {sub && (
        <motion.p
          {...rise(0.16, reduced)}
          className="mt-1 text-[12.5px] leading-snug text-fg-muted"
        >
          {sub}
        </motion.p>
      )}
      <div className="mt-4 flex-1">{children}</div>
    </div>
  );
}

/* --------------------------------- screens -------------------------------- */

function CreateGroupScreen() {
  const reduced = !!useReducedMotion();
  const [typed, setTyped] = useState(reduced ? GROUP_NAME : "");
  const [created, setCreated] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    let i = 0;
    const typer = window.setInterval(() => {
      i += 1;
      setTyped(GROUP_NAME.slice(0, i));
      if (i >= GROUP_NAME.length) window.clearInterval(typer);
    }, 62);
    const done = window.setTimeout(() => setCreated(true), 1500);
    return () => {
      window.clearInterval(typer);
      window.clearTimeout(done);
    };
  }, [reduced]);

  return (
    <ScreenShell eyebrow="New group" title="Create a group" sub="Start a shared wallet for your crew.">
      <div className="space-y-3.5">
        <motion.div {...rise(0.26, reduced)}>
          <Field label="Group name">
            <span>{typed}</span>
            {!reduced && typed.length < GROUP_NAME.length && (
              <span className="ml-px h-[18px] w-[2px] animate-pulse bg-brand-500" />
            )}
          </Field>
        </motion.div>

        <motion.div {...rise(0.34, reduced)}>
          <Field label="Currency">
            <span className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-brand-500/10 text-theme-xs font-bold text-brand-600 dark:text-brand-400">
                ₹
              </span>
              INR — Indian Rupee
            </span>
          </Field>
        </motion.div>

        <motion.div {...rise(0.42, reduced)} className="pt-1">
          <motion.button
            type="button"
            animate={created ? { scale: [1, 0.95, 1] } : { scale: 1 }}
            transition={{ duration: 0.32, ease: EASE }}
            className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-theme-sm font-semibold text-on-accent shadow-sm transition-colors ${
              created ? "bg-success-500 shadow-success-500/20" : "bg-brand-500 shadow-brand-500/20"
            }`}
          >
            {created ? (
              <>
                <CheckIcon className="h-4 w-4" />
                Group created
              </>
            ) : (
              "Create group"
            )}
          </motion.button>
        </motion.div>
      </div>
    </ScreenShell>
  );
}

function AddMembersScreen() {
  const reduced = !!useReducedMotion();
  return (
    <ScreenShell eyebrow="Members" title="Add members" sub="Trip to Ooty · 3 people">
      <motion.div {...listContainer(reduced)} className="space-y-2.5">
        {MEMBERS.map((m) => (
          <motion.div
            key={m.name}
            variants={listItem(reduced)}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface-raised px-3 py-2.5 "
          >
            <Avatar member={m} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-theme-sm font-semibold text-fg">{m.name}</p>
              <p className="truncate text-theme-xs text-fg-muted">{m.name.toLowerCase()}@gmail.com</p>
            </div>
            <MemberBadge />
          </motion.div>
        ))}
        <motion.div
          variants={listItem(reduced)}
          className="flex items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2.5 "
        >
          <div className="grid h-[38px] w-[38px] place-items-center rounded-full border border-dashed border-line text-lg text-fg-muted ">
            +
          </div>
          <p className="text-theme-sm font-medium text-fg-muted">Invite by email</p>
        </motion.div>
      </motion.div>
    </ScreenShell>
  );
}

function ContributeScreen() {
  const reduced = !!useReducedMotion();
  return (
    <ScreenShell eyebrow="Pool" title="Contribute to pool" sub="Everyone chips in to the shared wallet.">
      <motion.div
        {...rise(0.26, reduced)}
        className="rounded-2xl border border-line bg-surface-raised p-4 "
      >
        <p className="text-theme-xs font-medium uppercase tracking-wide text-fg-muted">Pool balance</p>
        <p className="mt-1 text-title-sm font-bold leading-none tracking-tight text-fg">
          <Counter to={3000} duration={1.5} />
        </p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-hover">
          <motion.div
            className="h-full rounded-full bg-brand-500"
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: reduced ? 0 : 1.5, delay: reduced ? 0 : 0.35, ease: EASE }}
          />
        </div>
        <p className="mt-2 text-theme-xs text-fg-muted">Goal ₹3,000 · ₹1,000 from each member</p>
      </motion.div>

      <motion.div {...listContainer(reduced, 0.6)} className="mt-3 space-y-2">
        {MEMBERS.map((m) => (
          <motion.div
            key={m.name}
            variants={listItem(reduced)}
            className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-raised px-3 py-2 "
          >
            <Avatar member={m} size={26} />
            <p className="flex-1 text-theme-sm font-medium text-fg">{m.name}</p>
            <p className="text-theme-sm font-semibold text-fg">₹1,000</p>
            <span className="grid h-4 w-4 place-items-center rounded-full bg-success-500 text-on-accent">
              <CheckIcon className="h-2.5 w-2.5" />
            </span>
          </motion.div>
        ))}
      </motion.div>
    </ScreenShell>
  );
}

function AddExpenseScreen() {
  const reduced = !!useReducedMotion();
  return (
    <ScreenShell eyebrow="Expense" title="Add an expense" sub="Spend straight from the pool.">
      <motion.div
        {...rise(0.26, reduced)}
        className="rounded-2xl border border-line bg-surface-raised p-4 "
      >
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <PinIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-theme-sm font-semibold text-fg">Hotel Stay</p>
            <span className="mt-1 inline-block rounded-md bg-surface-hover px-1.5 py-0.5 text-theme-2xs font-semibold text-fg-muted ">
              Travel
            </span>
          </div>
          <p className="text-theme-xl font-bold tracking-tight text-fg">₹1,200</p>
        </div>
      </motion.div>

      <motion.p
        {...rise(0.4, reduced)}
        className="mb-2 mt-4 text-theme-xs font-semibold uppercase tracking-wide text-fg-muted"
      >
        Split equally · 3 members
      </motion.p>

      <motion.div {...listContainer(reduced, 0.5)} className="space-y-2">
        {MEMBERS.map((m) => (
          <motion.div
            key={m.name}
            variants={listItem(reduced)}
            className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-raised px-3 py-2 "
          >
            <Avatar member={m} size={26} />
            <p className="flex-1 text-theme-sm font-medium text-fg">{m.name}</p>
            <p className="text-theme-sm font-semibold text-fg">₹400</p>
          </motion.div>
        ))}
      </motion.div>
    </ScreenShell>
  );
}

function ReportScreen() {
  const reduced = !!useReducedMotion();
  const max = Math.max(...CATEGORIES.map((c) => c.amount));
  return (
    <ScreenShell eyebrow="Report" title="Spending report" sub="Trip to Ooty">
      <motion.div
        {...rise(0.26, reduced)}
        className="rounded-2xl border border-line bg-surface-raised p-4 "
      >
        <div className="flex items-end justify-between">
          <div>
            <p className="text-theme-xs font-medium uppercase tracking-wide text-fg-muted">Pool remaining</p>
            <p className="mt-1 text-title-sm font-bold leading-none tracking-tight text-fg">
              <Counter to={1800} duration={1.3} />
            </p>
          </div>
          <p className="text-theme-xs text-fg-muted">of ₹3,000</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-hover">
          <motion.div
            className="h-full rounded-full bg-success-500"
            initial={{ width: 0 }}
            animate={{ width: "60%" }}
            transition={{ duration: reduced ? 0 : 1.1, delay: reduced ? 0 : 0.35, ease: EASE }}
          />
        </div>
      </motion.div>

      <motion.p
        {...rise(0.4, reduced)}
        className="mb-2.5 mt-4 text-theme-xs font-semibold uppercase tracking-wide text-fg-muted"
      >
        Spending by category
      </motion.p>

      <motion.div {...listContainer(reduced, 0.5)} className="space-y-3">
        {CATEGORIES.map((c) => (
          <motion.div key={c.name} variants={listItem(reduced)}>
            <div className="mb-1 flex items-center justify-between text-theme-xs">
              <span className="flex items-center gap-1.5 font-medium text-fg">
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                {c.name}
              </span>
              <span className="font-semibold text-fg">
                ₹{c.amount.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-hover">
              <motion.div
                className={`h-full rounded-full ${c.fill}`}
                initial={{ width: 0 }}
                animate={{ width: `${(c.amount / max) * 100}%` }}
                transition={{ duration: reduced ? 0 : 0.9, delay: reduced ? 0 : 0.7, ease: EASE }}
              />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </ScreenShell>
  );
}

function CloseGroupScreen() {
  const reduced = !!useReducedMotion();
  const [phase, setPhase] = useState<"idle" | "confirming" | "done">(reduced ? "done" : "idle");

  useEffect(() => {
    if (reduced) return;
    const t1 = window.setTimeout(() => setPhase("confirming"), 800);
    const t2 = window.setTimeout(() => setPhase("done"), 1300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [reduced]);

  return (
    <div className="h-full">
      <AnimatePresence mode="wait" initial={false}>
        {phase === "done" ? (
          <motion.div
            key="done"
            className="flex h-full flex-col items-center justify-center text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="grid h-[68px] w-[68px] place-items-center rounded-full bg-success-500 text-on-accent shadow-lg shadow-success-500/30"
              initial={reduced ? { scale: 1 } : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 15, delay: 0.05 }}
            >
              <CheckIcon className="h-8 w-8" />
            </motion.div>
            <p className="mt-4 text-theme-xl font-bold tracking-tight text-fg">
              Group closed
            </p>
            <p className="mt-1 text-theme-sm text-fg-muted">
              <Counter to={1800} duration={0.9} delay={0.15} /> refunded to 3 members
            </p>
          </motion.div>
        ) : (
          <motion.div key="form" className="h-full" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
            <ScreenShell
              eyebrow="Wrap up"
              title="Close group"
              sub="Refund the remaining pool to members."
            >
              <motion.div {...listContainer(reduced, 0.26)} className="space-y-2">
                {MEMBERS.map((m) => (
                  <motion.div
                    key={m.name}
                    variants={listItem(reduced)}
                    className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-raised px-3 py-2 "
                  >
                    <Avatar member={m} size={26} />
                    <p className="flex-1 text-theme-sm font-medium text-fg">{m.name}</p>
                    <span className="text-theme-xs text-fg-muted">refund</span>
                    <p className="text-theme-sm font-semibold text-success-600 dark:text-success-400">₹600</p>
                  </motion.div>
                ))}
              </motion.div>

              <div className="mt-3 flex items-center justify-between border-t border-dashed border-line px-1 pt-3 ">
                <span className="text-theme-xs font-medium text-fg-muted">Total refund</span>
                <span className="text-theme-sm font-bold text-fg">₹1,800</span>
              </div>

              <button
                type="button"
                className={`mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-theme-sm font-semibold text-on-accent shadow-sm shadow-brand-500/20 transition-colors ${
                  phase === "confirming" ? "bg-brand-600" : "bg-brand-500"
                }`}
              >
                {phase === "confirming" ? (
                  <>
                    <Spinner />
                    Closing…
                  </>
                ) : (
                  "Confirm & close"
                )}
              </button>
            </ScreenShell>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function renderScreen(step: number) {
  switch (step) {
    case 0:
      return <CreateGroupScreen />;
    case 1:
      return <AddMembersScreen />;
    case 2:
      return <ContributeScreen />;
    case 3:
      return <AddExpenseScreen />;
    case 4:
      return <ReportScreen />;
    default:
      return <CloseGroupScreen />;
  }
}

/* ------------------------------- the showcase ----------------------------- */

export default function DemoShowcase() {
  const reduced = !!useReducedMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % SCREENS.length);
    }, ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const slide = reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.3 },
      }
    : {
        initial: { x: "100%", opacity: 0 },
        animate: { x: "0%", opacity: 1 },
        exit: { x: "-100%", opacity: 0 },
        transition: { duration: 0.5, ease: EASE_SLIDE },
      };

  return (
    <div
      className="mx-auto w-full max-w-[375px] select-none"
      aria-label="Arkalyn-Kitty product walkthrough"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* phone bezel */}
      <div className="rounded-[2.75rem] bg-surface-overlay p-2.5 shadow-2xl shadow-gray-900/25 ring-1 ring-fg/5 dark:shadow-black/50 ">
        {/* screen */}
        <div className="relative overflow-hidden rounded-[2.25rem] bg-surface">
          {/* dynamic island */}
          <div className="absolute left-1/2 top-2 z-30 h-[26px] w-[88px] -translate-x-1/2 rounded-full bg-surface-overlay" />

          {/* status bar */}
          <div className="flex h-11 items-center justify-between px-6 pt-1 text-fg">
            <span className="text-theme-xs font-semibold tracking-tight">9:41</span>
            <span className="flex items-center gap-1.5">
              <SignalIcon />
              <BatteryIcon />
            </span>
          </div>

          {/* persistent app header */}
          <div className="flex items-center gap-2 border-b border-line px-4 pb-2.5 ">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-brand-500 text-theme-sm font-bold text-on-accent">
              A
            </div>
            <span className="text-[13.5px] font-bold tracking-tight text-fg">
              Arkalyn
            </span>
            <span className="ml-auto rounded-full bg-success-500/10 px-2 py-0.5 text-theme-2xs font-semibold text-success-600 dark:text-success-400">
              Live
            </span>
          </div>

          {/* animated screen content */}
          <div className="relative h-[440px] overflow-hidden">
            <AnimatePresence>
              <motion.div
                key={step}
                className="absolute inset-0 px-5 pt-5"
                initial={slide.initial}
                animate={slide.animate}
                exit={slide.exit}
                transition={slide.transition}
              >
                {renderScreen(step)}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* footer: step dots + label */}
          <div className="flex flex-col items-center gap-2.5 border-t border-line px-5 pb-5 pt-3.5 ">
            <div className="flex items-center gap-1.5">
              {SCREENS.map((label, i) => (
                <motion.span
                  key={label}
                  className={`h-1.5 rounded-full ${
                    i === step ? "bg-brand-500" : "bg-line "
                  }`}
                  animate={{ width: i === step ? 20 : 6 }}
                  transition={{ duration: 0.3, ease: EASE }}
                />
              ))}
            </div>
            <div className="h-4 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={step}
                  className="text-[11.5px] font-medium text-fg-muted"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                >
                  {`Step ${step + 1} of 6 — ${SCREENS[step]}`}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

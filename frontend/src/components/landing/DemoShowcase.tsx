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
  { name: "Aravind", initials: "A", avatar: "bg-indigo-500" },
  { name: "Priya", initials: "P", avatar: "bg-emerald-500" },
  { name: "Karthik", initials: "K", avatar: "bg-amber-500" },
];

// Report data — single Travel expense (₹1,200) is the only spend so far,
// keeping the demo internally consistent: ₹3,000 pool − ₹1,200 = ₹1,800 left.
const CATEGORIES = [
  { name: "Travel", amount: 1200, fill: "bg-indigo-500", dot: "bg-indigo-500" },
  { name: "Food", amount: 0, fill: "bg-stone-400", dot: "bg-stone-300 dark:bg-stone-600" },
  { name: "Stay", amount: 0, fill: "bg-stone-400", dot: "bg-stone-300 dark:bg-stone-600" },
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
      className="block h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
    />
  );
}

function Avatar({ member, size = 36 }: { member: Member; size?: number }) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ${member.avatar}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {member.initials}
    </div>
  );
}

function MemberBadge() {
  return (
    <span className="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
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
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
        {label}
      </p>
      <div className="flex min-h-[46px] items-center rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-[14px] font-medium text-stone-800 dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-100">
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
        className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500"
      >
        {eyebrow}
      </motion.p>
      <motion.h3
        {...rise(0.1, reduced)}
        className="mt-1 text-[19px] font-bold tracking-tight text-stone-900 dark:text-stone-50"
      >
        {title}
      </motion.h3>
      {sub && (
        <motion.p
          {...rise(0.16, reduced)}
          className="mt-1 text-[12.5px] leading-snug text-stone-500 dark:text-stone-400"
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
              <span className="ml-px h-[18px] w-[2px] animate-pulse bg-indigo-500" />
            )}
          </Field>
        </motion.div>

        <motion.div {...rise(0.34, reduced)}>
          <Field label="Currency">
            <span className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-indigo-500/10 text-[12px] font-bold text-indigo-600 dark:text-indigo-400">
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
            className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white shadow-sm transition-colors ${
              created ? "bg-emerald-500 shadow-emerald-500/20" : "bg-indigo-500 shadow-indigo-500/20"
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
            className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5 dark:border-stone-800 dark:bg-stone-900"
          >
            <Avatar member={m} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-stone-900 dark:text-stone-50">{m.name}</p>
              <p className="truncate text-[11px] text-stone-400">{m.name.toLowerCase()}@gmail.com</p>
            </div>
            <MemberBadge />
          </motion.div>
        ))}
        <motion.div
          variants={listItem(reduced)}
          className="flex items-center gap-3 rounded-xl border border-dashed border-stone-300 px-3 py-2.5 dark:border-stone-700"
        >
          <div className="grid h-[38px] w-[38px] place-items-center rounded-full border border-dashed border-stone-300 text-lg text-stone-400 dark:border-stone-700">
            +
          </div>
          <p className="text-[13px] font-medium text-stone-400">Invite by email</p>
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
        className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Pool balance</p>
        <p className="mt-1 text-[33px] font-bold leading-none tracking-tight text-stone-900 dark:text-stone-50">
          <Counter to={3000} duration={1.5} />
        </p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
          <motion.div
            className="h-full rounded-full bg-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: reduced ? 0 : 1.5, delay: reduced ? 0 : 0.35, ease: EASE }}
          />
        </div>
        <p className="mt-2 text-[11px] text-stone-400">Goal ₹3,000 · ₹1,000 from each member</p>
      </motion.div>

      <motion.div {...listContainer(reduced, 0.6)} className="mt-3 space-y-2">
        {MEMBERS.map((m) => (
          <motion.div
            key={m.name}
            variants={listItem(reduced)}
            className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-900"
          >
            <Avatar member={m} size={26} />
            <p className="flex-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">{m.name}</p>
            <p className="text-[13px] font-semibold text-stone-900 dark:text-stone-50">₹1,000</p>
            <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white">
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
        className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <PinIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-stone-900 dark:text-stone-50">Hotel Stay</p>
            <span className="mt-1 inline-block rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500 dark:bg-stone-800 dark:text-stone-300">
              Travel
            </span>
          </div>
          <p className="text-[17px] font-bold tracking-tight text-stone-900 dark:text-stone-50">₹1,200</p>
        </div>
      </motion.div>

      <motion.p
        {...rise(0.4, reduced)}
        className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-stone-400"
      >
        Split equally · 3 members
      </motion.p>

      <motion.div {...listContainer(reduced, 0.5)} className="space-y-2">
        {MEMBERS.map((m) => (
          <motion.div
            key={m.name}
            variants={listItem(reduced)}
            className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-900"
          >
            <Avatar member={m} size={26} />
            <p className="flex-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">{m.name}</p>
            <p className="text-[13px] font-semibold text-stone-900 dark:text-stone-50">₹400</p>
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
        className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Pool remaining</p>
            <p className="mt-1 text-[29px] font-bold leading-none tracking-tight text-stone-900 dark:text-stone-50">
              <Counter to={1800} duration={1.3} />
            </p>
          </div>
          <p className="text-[11px] text-stone-400">of ₹3,000</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: "60%" }}
            transition={{ duration: reduced ? 0 : 1.1, delay: reduced ? 0 : 0.35, ease: EASE }}
          />
        </div>
      </motion.div>

      <motion.p
        {...rise(0.4, reduced)}
        className="mb-2.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-stone-400"
      >
        Spending by category
      </motion.p>

      <motion.div {...listContainer(reduced, 0.5)} className="space-y-3">
        {CATEGORIES.map((c) => (
          <motion.div key={c.name} variants={listItem(reduced)}>
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 font-medium text-stone-700 dark:text-stone-200">
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                {c.name}
              </span>
              <span className="font-semibold text-stone-900 dark:text-stone-50">
                ₹{c.amount.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
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
              className="grid h-[68px] w-[68px] place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
              initial={reduced ? { scale: 1 } : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 15, delay: 0.05 }}
            >
              <CheckIcon className="h-8 w-8" />
            </motion.div>
            <p className="mt-4 text-[20px] font-bold tracking-tight text-stone-900 dark:text-stone-50">
              Group closed
            </p>
            <p className="mt-1 text-[13px] text-stone-500 dark:text-stone-400">
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
                    className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-900"
                  >
                    <Avatar member={m} size={26} />
                    <p className="flex-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">{m.name}</p>
                    <span className="text-[11px] text-stone-400">refund</span>
                    <p className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">₹600</p>
                  </motion.div>
                ))}
              </motion.div>

              <div className="mt-3 flex items-center justify-between border-t border-dashed border-stone-200 px-1 pt-3 dark:border-stone-800">
                <span className="text-[12px] font-medium text-stone-500 dark:text-stone-400">Total refund</span>
                <span className="text-[15px] font-bold text-stone-900 dark:text-stone-50">₹1,800</span>
              </div>

              <button
                type="button"
                className={`mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white shadow-sm shadow-indigo-500/20 transition-colors ${
                  phase === "confirming" ? "bg-indigo-600" : "bg-indigo-500"
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
      <div className="rounded-[2.75rem] bg-stone-900 p-2.5 shadow-2xl shadow-stone-900/25 ring-1 ring-stone-900/5 dark:bg-stone-800 dark:shadow-black/50 dark:ring-white/5">
        {/* screen */}
        <div className="relative overflow-hidden rounded-[2.25rem] bg-stone-50 dark:bg-stone-950">
          {/* dynamic island */}
          <div className="absolute left-1/2 top-2 z-30 h-[26px] w-[88px] -translate-x-1/2 rounded-full bg-stone-900" />

          {/* status bar */}
          <div className="flex h-11 items-center justify-between px-6 pt-1 text-stone-900 dark:text-stone-100">
            <span className="text-[12px] font-semibold tracking-tight">9:41</span>
            <span className="flex items-center gap-1.5">
              <SignalIcon />
              <BatteryIcon />
            </span>
          </div>

          {/* persistent app header */}
          <div className="flex items-center gap-2 border-b border-stone-200 px-4 pb-2.5 dark:border-stone-800">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500 text-[13px] font-bold text-white">
              A
            </div>
            <span className="text-[13.5px] font-bold tracking-tight text-stone-900 dark:text-stone-50">
              Arkalyn
            </span>
            <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
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
          <div className="flex flex-col items-center gap-2.5 border-t border-stone-200 px-5 pb-5 pt-3.5 dark:border-stone-800">
            <div className="flex items-center gap-1.5">
              {SCREENS.map((label, i) => (
                <motion.span
                  key={label}
                  className={`h-1.5 rounded-full ${
                    i === step ? "bg-indigo-500" : "bg-stone-300 dark:bg-stone-700"
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
                  className="text-[11.5px] font-medium text-stone-500 dark:text-stone-400"
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

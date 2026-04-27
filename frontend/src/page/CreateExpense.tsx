
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/header";

const mockMembers = [
  { _id: "1", name: "Aravind" },
  { _id: "2", name: "Karthiek" },
];

const mockCategories = [
  { _id: "c1", name: "Food",      color: "#f97316" },
  { _id: "c2", name: "Transport", color: "#06b6d4" },
  { _id: "c3", name: "Bills",     color: "#8b5cf6" },
];

interface SplitEntry {
  userId: string;
  name: string;
  amount: number;
}

const paymentTypes = [
  { value: "cash",       label: "Cash",       icon: "💵" },
  { value: "card",       label: "Card",       icon: "💳" },
  { value: "upi",        label: "UPI",        icon: "📱" },
  { value: "netbanking", label: "Net Banking", icon: "🏦" },
];

const s = {
  input:
    "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all duration-200",
  section:
    "bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden",
  sectionHeader:
    "flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06]",
};

// ── component ──────────────────────────────────────────────────
export default function CreateExpensePage() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const [title, setTitle]               = useState("");
  const [amount, setAmount]             = useState("");
  const [date, setDate]                 = useState(() => new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId]     = useState("");
  const [paymentType, setPaymentType]   = useState("cash");
  const [paidBy, setPaidBy]             = useState("");
  const [splits, setSplits]             = useState<SplitEntry[]>([]);
  const [error, setError]               = useState("");

  const totalAmount  = Number(amount) || 0;
  const splitTotal   = splits.reduce((s, e) => s + (e.amount || 0), 0);
  const splitDiff    = totalAmount - splitTotal;
  const splitValid   = Math.abs(splitDiff) < 0.01;

  const toggleSplit = (member: { _id: string; name: string }) => {
    setSplits((prev) => {
      const exists = prev.find((s) => s.userId === member._id);
      if (exists) return prev.filter((s) => s.userId !== member._id);
      return [...prev, { userId: member._id, name: member.name, amount: 0 }];
    });
  };

  const updateSplitAmount = (userId: string, value: number) => {
    setSplits((prev) =>
      prev.map((s) => (s.userId === userId ? { ...s, amount: value } : s))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim())   return setError("Title is required");
    if (!totalAmount)    return setError("Amount is required");
    if (!categoryId)     return setError("Select a category");
    if (!paidBy)         return setError("Select who paid");
    if (splits.length === 0) return setError("Add at least one split");
    if (!splitValid)     return setError("Split amounts must equal total amount");

    const payload = {
      groupId,
      title: title.trim(),
      amount: totalAmount,
      date,
      category: categoryId,
      paymentType,
      paidBy,
      splitBetween: splits.map((s) => ({ userId: s.userId, amount: s.amount })),
    };

    console.log("submit →", payload);
    // await createExpense(payload).unwrap()
    // navigate(`/groups/${groupId}`)
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-60 w-[600px] h-[600px] rounded-full bg-violet-600/4 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.07) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <Header />

      <form onSubmit={handleSubmit} className="relative max-w-xl mx-auto px-4 py-10 space-y-3">

        {/* Back */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/35 hover:text-white/60 text-xs font-medium transition-colors mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        {/* Page title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="#67e8f9" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/70">
              New Expense
            </p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f0eeff]">
            Record an expense
          </h1>
          <p className="text-white/35 text-sm mt-1.5">
            Fill in the details and split it between members.
          </p>
        </div>

        {/* ── 01 Basic details ── */}
        <div className={s.section}>
          <div className={s.sectionHeader}>
            <span className="text-[11px] font-bold text-white/15 tabular-nums">01</span>
            <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
              Basic details
            </span>
          </div>
          <div className="px-5 py-4 space-y-3">
            {/* Title */}
            <div>
              <label className="block text-[10px] font-semibold text-white/40 mb-2 uppercase tracking-widest">
                Title
              </label>
              <input
                className={s.input}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Team lunch"
                autoComplete="off"
                maxLength={100}
              />
              <div className="flex justify-end mt-1">
                <span className="text-[10px] text-white/20">{title.length}/100</span>
              </div>
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-white/40 mb-2 uppercase tracking-widest">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">₹</span>
                  <input
                    className={`${s.input} pl-7`}
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    onKeyDown={(e) => {
                      const key = e.key;
                      if (["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(key)) return;
                      if (!/^[0-9.]$/.test(key)) e.preventDefault();
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-white/40 mb-2 uppercase tracking-widest">
                  Date
                </label>
                <input
                  className={`${s.input} text-white/70`}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 02 Category + Payment ── */}
        <div className={s.section}>
          <div className={s.sectionHeader}>
            <span className="text-[11px] font-bold text-white/15 tabular-nums">02</span>
            <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
              Category & Payment
            </span>
          </div>
          <div className="px-5 py-4 space-y-4">
            {/* Category pills */}
            <div>
              <label className="block text-[10px] font-semibold text-white/40 mb-2.5 uppercase tracking-widest">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {mockCategories.map((cat) => (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => setCategoryId(cat._id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all duration-150"
                    style={
                      categoryId === cat._id
                        ? { background: cat.color + "25", borderColor: cat.color + "60", color: cat.color }
                        : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }
                    }
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: categoryId === cat._id ? cat.color : "rgba(255,255,255,0.2)" }}
                    />
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment type */}
            <div>
              <label className="block text-[10px] font-semibold text-white/40 mb-2.5 uppercase tracking-widest">
                Payment type
              </label>
              <div className="grid grid-cols-4 gap-2">
                {paymentTypes.map((pt) => (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => setPaymentType(pt.value)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[10px] font-semibold transition-all duration-150 ${
                      paymentType === pt.value
                        ? "bg-cyan-500/15 border-cyan-500/35 text-cyan-300"
                        : "bg-white/[0.03] border-white/[0.07] text-white/30 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="text-base leading-none">{pt.icon}</span>
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 03 Paid by ── */}
        <div className={s.section}>
          <div className={s.sectionHeader}>
            <span className="text-[11px] font-bold text-white/15 tabular-nums">03</span>
            <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
              Paid by
            </span>
          </div>
          <div className="px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {mockMembers.map((member) => (
                <button
                  key={member._id}
                  type="button"
                  onClick={() => setPaidBy(member._id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-semibold transition-all duration-150 ${
                    paidBy === member._id
                      ? "bg-violet-500/15 border-violet-500/35 text-violet-200"
                      : "bg-white/[0.03] border-white/[0.07] text-white/35 hover:bg-white/[0.06]"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      paidBy === member._id ? "bg-violet-500/30 text-violet-300" : "bg-white/10 text-white/40"
                    }`}
                  >
                    {member.name.slice(0, 2).toUpperCase()}
                  </span>
                  {member.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 04 Split between ── */}
        <div className={s.section}>
          <div className={s.sectionHeader}>
            <span className="text-[11px] font-bold text-white/15 tabular-nums">04</span>
            <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
              Split between
            </span>
          </div>
          <div className="px-5 py-4 space-y-3">
            {/* Member toggle */}
            <div className="flex flex-wrap gap-2">
              {mockMembers.map((member) => {
                const selected = splits.some((s) => s.userId === member._id);
                return (
                  <button
                    key={member._id}
                    type="button"
                    onClick={() => toggleSplit(member)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-semibold transition-all duration-150 ${
                      selected
                        ? "bg-cyan-500/15 border-cyan-500/35 text-cyan-200"
                        : "bg-white/[0.03] border-white/[0.07] text-white/35 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        selected ? "bg-cyan-500/25 text-cyan-300" : "bg-white/10 text-white/40"
                      }`}
                    >
                      {member.name.slice(0, 2).toUpperCase()}
                    </span>
                    {member.name}
                  </button>
                );
              })}
            </div>

            {/* Split inputs */}
            {splits.length > 0 && (
              <div className="space-y-2 pt-1">
                {splits.map((split) => (
                  <div key={split.userId} className="flex items-center gap-3
                    bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5">
                    <span className="w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-500/20
                      flex items-center justify-center text-[10px] font-bold text-cyan-400 shrink-0">
                      {split.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex-1 text-[13px] font-medium text-white/60 truncate">
                      {split.name}
                    </span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 text-xs">₹</span>
                      <input
                        className="w-24 bg-white/[0.05] border border-white/[0.09] rounded-lg
                          pl-6 pr-2.5 py-1.5 text-xs text-white text-right
                          placeholder-white/20 outline-none
                          focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                        placeholder="0"
                        type="text"
                        value={split.amount || ""}
                        onChange={(e) => updateSplitAmount(split.userId, Number(e.target.value))}
                        onKeyDown={(e) => {
                          const key = e.key;
                          if (["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(key)) return;
                          if (!/^[0-9.]$/.test(key)) e.preventDefault();
                        }}
                      />
                    </div>
                  </div>
                ))}

                {/* Live validation */}
                <div className={`flex items-center justify-between px-1 pt-1 pb-0.5`}>
                  <span className="text-[10px] uppercase tracking-widest text-white/25">
                    Split total
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[12px] font-mono font-semibold ${
                      splits.length === 0  ? "text-white/25" :
                      splitValid           ? "text-emerald-400" : "text-red-400"
                    }`}>
                      ₹{splitTotal.toLocaleString("en-IN")}
                    </span>
                    <span className="text-white/20 text-[10px]">/</span>
                    <span className="text-[12px] font-mono text-white/40">
                      ₹{totalAmount.toLocaleString("en-IN")}
                    </span>
                    {splits.length > 0 && (
                      splitValid ? (
                        <span className="text-emerald-400">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-red-400">
                          {splitDiff > 0 ? `₹${splitDiff.toFixed(0)} left` : `₹${Math.abs(splitDiff).toFixed(0)} over`}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400/90 text-xs flex items-center gap-1.5 px-1">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="#f87171" strokeWidth="1.2" />
              <path d="M5 3v2.5M5 7h.01" stroke="#f87171" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08]
              rounded-xl px-6 py-3 text-sm text-white/40 hover:text-white/60 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-cyan-400 hover:bg-cyan-300 text-black font-semibold
              rounded-xl px-6 py-3 text-sm transition-all active:scale-[0.98]
              shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Expense
          </button>
        </div>
      </form>
    </div>
  );
}

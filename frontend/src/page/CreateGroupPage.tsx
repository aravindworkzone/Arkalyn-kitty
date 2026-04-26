import { useState } from "react";
import Header from "../components/header";
import { useCreateGroupMutation } from "../redux/api/group";
import { useVerifyUserMutation } from "../redux/api/user";
import { validators, ErrorRemover } from "../utils/Authentication";
import { useNavigate } from "react-router-dom";

const s = {
  input:
    "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all duration-200",
  label:
    "block text-[10px] font-semibold text-white/40 mb-2 uppercase tracking-widest",
};

interface Member {
  _id: string;
  user: string;
  email: string;
  contribution: number;
}

export default function CreateGroupPage() {
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [error, setError] = useState<string>("");
  ErrorRemover(setError);

  const navigate = useNavigate();
  const [createGroup, { isLoading }] = useCreateGroupMutation();
  const [verifyUser, { isLoading: isVerifying }] = useVerifyUserMutation();

  const poolTotal = members.reduce((sum, m) => sum + (m.contribution || 0), 0);

  const addMember = async () => {
    const email = emailInput.trim();
    if (!email) return setError("Email is required");
    const isEmail = validators.email(email);
    if (!isEmail.valid) return setError(isEmail.message || "Invalid email format");
    if (members.some((m) => m.email === email)) return setError("Member already added");
    try {
      const result = await verifyUser(email).unwrap();
      const id = (result as any)?.user?._id;
      const name = (result as any)?.user?.name;
      setMembers((prev) => [...prev, { _id: id, user: name, contribution: 0, email }]);
      setEmailInput("");
    } catch (err: any) {
      setError(err?.data?.message || "User not found");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return setError("Group name is required");
    if (members.length === 0) return setError("At least one member is required");
    try {
      await createGroup({ name: groupName.trim(), members }).unwrap();
      navigate("/groups");
    } catch (err: any) {
      setError(err?.data?.message || "Failed to create group");
    }
  };

  const removeMember = (id: string) =>
    setMembers((prev) => prev.filter((m) => m._id !== id));

  const updateContribution = (id: string, value: number) =>
    setMembers((prev) =>
      prev.map((m) => (m._id === id ? { ...m, contribution: value } : m))
    );

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-60 w-[600px] h-[600px] rounded-full bg-indigo-500/4 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <Header />

      <form onSubmit={handleSubmit} className="relative max-w-xl mx-auto px-4 py-10">
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/35 hover:text-white/60 text-xs font-medium transition-colors mb-10 group"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to groups
        </button>

        {/* Page title */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="#67e8f9" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/70">
              New Group
            </p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f0eeff]">
            Set up your shared pool
          </h1>
          <p className="text-white/35 text-sm mt-1.5">
            Name your group, add members, and set initial contributions.
          </p>
        </div>

        <div className="space-y-3">
          {/* Step 1 — Group name */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06]">
              <span className="text-[11px] font-bold text-white/15 tabular-nums">01</span>
              <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
                Group name
              </span>
            </div>
            <div className="px-5 py-4">
              <input
                className={s.input}
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Goa Trip 2025"
                autoComplete="off"
                onKeyDown={(e) => {
                  const key = e.key;
                  if (["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(key)) return;
                  if (!/^[A-Za-z0-9 ]$/.test(key) || groupName.length >= 30) e.preventDefault();
                }}
              />
              <div className="flex justify-end mt-1.5">
                <span className="text-[10px] text-white/20 tabular-nums">
                  {groupName.length}/30
                </span>
              </div>
            </div>
          </div>

          {/* Step 2 — Members */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-white/15 tabular-nums">02</span>
                <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
                  Members
                </span>
              </div>
              {members.length > 0 && (
                <span className="text-[10px] font-medium text-white/25 bg-white/[0.05] border border-white/[0.07] px-2 py-0.5 rounded-full">
                  {members.length} added
                </span>
              )}
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Email input */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMember())}
                  className={`${s.input} flex-1`}
                  placeholder="member@email.com"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={addMember}
                  disabled={isVerifying}
                  className="shrink-0 px-4 rounded-xl text-sm font-semibold border
                    bg-cyan-500/10 border-cyan-500/25 text-cyan-300
                    hover:bg-cyan-500/20 hover:border-cyan-400/40
                    disabled:opacity-40 transition-all duration-150"
                >
                  {isVerifying ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : "Add"}
                </button>
              </div>

              {error && (
                <p className="text-red-400/90 text-xs flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="4" stroke="#f87171" strokeWidth="1.2" />
                    <path d="M5 3v2.5M5 7h.01" stroke="#f87171" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  {error}
                </p>
              )}

              {!error && members.length === 0 && (
                <p className="text-white/20 text-xs">
                  Enter an email and click Add — or press Enter.
                </p>
              )}

              {/* Member list */}
              {members.length > 0 && (
                <div className="space-y-2">
                  {members.map((member, i) => (
                    <div
                      key={member._id}
                      className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3.5"
                      style={{
                        animation: "fadeSlideIn 0.25s ease forwards",
                        animationDelay: `${i * 40}ms`,
                        opacity: 0,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-bold text-cyan-400">
                              {member.user?.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-white/90 truncate leading-tight">
                              {member.user}
                            </p>
                            <p className="text-[11px] text-white/30 truncate">{member.email}</p>
                          </div>
                        </div>

                        {/* Contribution + remove */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 text-xs">₹</span>
                            <input
                              className="w-24 bg-white/[0.05] border border-white/[0.09] rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all text-right"
                              defaultValue={member.contribution || ""}
                              placeholder="0"
                              type="text"
                              onChange={(e) => updateContribution(member._id, Number(e.target.value))}
                              onKeyDown={(e) => {
                                const key = e.key;
                                if (["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(key)) return;
                                if (!/^[0-9]$/.test(key)) e.preventDefault();
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMember(member._id)}
                            className="w-6 h-6 flex items-center justify-center text-white/20 hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Pool total */}
                  <div className="flex items-center justify-between px-1 pt-1">
                    <span className="text-[10px] text-white/25 uppercase tracking-widest">
                      Initial pool total
                    </span>
                    <span className="text-sm font-semibold font-mono text-cyan-300">
                      ₹{poolTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-3">
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
            disabled={isLoading || isVerifying}
            className="flex-1 relative overflow-hidden rounded-xl px-6 py-3 text-sm font-semibold
              text-black bg-cyan-400 hover:bg-cyan-300
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150 active:scale-[0.98]
              shadow-lg shadow-cyan-500/20"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Creating...
              </span>
            ) : "Create group"}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
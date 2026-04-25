import { useState } from "react";
import Header from "../components/header";
import { useCreateGroupMutation } from "../redux/api/group";
import { useVerifyUserMutation } from "../redux/api/user";
import { validators, ErrorRemover } from "../utils/Authentication";
import { useNavigate } from "react-router-dom";

const s = {
    input:
        "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all",
    label:
        "block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider",
};

interface members {
    _id: string;
    user: string;
    email: string;
    contribution: number;
}

export default function CreateGroupPage() {
    const [members, setMembers] = useState<members[]>([]);
    const [emailInput, setEmailInput] = useState("");
    const [error, setError] = useState<string>("");
    ErrorRemover(setError);

    const navigate = useNavigate();

    const [createGroup, { isLoading, error: groupError }] = useCreateGroupMutation();
    const [verifyUser, { isLoading: isVerifying }] = useVerifyUserMutation();

    const addMember = async () => {
        const email = emailInput.trim();

        if (!email) {
            setError("Email is required");
            return;
        }

        const isEmail = validators.email(email);
        if (!isEmail.valid) {
            setError(isEmail.message || "Invalid email format");
            return;
        }

        try {
            const result = await verifyUser(email).unwrap();
            const id = (result as any)?.user?._id;
            const name = (result as any)?.user?.name;
            if (!members.includes(id)) {
                setMembers([...members, { _id: id, user: name, contribution: 0, email: email }]);
                setEmailInput("");
            }

        } catch (err: any) {
            setError(err?.data?.message || "User not found");
        }
    };

    const HandleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        const input = document.getElementById("GroupName") as HTMLInputElement;
        const name = input.value.trim();
        if (!name) return setError("Group name is required");
        if (members.length === 0) return setError("At least one member is required");
        try {
            await createGroup({ name, members });
            navigate("/groups");
        } catch (error) {
            setError((groupError as any)?.data?.message);
        }
    };

    return (
        <form className="min-h-screen bg-[#080c14] text-white font-sans" onSubmit={(e) => HandleUpload(e)}>
            <Header />
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-cyan-500/5 blur-3xl" />
                <div className="absolute bottom-0 -right-48 w-[500px] h-[500px] rounded-full bg-indigo-500/4 blur-3xl" />
            </div>

            <div className="relative max-w-xl mx-auto px-4 py-12">
                <button className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors mb-8" onClick={() => window.history.back()}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back
                </button>

                <h1 className="text-2xl font-semibold tracking-tight mb-1">Create a group</h1>
                <p className="text-white/40 text-sm mb-8">Set up a shared pool for your team, trip, or household.</p>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">

                    <div>
                        <label className={s.label}>Group name</label>
                        <input
                            className={s.input}
                            name="name"
                            id="GroupName"
                            type="text"
                            placeholder="e.g. Goa Trip 2025"
                            autoComplete="off"
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                const key = e.key;
                                const input = e.currentTarget;

                                if (
                                    key === "Backspace" ||
                                    key === "Delete" ||
                                    key === "ArrowLeft" ||
                                    key === "ArrowRight" ||
                                    key === "Tab"
                                ) return;

                                if (!/^[A-Za-z0-9 ]$/.test(key) || input.value.length >= 30) {
                                    e.preventDefault();
                                }
                            }}
                        />
                    </div>

                    <div className="border-t border-white/5" />

                    <div>
                        <label className={s.label}>
                            Members
                            {members.length > 0 && (
                                <span className="ml-2 text-white/25 normal-case tracking-normal font-normal">
                                    {members.length} added
                                </span>
                            )}
                        </label>

                        <div className="flex gap-2">
                            <input
                                type="email"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                name="members"
                                className={`${s.input} flex-1`}
                                placeholder="member@email.com"
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                onClick={addMember}
                                disabled={isLoading || isVerifying}
                                className="shrink-0 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 text-sm text-white/60 hover:text-white transition-all active:scale-95"
                            >
                                Add
                            </button>
                        </div>

                        {(members.length === 0 && !error) && (
                            <p className="text-white/20 text-xs mt-2">
                                Click Add after each email.
                            </p>
                        )}
                        {error && (
                            <p className="text-[#ff2525] text-xs mt-2 ml-1">
                                {error}
                            </p>
                        )}

                        {members.length > 0 && (
                            <div className="mt-3 flex flex-col gap-2">
                                {members.map((member) => (
                                    <div
                                        key={member._id}
                                        className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2"
                                    >
                                        <div className="flex flex-col w-[80%] gap-2 sm:flex-row sm:w-auto sm:gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 font-semibold shrink-0">
                                                    {member.user?.slice(0, 2).toUpperCase()}
                                                </span>

                                                <div className="min-w-0">
                                                    <p className="text-sm truncate">{member.user}</p>
                                                    <p className="text-xs text-white/40 truncate">{member.email}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 justify-center">
                                                <input
                                                    className={`${s.input} !w-full sm:!w-1/2`}
                                                    defaultValue={member.contribution}
                                                    onChange={(e) => {
                                                        const value = Number(e.target.value);
                                                        setMembers(prev =>
                                                            prev.map(item =>
                                                                item._id === member._id
                                                                    ? { ...item, contribution: value }
                                                                    : item
                                                            )
                                                        );
                                                    }}
                                                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                                        const key = e.key;

                                                        if (
                                                            key === "Backspace" ||
                                                            key === "Delete" ||
                                                            key === "ArrowLeft" ||
                                                            key === "ArrowRight" ||
                                                            key === "Tab"
                                                        ) return;

                                                        if (!/^[0-9]$/.test(key)) {
                                                            e.preventDefault();
                                                        }
                                                    }}
                                                    type="text"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setMembers(members.filter((m) => m._id !== member._id))
                                            }
                                            className="text-white/30 hover:text-red-400"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-4 flex gap-3">
                    <button className="flex-1 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl px-6 py-3 text-sm text-white/60 hover:text-white/80 transition-all" onClick={() => window.history.back()}>
                        Cancel
                    </button>
                    <button className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl px-6 py-3 text-sm transition-all active:scale-[0.98]" disabled={isLoading || isVerifying} type="submit">
                        Create group
                    </button>
                </div>
            </div>
        </form>
    );
}
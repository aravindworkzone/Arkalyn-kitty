import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSubmitContactMutation } from "../redux/api/contact";
import { getApiErrorMessage } from "../hooks/useApiError";
import type { ContactKind } from "../interface/contact";

interface ContactModalProps {
    open: boolean;
    onClose: () => void;
    /** Which tab to open on. Defaults to "question". */
    initialKind?: ContactKind;
}

const TABS: { value: ContactKind; label: string; hint: string }[] = [
    { value: "question", label: "Ask a question", hint: "Have a question about plans, features, or your account? We'll reply by email." },
    { value: "report", label: "Report a problem", hint: "Found a bug or something not working? Tell us what happened and we'll look into it." },
];

const inputClass =
    "w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-2.5 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-colors";

export default function ContactModal({ open, onClose, initialKind = "question" }: ContactModalProps) {
    const [kind, setKind] = useState<ContactKind>(initialKind);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const [submit, { isLoading }] = useSubmitContactMutation();

    // Reset to the requested tab / clean slate each time the modal opens.
    useEffect(() => {
        if (open) {
            setKind(initialKind);
            setError(null);
            setDone(null);
        }
    }, [open, initialKind]);

    // Close on Escape.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [open, onClose]);

    if (!open) return null;

    const resetForm = () => {
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            const res = await submit({
                kind,
                name: name.trim(),
                email: email.trim(),
                subject: subject.trim(),
                message: message.trim(),
            }).unwrap();
            setDone(res.message || "Thanks — your message has been sent.");
            resetForm();
        } catch (err) {
            setError(getApiErrorMessage(err, "Could not send your message. Please try again."));
        }
    };

    const activeTab = TABS.find((t) => t.value === kind)!;

    // Render into document.body via a portal. The routed pages are wrapped in a
    // `.route-fade` element whose CSS animation retains a `transform`, which makes
    // it the containing block for `position: fixed` — without the portal the modal
    // would size to the (tall) page instead of the viewport and appear off-screen.
    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Contact us"
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-full sm:max-w-lg bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 pt-5 pb-3 bg-stone-50 dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800">
                    <h2 className="text-lg font-bold tracking-tight text-stone-950 dark:text-stone-50">Get in touch</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                <div className="px-6 py-5">
                    {done ? (
                        <div className="text-center py-8">
                            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600">
                                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                                    <path d="M5 11.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <p className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-1">Message sent</p>
                            <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">{done}</p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex items-center h-10 px-5 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Tabs */}
                            <div className="grid grid-cols-2 gap-2 mb-5">
                                {TABS.map((tab) => (
                                    <button
                                        key={tab.value}
                                        type="button"
                                        onClick={() => setKind(tab.value)}
                                        className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                                            kind === tab.value
                                                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300"
                                                : "border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <p className="text-[13px] text-stone-500 dark:text-stone-400 mb-5 leading-relaxed">{activeTab.hint}</p>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">Your name</label>
                                        <input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Jane Doe"
                                            maxLength={80}
                                            required
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">Your email</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            maxLength={254}
                                            required
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">Subject</label>
                                    <input
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        placeholder={kind === "report" ? "Brief summary of the problem" : "What's your question about?"}
                                        maxLength={120}
                                        required
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
                                        {kind === "report" ? "What happened?" : "Your message"}
                                    </label>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder={
                                            kind === "report"
                                                ? "Steps to reproduce, what you expected, and what actually happened…"
                                                : "Tell us a little more…"
                                        }
                                        rows={5}
                                        maxLength={4000}
                                        required
                                        className={`${inputClass} resize-none`}
                                    />
                                    <p className="text-[11px] text-stone-400 mt-1 text-right">{message.length}/4000</p>
                                </div>

                                {error && (
                                    <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-2.5 text-sm text-red-600 dark:text-red-300">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full inline-flex items-center justify-center h-11 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors shadow-md shadow-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? "Sending…" : kind === "report" ? "Send report" : "Send question"}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

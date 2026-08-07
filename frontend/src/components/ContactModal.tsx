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
    "w-full rounded-xl border border-line-strong bg-surface-raised px-4 py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-colors";

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
            <div className="absolute inset-0 bg-surface-overlay/60 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-full sm:max-w-lg bg-surface border border-line rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 pt-5 pb-3 bg-surface border-b border-line">
                    <h2 className="text-lg font-bold tracking-tight text-fg">Get in touch</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-fg-muted hover:bg-line transition-colors"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                <div className="px-6 py-5">
                    {done ? (
                        <div className="text-center py-8">
                            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-success-100 dark:bg-success-950/40 flex items-center justify-center text-success-600">
                                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                                    <path d="M5 11.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <p className="text-base font-semibold text-fg mb-1">Message sent</p>
                            <p className="text-sm text-fg-muted mb-6">{done}</p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex items-center h-10 px-5 rounded-xl text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-on-accent transition-colors"
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
                                                ? "border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-300"
                                                : "border-line text-fg-muted hover:border-line "
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <p className="text-theme-sm text-fg-muted mb-5 leading-relaxed">{activeTab.hint}</p>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-fg-muted mb-1.5">Your name</label>
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
                                        <label className="block text-xs font-medium text-fg-muted mb-1.5">Your email</label>
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
                                    <label className="block text-xs font-medium text-fg-muted mb-1.5">Subject</label>
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
                                    <label className="block text-xs font-medium text-fg-muted mb-1.5">
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
                                    <p className="text-theme-xs text-fg-muted mt-1 text-right">{message.length}/4000</p>
                                </div>

                                {error && (
                                    <div className="rounded-xl border border-error-200 dark:border-error-900/50 bg-error-50 dark:bg-error-950/30 px-4 py-2.5 text-sm text-error-600 dark:text-error-300">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full inline-flex items-center justify-center h-11 rounded-xl text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-on-accent transition-colors shadow-md shadow-brand-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
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

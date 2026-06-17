import { useEffect, useState } from "react";
import { Logo } from "./ui";

/**
 * Full-screen "authenticating" state shared by the protected routes and the
 * auth pages. Stays blank for a short beat so a cached session or a quick
 * refresh resolves without flashing a loader, then fades in branded
 * placeholders that match the app's look — no misleading page-specific layout.
 */
export default function AuthLoader({ delay = 250 }: { delay?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  if (!show) return null;

  return (
    <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center gap-6">
      <Logo variant="mini" className="w-12 h-12 rounded-2xl animate-pulse" />
      <div className="space-y-2 w-48">
        <div className="h-2.5 bg-white/[0.06] rounded animate-pulse" />
        <div className="h-2.5 bg-white/[0.04] rounded animate-pulse w-3/4 mx-auto" />
      </div>
    </div>
  );
}

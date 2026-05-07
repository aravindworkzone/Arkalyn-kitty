import { useState, useRef, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useSignOutMutation } from "../redux/api/auth";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";

const Header = () => {
  const { user } = useOutletContext<{ user: any }>();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [signOut] = useSignOutMutation();
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const initials = user?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const firstName = user?.name?.split(" ")[0];

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-5 h-14
      bg-[#080c14]/80 backdrop-blur-xl border-b border-white/[0.06]">

      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="relative w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600
          flex items-center justify-center shadow-lg shadow-violet-900/40">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-[#f0eeff]">
          Arkalyn<span className="text-violet-400">Kitty</span>
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">

        <LanguageToggle />

        {/* Notification bell */}
        <button className="relative w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07]
          flex items-center justify-center hover:bg-white/[0.08] hover:border-white/[0.12]
          active:bg-white/[0.08] active:border-white/[0.12] active:scale-[0.95]
          transition-all duration-150 group">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5a4 4 0 0 1 4 4v2.5l1 1.5H2L3 8V5.5a4 4 0 0 1 4-4z"
              stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"
              className="group-hover:stroke-white/60 transition-colors" />
            <path d="M5.5 11.5a1.5 1.5 0 0 0 3 0"
              stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round"
              className="group-hover:stroke-white/60 transition-colors" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full
            bg-violet-400 shadow-sm shadow-violet-400/50" />
        </button>

        {/* Avatar dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setOpen((p) => !p)}
            className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-lg border transition-all duration-150
              ${open
                ? "bg-white/[0.08] border-white/[0.14]"
                : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.12] active:bg-white/[0.07] active:border-white/[0.12]"
              }`}
          >
            <div className="w-[26px] h-[26px] rounded-md bg-gradient-to-br from-violet-600 to-indigo-700
              flex items-center justify-center text-[10px] font-bold text-white/90 shadow-sm">
              <span translate="no">{initials}</span>
            </div>
            <span className="text-[12px] font-medium text-white/55 max-w-[80px] truncate" translate="no">
              {firstName}
            </span>
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            >
              <path d="M3 4l2 2 2-2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute top-[calc(100%+6px)] right-0 w-[210px]
              bg-[#0f1118] border border-white/[0.09] rounded-xl overflow-hidden
              shadow-[0_16px_48px_rgba(0,0,0,0.5)] z-50
              animate-in fade-in slide-in-from-top-1 duration-150">

              {/* User info */}
              <div className="px-3.5 py-3 border-b border-white/[0.07]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700
                    flex items-center justify-center text-[11px] font-bold text-white/90 shrink-0">
                    <span translate="no">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#f0eeff] truncate leading-tight" translate="no">
                      {user?.name}
                    </p>
                    <p className="text-[11px] text-white/30 truncate" translate="no">{user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="p-1.5 space-y-0.5">
                <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg
                  text-[12px] font-medium text-white/45 hover:text-white/80 hover:bg-white/[0.05]
                  active:text-white/80 active:bg-white/[0.05] transition-all duration-100 group">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                    className="text-white/25 group-hover:text-white/50 transition-colors">
                    <circle cx="6.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M1.5 11.5c0-2.761 2.239-4 5-4s5 1.239 5 4"
                      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  {t("nav.profile")}
                </button>

                <div className="h-px bg-white/[0.06] mx-1" />

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg
                    text-[12px] font-medium text-white/45 hover:text-red-300 hover:bg-red-500/[0.08]
                    active:text-red-300 active:bg-red-500/[0.08] transition-all duration-100 group"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                    className="text-white/25 group-hover:text-red-400/70 transition-colors">
                    <path d="M5 2H2.5A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12H5M9 9.5l2.5-3L9 3M4.5 6.5h7"
                      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t("nav.signOut")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

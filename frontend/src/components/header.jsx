import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import { useSignOutMutation } from "../redux/api/auth";

const Header = () => {
  const { user } = useOutletContext();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const [signOut] = useSignOutMutation();

  useEffect(() => {
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target)) setOpen(false);
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
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex items-center justify-between px-5 h-14
      bg-white/[0.03] border-b border-white/[0.07] relative z-50">

      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600
          flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 4h12M6 8h12M6 4c4 0 6 2 6 4s-2 4-6 4h2l6 8"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="text-[15px] font-semibold text-[#f0eeff] tracking-tight">
          Arkalyn<span className="text-violet-400"> Kitty</span>
        </span>
      </div>

      <div className="flex items-center gap-2.5">

        <button className="relative w-[34px] h-[34px] rounded-lg bg-white/[0.04] border border-white/[0.08]
          flex items-center justify-center hover:bg-white/[0.08] transition-all">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5a4 4 0 0 1 4 4v2.5l1 1.5H2L3 8V5.5a4 4 0 0 1 4-4z"
              stroke="rgba(255,255,255,0.4)" strokeWidth="1.2"/>
            <path d="M5.5 11.5a1.5 1.5 0 0 0 3 0"
              stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span className="absolute top-[7px] right-[7px] w-1.5 h-1.5 rounded-full
            bg-violet-400 border-[1.5px] border-[#0a0a0f]" />
        </button>

        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setOpen((p) => !p)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-lg
              bg-white/[0.04] border border-white/[0.08]
              hover:bg-white/[0.08] hover:border-white/[0.14] transition-all"
          >
            <div className="w-[26px] h-[26px] rounded-md bg-gradient-to-br from-violet-900
              to-indigo-900 flex items-center justify-center text-[10px] font-semibold text-violet-300">
              {initials}
            </div>
            <span className="text-[12px] font-medium text-white/60">
              {user?.name?.split(" ")[0]}
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 4l2 2 2-2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>

          {open && (
            <div className="absolute top-[calc(100%+8px)] right-0 w-[200px] bg-[#111118]
              border border-white/10 rounded-xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50">

              <div className="px-2.5 py-2 pb-2.5 border-b border-white/[0.06] mb-1">
                <p className="text-[13px] font-semibold text-[#f0eeff]">{user?.name}</p>
                <p className="text-[11px] text-white/30 mt-0.5">{user?.email}</p>
              </div>

              <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md
                text-[12px] text-white/50 hover:bg-white/5 hover:text-white/80 transition-all">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M1.5 11.5c0-2.761 2.239-4 5-4s5 1.239 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Profile
              </button>

              <div className="h-px bg-white/[0.06] my-1" />

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md
                  text-[12px] text-white/50 hover:bg-red-500/8 hover:text-red-300 transition-all"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M5 2H2.5A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12H5M9 9.5l2.5-3L9 3M4.5 6.5h7"
                    stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sign out
              </button>

            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
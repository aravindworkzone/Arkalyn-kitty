import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const CHORD_TIMEOUT_MS = 1500;

const isTypingTarget = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
};

const focusSearch = () => {
  const el = document.querySelector<HTMLElement>('[data-shortcut="search"]');
  if (el) {
    el.focus();
    if (el instanceof HTMLInputElement) el.select();
  }
};

const groupIdFromPath = (pathname: string): string | null => {
  const m = pathname.match(/^\/groups\/([^/]+)/);
  if (!m || m[1] === "new") return null;
  return m[1] ?? null;
};

export default function useGlobalShortcuts(onOpenHelp: () => void) {
  const navigate = useNavigate();
  const location = useLocation();
  const pendingGRef = useRef(false);
  const pendingTimerRef = useRef<number | null>(null);

  const pathnameRef = useRef(location.pathname);
  useEffect(() => { pathnameRef.current = location.pathname; }, [location.pathname]);

  useEffect(() => {
    const clearChord = () => {
      pendingGRef.current = false;
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };

    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "Escape") {
        if (pendingGRef.current) clearChord();
        return;
      }

      const key = e.key.toLowerCase();

      if (pendingGRef.current) {
        clearChord();
        const groupId = groupIdFromPath(pathnameRef.current);
        switch (key) {
          case "g":
            e.preventDefault();
            navigate("/groups");
            return;
          case "h":
            e.preventDefault();
            navigate("/");
            return;
          case "e":
            if (groupId) { e.preventDefault(); navigate(`/groups/${groupId}/expenses`); }
            return;
          case "c":
            if (groupId) { e.preventDefault(); navigate(`/groups/${groupId}/credits`); }
            return;
          case "r":
            if (groupId) { e.preventDefault(); navigate(`/groups/${groupId}/reports/categories`); }
            return;
          case "a":
            if (groupId) { e.preventDefault(); navigate(`/groups/${groupId}/activity`); }
            return;
          default:
            return;
        }
      }

      if (key === "g") {
        e.preventDefault();
        pendingGRef.current = true;
        pendingTimerRef.current = window.setTimeout(clearChord, CHORD_TIMEOUT_MS);
        return;
      }

      if (key === "?" || (e.shiftKey && key === "/")) {
        e.preventDefault();
        onOpenHelp();
        return;
      }

      if (key === "/") {
        const target = document.querySelector<HTMLElement>('[data-shortcut="search"]');
        if (target) {
          e.preventDefault();
          focusSearch();
        }
        return;
      }

      if (key === "n") {
        const groupId = groupIdFromPath(pathnameRef.current);
        if (groupId) {
          e.preventDefault();
          navigate(`/groups/${groupId}/expenses/new`);
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      clearChord();
    };
  }, [navigate, onOpenHelp]);
}

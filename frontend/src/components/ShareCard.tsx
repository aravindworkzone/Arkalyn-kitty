import { forwardRef, useEffect, useState } from "react";
import type { Expense } from "../interface/expense";
import type { GroupCredit } from "../interface/transaction";

// Cache the logo as a base64 data URL so html-to-image inlines it reliably
// instead of refetching during rasterization.
let logoDataUrlCache: string | null = null;
let logoLoadPromise: Promise<string | null> | null = null;

const loadLogoDataUrl = (): Promise<string | null> => {
  if (logoDataUrlCache) return Promise.resolve(logoDataUrlCache);
  if (logoLoadPromise) return logoLoadPromise;
  logoLoadPromise = fetch("/mini-logo.png")
    .then((r) => (r.ok ? r.blob() : null))
    .then((blob) => {
      if (!blob) return null;
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    })
    .then((dataUrl) => {
      logoDataUrlCache = dataUrl;
      return dataUrl;
    })
    .catch(() => null);
  return logoLoadPromise;
};

const useLogoDataUrl = (): string | null => {
  const [src, setSrc] = useState<string | null>(logoDataUrlCache);
  useEffect(() => {
    if (logoDataUrlCache) return;
    let alive = true;
    loadLogoDataUrl().then((url) => {
      if (alive && url) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, []);
  return src;
};

type ShareGroup = { name?: string; displayId?: string } | null | undefined;

type ShareCardProps =
  | { type: "expense"; expense: Expense; group: ShareGroup }
  | { type: "credit"; credit: GroupCredit; group: ShareGroup };

// Wrapper hides the card off-screen while keeping it laid-out and visible to
// html-to-image. The card itself must stay in normal flow — if "position: fixed"
// with negative coordinates is on the captured node, html-to-image's clone
// keeps those coordinates and the rasterized output is blank.
const hideWrapper: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "1080px",
  height: "1350px",
  pointerEvents: "none",
  opacity: 0,
  zIndex: -1,
  overflow: "hidden",
  transform: "translate(-200vw, 0)",
};

const card: React.CSSProperties = {
  position: "relative",
  width: "1080px",
  minHeight: "1350px",
  padding: "72px 64px",
  background: "linear-gradient(160deg, #14102a 0%, #0a0817 60%, #050410 100%)",
  color: "#f0eeff",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
};

const brandRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  marginBottom: "12px",
};

const brandLogo: React.CSSProperties = {
  width: "44px",
  height: "auto",
  display: "block",
};

const brandText: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: "#f0eeff",
};

const groupLine: React.CSSProperties = {
  fontSize: "20px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)",
  fontWeight: 600,
  marginBottom: "48px",
};

const divider: React.CSSProperties = {
  height: "1px",
  background: "rgba(255,255,255,0.08)",
  margin: "40px 0",
};

const heroAmount = (positive: boolean): React.CSSProperties => ({
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: "128px",
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: "-0.03em",
  color: positive ? "#4ade80" : "#f87171",
});

const heroTitle: React.CSSProperties = {
  fontSize: "36px",
  fontWeight: 500,
  color: "rgba(255,255,255,0.7)",
  marginTop: "28px",
  lineHeight: 1.3,
  wordBreak: "break-word",
};

const rowsWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0px",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "32px",
  padding: "20px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const rowLabel: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.35)",
};

const rowValue: React.CSSProperties = {
  fontSize: "26px",
  fontWeight: 500,
  color: "rgba(255,255,255,0.85)",
  textAlign: "right",
  wordBreak: "break-word",
};

const chip = (hex: string): React.CSSProperties => ({
  display: "inline-block",
  fontSize: "20px",
  fontWeight: 700,
  padding: "8px 16px",
  borderRadius: "10px",
  background: `${hex}26`,
  color: hex,
});

const footer: React.CSSProperties = {
  marginTop: "auto",
  paddingTop: "48px",
  fontSize: "20px",
  color: "rgba(255,255,255,0.3)",
  letterSpacing: "0.1em",
  textAlign: "center",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={rowStyle}>
    <span style={rowLabel}>{label}</span>
    <div style={rowValue}>{children}</div>
  </div>
);

const Header = ({ group, logoSrc }: { group: ShareGroup; logoSrc: string | null }) => {
  const parts = [
    group?.name,
    group?.displayId,
  ].filter(Boolean) as string[];
  return (
    <>
      <div style={brandRow}>
        {logoSrc && <img src={logoSrc} alt="" style={brandLogo} />}
        <div style={brandText}>Arkalyn-Kitty</div>
      </div>
      <div style={groupLine}>
        {parts.length ? `Group · ${parts.join(" · ")}` : "Group activity"}
      </div>
    </>
  );
};

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>((props, ref) => {
  const logoSrc = useLogoDataUrl();

  if (props.type === "expense") {
    const { expense, group } = props;
    const hasSplit = expense.splitBetween?.length > 0;
    return (
      <div style={hideWrapper} aria-hidden="true">
      <div ref={ref} style={card}>
        <Header group={group} logoSrc={logoSrc} />

        <div style={heroAmount(false)}>
          -₹{expense.amount.toLocaleString("en-IN")}
        </div>
        <div style={heroTitle}>{expense.title}</div>

        <div style={divider} />

        <div style={rowsWrap}>
          <Row label="Category">
            <span style={chip(expense.category.color)}>{expense.category.name}</span>
          </Row>
          <Row label="Paid by">
            <div>
              <div style={{ fontSize: "26px", color: "rgba(255,255,255,0.9)" }}>
                {expense.paidBy.name}
              </div>
              <div style={{ fontSize: "18px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
                {expense.paidBy.email}
              </div>
            </div>
          </Row>
          <Row label="Payment">
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                padding: "8px 16px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              {expense.paymentType}
            </span>
          </Row>
          <Row label="Date">{formatDate(expense.date)}</Row>
          {hasSplit && (
            <Row label="Split">
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {expense.splitBetween.map((s) => (
                  <div
                    key={s.userId._id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "32px",
                      minWidth: "320px",
                    }}
                  >
                    <span style={{ fontSize: "22px", color: "rgba(255,255,255,0.65)" }}>
                      {s.userId.name}
                    </span>
                    <span
                      style={{
                        fontSize: "22px",
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      ₹{s.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </Row>
          )}
        </div>

        <div style={footer}>Shared from Arkalyn-Kitty</div>
      </div>
      </div>
    );
  }

  const { credit, group } = props;
  return (
    <div style={hideWrapper} aria-hidden="true">
    <div ref={ref} style={card}>
      <Header group={group} logoSrc={logoSrc} />

      <div style={heroAmount(true)}>
        +₹{credit.amount.toLocaleString("en-IN")}
      </div>
      <div style={heroTitle}>{credit.description || "Contribution"}</div>

      <div style={divider} />

      <div style={rowsWrap}>
        <Row label="Type">
          <span style={chip("#34d399")}>CREDIT</span>
        </Row>
        <Row label="Contributed by">
          <div>
            <div style={{ fontSize: "26px", color: "rgba(255,255,255,0.9)" }}>
              {credit.performedBy?.name}
            </div>
            {credit.performedBy?.email && (
              <div style={{ fontSize: "18px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
                {credit.performedBy.email}
              </div>
            )}
          </div>
        </Row>
        <Row label="Date">{formatDate(credit.createdAt)}</Row>
        <Row label="Logged at">{formatTime(credit.createdAt)}</Row>
      </div>

      <div style={footer}>Shared from Arkalyn-Kitty</div>
    </div>
    </div>
  );
});

ShareCard.displayName = "ShareCard";

export default ShareCard;

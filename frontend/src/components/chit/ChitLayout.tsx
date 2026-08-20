import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  Note,
  PageBackground,
  PageContainer,
  PageHeader,
  BackButton,
  StatusBanner,
} from "../ui";
import NotFoundPage from "../../page/NotFoundPage";
import { useChitBoard } from "../../hooks/useChitBoard";
import { formatRupees } from "../../helpers/money";

/**
 * The shell the three chit pages share: identity, the scheme-wide notices and the
 * result banner.
 *
 * It carries no navigation of its own. The sidebar lists My chit, Cycles and
 * Collection as separate destinations, and a second rail here would be the same
 * mistake GroupActionBar made — two menus of one set of links, drifting apart.
 *
 * It owns the board query and the mutations, and hands both down through the
 * router's outlet context — see the docblock on useChitBoard for why the three
 * pages cannot each resolve their own.
 *
 * The notices live HERE rather than on any one page because they describe the
 * scheme, not a section of it: a cancelled chit is cancelled on every page, and a
 * draft has nothing for any of them to show. Landing on /chit/collection with a
 * draft scheme should explain the draft, not render an empty roster.
 */

export default function ChitLayout() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const ctx = useChitBoard();

  const money = (n: number) => formatRupees(n, i18n.language);
  const { group, groupError, isLoading, scheme, canManage, msg } = ctx;

  if (groupError) return <NotFoundPage />;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface text-fg">
        <PageBackground />
        <PageContainer width="content">
          <div className="space-y-4 max-w-3xl">
            <div className="h-24 rounded-2xl bg-surface-hover animate-pulse" />
            <div className="h-40 rounded-2xl bg-surface-hover animate-pulse" />
            <div className="h-64 rounded-2xl bg-surface-hover animate-pulse" />
          </div>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />
      <PageContainer width="content">
        <div className="inline-block">
          <BackButton onClick={() => navigate(`/groups/${groupId}`)} />
        </div>

        <PageHeader
          accent="brand"
          icon={
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M12 7a5 5 0 1 1-1.6-3.7M12 1.6V4.4H9.2"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
          label={t("chit.label", "Chit")}
          title={group?.name ?? t("chit.title", "Chit fund")}
          description={
            scheme
              ? t("chit.description", {
                  amount: money(scheme.amountPerMember),
                  pot: money(scheme.potPerCycle),
                  count: scheme.participantCount,
                  defaultValue:
                    "{{count}} members paying {{amount}} each cycle — a pot of {{pot}}.",
                })
              : t("chit.descriptionEmpty", "A chit fund for this group.")
          }
        />

        <div className="space-y-4 max-w-3xl">
          <StatusBanner status={msg ? (msg.ok ? "ok" : "err") : null} text={msg?.text ?? ""} />

          {/* ── No scheme, or a scheme not yet running ───────────────────── */}
          {!scheme && (
            <Card title={t("chit.notStartedTitle", "No chit yet")}>
              <p className="text-theme-xs text-fg-muted">
                {canManage || group?.role === "SUPER_ADMIN"
                  ? t(
                      "chit.noSchemeAdmin",
                      "No chit set up yet. Choose the amount, the members and their turn order to begin."
                    )
                  : t(
                      "chit.noSchemeMember",
                      "This group hasn't set up its chit yet. The group owner starts it."
                    )}
              </p>
              {group?.role === "SUPER_ADMIN" && (
                <div className="mt-3">
                  <Button size="sm" onClick={() => navigate(`/groups/${groupId}/chit/setup`)}>
                    {t("chit.setUp", "Set up the chit")}
                  </Button>
                </div>
              )}
            </Card>
          )}

          {scheme?.status === "DRAFT" && (
            <Note tone={canManage ? "warning" : "neutral"}>
              {canManage
                ? t(
                    "chit.draftOrganizer",
                    "This chit is still a draft. Nothing is collected and no turns are fixed until you start it — and starting it locks the amount, the members and the order."
                  )
                : t(
                    "chit.draftMember",
                    "The chit is being set up. You'll see your amount and dates here once it starts."
                  )}
            </Note>
          )}

          {scheme?.status === "DRAFT" && canManage && (
            <Button size="sm" onClick={() => navigate(`/groups/${groupId}/chit/setup`)}>
              {t("chit.continueSetup", "Continue setup")}
            </Button>
          )}

          {scheme?.status === "CANCELLED" && (
            <Note tone="error">
              {t(
                "chit.cancelled",
                "This chit was cancelled. Nothing further is collected — the history below is kept as a record."
              )}
            </Note>
          )}

          {scheme?.status === "COMPLETED" && (
            <Note tone="success">
              {t("chit.completed", {
                total: scheme.totalCycles,
                defaultValue: "This chit is finished. All {{total}} cycles were paid out.",
              })}
            </Note>
          )}

          <Outlet context={ctx} />
        </div>
      </PageContainer>
    </div>
  );
}

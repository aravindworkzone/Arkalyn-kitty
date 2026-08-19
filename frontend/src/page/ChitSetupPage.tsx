import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AmountInput,
  BackButton,
  Button,
  Card,
  DatePicker,
  FormSection,
  INPUT_CLASS,
  Note,
  PageBackground,
  PageContainer,
  PageHeader,
  Select,
  StatusBanner,
} from "../components/ui";
import NotFoundPage from "./NotFoundPage";
import { useGetGroupByIdQuery, useGetGroupMembersQuery } from "../redux/api/group";
import {
  useGetChitBoardQuery,
  useCreateChitSchemeMutation,
  useUpdateChitSchemeMutation,
  useActivateChitSchemeMutation,
} from "../redux/api/chit";
import { formatRupees } from "../helpers/money";
import { dayLabel } from "../helpers/formatters";
import { getApiErrorMessage } from "../hooks/useApiError";

/**
 * Chit setup — a page, not a tab in group settings.
 *
 * Every existing management tab gates on isAdmin or isSuperAdmin; this gates on
 * the chit organiser, which is a different axis. And on the Free plan every
 * member is an ADMIN, so dropping a chit tab into `allowedTabs` would show it to
 * everyone in exactly the groups where it must not be. It also needs full width
 * for the ordering interaction.
 *
 * Two steps, because activation is the irreversible one: save a draft as often as
 * you like, then start the chit — which freezes the amount, the members and the
 * order, and creates every cycle and every contribution up front.
 */

const ORDER_HINT_LIMIT = 50;

export default function ChitSetupPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const money = (n: number) => formatRupees(n, i18n.language);

  const { isError: groupError } = useGetGroupByIdQuery(groupId!, { skip: !groupId });
  const { data: members = [] } = useGetGroupMembersQuery(groupId!, { skip: !groupId });
  const { data: board } = useGetChitBoardQuery({ groupId: groupId! }, { skip: !groupId });

  const [createScheme, { isLoading: isCreating }] = useCreateChitSchemeMutation();
  const [updateScheme, { isLoading: isSaving }] = useUpdateChitSchemeMutation();
  const [activateScheme, { isLoading: isActivating }] = useActivateChitSchemeMutation();

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [interval, setIntervalDays] = useState("30");
  const [dueDays, setDueDays] = useState("10");
  // The turn order IS this array. Positions are never typed, so they can never
  // be duplicated or leave a gap — the invalid states are unrepresentable and the
  // form needs no ordering validator at all.
  const [order, setOrder] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  const scheme = board?.scheme ?? null;
  const isDraft = !scheme || scheme.status === "DRAFT";

  // Seed the form from an existing draft, the first time that draft arrives.
  //
  // Adjusted DURING render rather than in an effect. React sanctions this for
  // "reset state when a prop changes" — it re-renders before committing, so the
  // user never sees the stale values — whereas the same work in an effect paints
  // the empty form first and then overwrites it, which is what
  // react-hooks/set-state-in-effect exists to catch.
  const [seededSchemeId, setSeededSchemeId] = useState<string | null>(null);
  if (scheme && scheme.status === "DRAFT" && seededSchemeId !== scheme.schemeId) {
    setSeededSchemeId(scheme.schemeId);
    setAmount(String(scheme.amountPerMember));
    setStartDate(scheme.startDate.slice(0, 10));
    setIntervalDays(String(scheme.cycleIntervalDays));
    setDueDays(String(scheme.dueDays));
    setOrder((board?.turns ?? []).map((turn) => turn.userId));
  }

  if (groupError) return <NotFoundPage />;

  const nameOf = (userId: string) =>
    members.find((m) => m.userId._id === userId)?.userId.name ?? "Member";

  const pool = members.filter((m) => !m.settlement && !order.includes(m.userId._id));
  const amountNumber = Number(amount) || 0;
  const pot = amountNumber * order.length;

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
      return true;
    } catch (err) {
      setMsg({
        ok: false,
        text: getApiErrorMessage(err, t("chitSetup.failed", "That didn't work. Try again.")),
      });
      return false;
    }
  };

  const move = (index: number, delta: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const participantsPayload = order.map((userId, i) => ({ userId, position: i + 1 }));

  const onSave = async () => {
    if (!amountNumber) {
      setMsg({ ok: false, text: t("chitSetup.needAmount", "Enter the amount each member pays.") });
      return;
    }
    if (!startDate) {
      setMsg({ ok: false, text: t("chitSetup.needDate", "Choose a start date.") });
      return;
    }

    if (!scheme) {
      const ok = await run(
        () =>
          createScheme({
            groupId: groupId!,
            amountPerMember: amountNumber,
            startDate,
            cycleIntervalDays: Number(interval),
            dueDays: Number(dueDays),
          }).unwrap(),
        t("chitSetup.created", "Draft saved.")
      );
      if (!ok) return;
    }

    await run(
      () =>
        updateScheme({
          groupId: groupId!,
          amountPerMember: amountNumber,
          startDate,
          cycleIntervalDays: Number(interval),
          dueDays: Number(dueDays),
          ...(order.length >= 2 ? { participants: participantsPayload } : {}),
        }).unwrap(),
      t("chitSetup.saved", "Draft saved.")
    );
  };

  const onActivate = async () => {
    const ok = await run(
      () => activateScheme({ groupId: groupId! }).unwrap(),
      t("chitSetup.activated", "The chit has started.")
    );
    if (ok) navigate(`/groups/${groupId}/chit`);
  };

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />
      <PageContainer width="form">
        <div className="inline-block">
          <BackButton onClick={() => navigate(`/groups/${groupId}/chit`)} />
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
          label={t("chitSetup.label", "Chit setup")}
          title={t("chitSetup.title", "Set up the chit")}
          description={t(
            "chitSetup.description",
            "Everyone pays the same amount each cycle, and one member takes the pot each time, in the order you set here."
          )}
        />

        <div className="space-y-4">
          <StatusBanner status={msg ? (msg.ok ? "ok" : "err") : null} text={msg?.text ?? ""} />

          {!isDraft && (
            <Note tone="warning">
              {t(
                "chitSetup.alreadyRunning",
                "This chit has already started, so its amount, members and order are fixed. Only the dates can still be changed."
              )}
            </Note>
          )}

          {/* Step 1 — the money */}
          <FormSection step="01" title={t("chitSetup.amountStep", "How much, how often")}>
            <div className="space-y-3">
              <AmountInput
                size="md"
                value={amount}
                onChange={setAmount}
                placeholder={t("chitSetup.amountPlaceholder", "Amount each member pays")}
                inputClassName={INPUT_CLASS}
              />

              <Select
                value={interval}
                onChange={setIntervalDays}
                options={[
                  { value: "30", label: t("chitSetup.monthly", "Monthly (30 days)") },
                  { value: "14", label: t("chitSetup.fortnightly", "Every 2 weeks") },
                  { value: "7", label: t("chitSetup.weekly", "Weekly") },
                ]}
                name="chit-interval"
              />

              <Select
                value={dueDays}
                onChange={setDueDays}
                options={[
                  { value: "0", label: t("chitSetup.dueSameDay", "Due on the cycle date") },
                  { value: "3", label: t("chitSetup.due3", "Due within 3 days") },
                  { value: "7", label: t("chitSetup.due7", "Due within 7 days") },
                  { value: "10", label: t("chitSetup.due10", "Due within 10 days") },
                ]}
                name="chit-duedays"
              />
              <p className="text-theme-2xs text-fg-muted">
                {t(
                  "chitSetup.dueDaysHint",
                  "How long members have after each cycle opens before their contribution counts as missed."
                )}
              </p>

              <DatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder={t("chitSetup.startDate", "First cycle date")}
                name="chit-start"
              />

              {order.length > 0 && amountNumber > 0 && (
                <p className="text-theme-xs text-fg-muted" translate="no">
                  {t("chitSetup.potPreview", {
                    pot: money(pot),
                    count: order.length,
                    each: money(amountNumber),
                    defaultValue: "Pot each cycle: {{pot}} — {{count}} members × {{each}}",
                  })}
                </p>
              )}
            </div>
          </FormSection>

          {/* Step 2 — who, and in what order */}
          <FormSection step="02" title={t("chitSetup.orderStep", "Members and turn order")}>
            <div className="space-y-3">
              <p className="text-theme-2xs text-fg-muted">
                {t(
                  "chitSetup.orderHint",
                  "Tap a member to add them. Position 1 receives the pot in the first cycle, position 2 in the second, and so on."
                )}
              </p>

              {pool.length > 0 && isDraft && (
                <div className="flex flex-wrap gap-1.5">
                  {pool.map((m) => (
                    <button
                      key={m.userId._id}
                      type="button"
                      onClick={() =>
                        setOrder((prev) =>
                          prev.length >= ORDER_HINT_LIMIT ? prev : [...prev, m.userId._id]
                        )
                      }
                      className="text-theme-xs px-2.5 py-1 rounded-lg border border-line bg-surface-raised
                        hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                      translate="no"
                    >
                      + {m.userId.name}
                    </button>
                  ))}
                </div>
              )}

              {isDraft && members.length > 1 && order.length === 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setOrder(members.filter((m) => !m.settlement).map((m) => m.userId._id))}
                >
                  {t("chitSetup.addAll", "Add everyone")}
                </Button>
              )}

              {order.length === 0 ? (
                <p className="text-theme-xs text-fg-muted">
                  {t("chitSetup.orderEmpty", "No members added yet.")}
                </p>
              ) : (
                <div className="divide-y divide-line border border-line rounded-xl">
                  {order.map((userId, i) => (
                    <div key={userId} className="flex items-center justify-between gap-2 px-3 py-2">
                      <p className="text-theme-sm text-fg truncate" translate="no">
                        <span className="font-mono text-fg-muted mr-2">#{i + 1}</span>
                        {nameOf(userId)}
                      </p>
                      {isDraft && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            aria-label={t("chitSetup.moveUp", {
                              name: nameOf(userId),
                              defaultValue: "Move {{name}} up",
                            })}
                            className="w-7 h-7 rounded-lg border border-line text-fg-muted disabled:opacity-30
                              hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => move(i, 1)}
                            disabled={i === order.length - 1}
                            aria-label={t("chitSetup.moveDown", {
                              name: nameOf(userId),
                              defaultValue: "Move {{name}} down",
                            })}
                            className="w-7 h-7 rounded-lg border border-line text-fg-muted disabled:opacity-30
                              hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrder((prev) => prev.filter((id) => id !== userId))}
                            aria-label={t("chitSetup.remove", {
                              name: nameOf(userId),
                              defaultValue: "Remove {{name}}",
                            })}
                            className="w-7 h-7 rounded-lg border border-line text-fg-muted
                              hover:border-error-300 hover:text-error-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormSection>

          {/* Step 3 — review and start */}
          <FormSection step="03" title={t("chitSetup.reviewStep", "Review and start")}>
            <div className="space-y-3">
              <Button
                variant="secondary"
                loading={isCreating || isSaving}
                disabled={!isDraft}
                onClick={onSave}
              >
                {t("chitSetup.saveDraft", "Save draft")}
              </Button>

              {isDraft && order.length >= 2 && amountNumber > 0 && startDate && (
                <Card title={t("chitSetup.previewTitle", "The schedule")}>
                  <div className="space-y-1">
                    {order.map((userId, i) => (
                      <p key={userId} className="text-theme-xs text-fg-muted" translate="no">
                        {t("chitSetup.previewRow", {
                          n: i + 1,
                          name: nameOf(userId),
                          amount: money(pot),
                          defaultValue: "Cycle {{n}} → {{name}} receives {{amount}}",
                        })}
                      </p>
                    ))}
                  </div>
                  <p className="text-theme-2xs text-fg-muted mt-2">
                    {t("chitSetup.previewStart", {
                      date: dayLabel(startDate),
                      defaultValue: "First contribution due {{date}}.",
                    })}
                  </p>
                </Card>
              )}

              {isDraft &&
                (confirming ? (
                  <div className="space-y-2">
                    <Note tone="warning">
                      {t(
                        "chitSetup.activateWarning",
                        "Starting the chit fixes the amount, the members and the order — they cannot be changed afterwards. Only the dates stay editable."
                      )}
                    </Note>
                    <div className="flex gap-2">
                      <Button loading={isActivating} onClick={onActivate}>
                        {t("chitSetup.confirmActivate", "Start the chit")}
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirming(false)}>
                        {t("chitSetup.cancel", "Cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    disabled={!scheme || order.length < 2 || !amountNumber}
                    onClick={() => setConfirming(true)}
                  >
                    {t("chitSetup.activate", "Start the chit")}
                  </Button>
                ))}
            </div>
          </FormSection>
        </div>
      </PageContainer>
    </div>
  );
}

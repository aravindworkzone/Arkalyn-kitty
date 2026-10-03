import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionButton, AmountInput, INPUT_CLASS, StatusBanner } from "../ui";
import { useGetGroupLinksQuery, useSetReserveLimitMutation } from "../../redux/api/groupLink";

interface Props {
  groupId?: string;
}

const money = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * A Reserve's fixed credit limit — the most all the Family groups it lends to
 * may owe it at once. Only this tab changes it. Contributions (the tab beside
 * this one) refill the wallet but never touch the limit, so available credit is
 * min(limit − lent out, wallet): a short wallet is refilled by a contribution,
 * and the limit stays where an admin put it.
 */
export default function SettingsCreditLimit({ groupId }: Props) {
  const { t } = useTranslation();
  const { data: links } = useGetGroupLinksQuery(groupId!, { skip: !groupId });
  const [setReserveLimit, { isLoading }] = useSetReserveLimitMutation();
  // null = untouched, so the field shows the saved limit until edited.
  const [draft, setDraft] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const credit = links?.reserveCredit ?? { creditLimit: 0, creditUsed: 0, balance: 0, available: 0 };
  const value = draft ?? String(credit.creditLimit);
  // The wallet is what is holding available credit back, not the limit.
  const walletShort = credit.balance < credit.creditLimit - credit.creditUsed;

  const onSave = async () => {
    const next = Number(value);
    if (value.trim() === "" || !Number.isFinite(next) || next < 0) return;
    setMsg(null);
    try {
      await setReserveLimit({ groupId: groupId!, creditLimit: next }).unwrap();
      setDraft(null);
      setMsg({ ok: true, text: t("connections.limitSaved", "Credit limit saved.") });
    } catch (err: unknown) {
      const text = (err as { data?: { message?: string } })?.data?.message;
      setMsg({ ok: false, text: text || t("connections.actionFailed", "That didn't work. Try again.") });
    }
  };

  const stats: [string, number, boolean][] = [
    [t("connections.limit", "Credit limit"), credit.creditLimit, false],
    [t("connections.lentOut", "Lent out"), credit.creditUsed, credit.creditUsed > 0],
    [t("connections.wallet", "Wallet"), credit.balance, walletShort],
    [t("connections.availableCredit", "Available credit"), credit.available, false],
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-fg-muted">
        {t(
          "connections.limitTabHint",
          "A fixed limit for all the Family groups this Reserve lends to — together they can never owe more. Only this setting changes it: contributions refill the wallet but leave the limit alone."
        )}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-theme-xs">
        {stats.map(([label, amount, warn]) => (
          <div key={label} className="rounded-lg bg-surface-hover px-3 py-2">
            <p className="text-fg-muted">{label}</p>
            <p
              className={`font-semibold ${warn ? "text-warning-700 dark:text-warning-400" : "text-fg"}`}
              translate="no"
            >
              {money(amount)}
            </p>
          </div>
        ))}
      </div>

      {walletShort && credit.creditLimit > 0 && (
        <p className="text-theme-xs text-warning-700 dark:text-warning-400" translate="no">
          {t("connections.walletShort", {
            defaultValue:
              "The wallet holds less than the limit allows ({{room}} left in the limit, {{wallet}} in the wallet). Add a contribution to refill it.",
            room: money(Math.max(0, credit.creditLimit - credit.creditUsed)),
            wallet: money(credit.balance),
          })}
        </p>
      )}

      <AmountInput
        size="md"
        value={value}
        onChange={setDraft}
        placeholder={t("connections.limit", "Credit limit")}
        inputClassName={INPUT_CLASS}
      />
      <p className="text-theme-xs text-fg-muted" translate="no">
        {t("connections.limitHint", {
          defaultValue:
            "Your Family groups owe {{owed}} in total. A limit below that only stops new spending until they repay.",
          owed: money(credit.creditUsed),
        })}
      </p>

      <StatusBanner status={msg ? (msg.ok ? "ok" : "err") : null} text={msg?.text ?? ""} />

      <ActionButton
        tone="brand"
        loading={isLoading}
        disabled={value.trim() === "" || Number(value) === credit.creditLimit}
        onClick={onSave}
        fullWidth
      >
        {t("connections.saveLimit", "Save limit")}
      </ActionButton>
    </div>
  );
}

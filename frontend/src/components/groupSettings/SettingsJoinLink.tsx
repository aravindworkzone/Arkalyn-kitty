import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetJoinLinkQuery,
  useCreateJoinLinkMutation,
  useRevokeJoinLinkMutation,
} from "../../redux/api/joinLink";
import { ActionButton, FieldInput, INPUT_CLASS } from "../ui";

/**
 * The shareable join link, alongside invite-by-email in the Add member tab.
 *
 * The two are different reaches, not different mechanisms: an emailed invite
 * targets one known account, a link goes in a group chat and lets anyone with
 * it ask. Both land in the same approval queue, so nobody gets in unreviewed.
 *
 * The link is shown in full rather than masked. It isn't a credential — it only
 * buys the right to ask — and an admin who cannot re-copy the link they created
 * would just make a new one every time.
 */

interface Props {
  groupId?: string;
}

export default function SettingsJoinLink({ groupId }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const { data: link, isLoading } = useGetJoinLinkQuery(groupId!, { skip: !groupId });
  const [createJoinLink, { isLoading: isCreating }] = useCreateJoinLinkMutation();
  const [revokeJoinLink, { isLoading: isRevoking }] = useRevokeJoinLinkMutation();

  const url = link ? `${window.location.origin}/join/${link.token}` : "";

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
    } catch (err: any) {
      setError(err?.data?.message || t("joinLink.failed", "Couldn't send your request."));
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission).
      // The input below is selectable, so a manual copy still works.
      setError(t("joinLink.copyFailed", "Couldn't copy — select the link and copy it manually."));
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-theme-2xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {t("joinLink.settingsHeading", "Or share a join link")}
        </p>
        <p className="mt-1 text-theme-xs text-fg-muted">
          {t(
            "joinLink.settingsHint",
            "Anyone with this link can ask to join. You still approve every request, so sharing it doesn't add anyone by itself."
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="h-11 rounded-xl bg-surface-hover animate-pulse" />
      ) : link ? (
        <>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <FieldInput
                readOnly
                value={url}
                onChange={() => {}}
                onFocus={(e) => e.currentTarget.select()}
                className={INPUT_CLASS}
              />
            </div>
            <ActionButton
              tone="neutral"
              fullWidth={false}
              onClick={onCopy}
              className="px-4 text-xs"
            >
              {copied ? t("joinLink.copied", "Copied") : t("joinLink.copy", "Copy")}
            </ActionButton>
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionButton
              tone="neutral"
              fullWidth={false}
              loading={isCreating}
              onClick={() => run(() => createJoinLink({ groupId: groupId! }).unwrap())}
              className="px-4 text-xs"
            >
              {t("joinLink.rotate", "Generate a new link")}
            </ActionButton>
            <ActionButton
              tone="error"
              fullWidth={false}
              loading={isRevoking}
              onClick={() => run(() => revokeJoinLink({ groupId: groupId! }).unwrap())}
              className="px-4 text-xs"
            >
              {t("joinLink.revoke", "Turn off")}
            </ActionButton>
          </div>
          <p className="text-theme-xs text-fg-subtle">
            {t(
              "joinLink.rotateHint",
              "Generating a new link stops the old one working immediately."
            )}
          </p>
        </>
      ) : (
        <ActionButton
          tone="brand"
          loading={isCreating}
          onClick={() => run(() => createJoinLink({ groupId: groupId! }).unwrap())}
        >
          {t("joinLink.create", "Create a join link")}
        </ActionButton>
      )}

      {error && <p className="text-theme-xs text-error-700 dark:text-error-400">{error}</p>}
    </div>
  );
}

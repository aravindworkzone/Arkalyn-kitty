import { useTranslation } from "react-i18next";
import { ActionButton } from "../ui";

interface Props {
  onRequestDeleteGroup: () => void;
}

export default function SettingsDangerZone({ onRequestDeleteGroup }: Props) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="bg-red-500/[0.06] border border-red-500/15 rounded-xl px-4 py-4">
        <p className="text-xs font-semibold text-red-400 mb-1">{t("groupDetail.deleteGroup")}</p>
        <p className="text-[11px] text-white/30 mb-3">{t("groupDetail.deleteGroupDesc")}</p>
        <ActionButton tone="red" onClick={onRequestDeleteGroup}>
          {t("groupDetail.deleteGroup")}
        </ActionButton>
      </div>
    </div>
  );
}

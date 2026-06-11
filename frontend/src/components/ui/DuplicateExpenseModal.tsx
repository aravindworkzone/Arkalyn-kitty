import { useTranslation } from "react-i18next";
import BottomSheet from "./BottomSheet";
import ActionButton from "./ActionButton";
import type { DuplicateMatch } from "../../redux/api/expense";

interface DuplicateExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  match: DuplicateMatch;
}

export default function DuplicateExpenseModal({
  isOpen,
  onClose,
  onConfirm,
  match,
}: DuplicateExpenseModalProps) {
  const { t } = useTranslation();

  const formattedAmount = match.amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedDate = new Date(match.date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const detailRow = (label: string, value: string) => (
    <div className="flex items-start justify-between gap-2 py-2 border-b border-white/[0.06] last:border-b-0">
      <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{label}</span>
      <span className="text-[13px] text-white/80 text-right">{value}</span>
    </div>
  );

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("duplicateModal.title", "Duplicate Expense Detected")}
    >
      <p className="text-xs text-white/50 mb-4">
        {t("duplicateModal.description", "An expense with the same details already exists:")}
      </p>

      <div className="rounded-xl border border-white/[0.06] px-4 py-1 mb-6 bg-white/[0.02]">
        {detailRow(t("duplicateModal.date", "Date"), formattedDate)}
        {detailRow(t("duplicateModal.amount", "Amount"), `₹${formattedAmount}`)}
        {detailRow(t("duplicateModal.category", "Category"), match.category.name)}
        {detailRow(t("duplicateModal.title", "Title"), match.title)}
        {detailRow(t("duplicateModal.addedBy", "Added by"), match.createdBy.name)}
      </div>

      <div className="flex flex-col gap-2">
        <ActionButton onClick={onConfirm} tone="amber">
          {t("duplicateModal.addAnyway", "Add Anyway")}
        </ActionButton>
        <ActionButton onClick={onClose} tone="neutral">
          {t("duplicateModal.cancel", "Cancel")}
        </ActionButton>
      </div>
    </BottomSheet>
  );
}
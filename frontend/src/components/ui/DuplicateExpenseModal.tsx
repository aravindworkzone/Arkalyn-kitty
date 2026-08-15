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
    <div className="flex items-start justify-between gap-2 py-2 border-b border-line last:border-b-0">
      <span className="text-theme-xs font-medium text-fg-muted uppercase tracking-wider">{label}</span>
      <span className="text-theme-sm text-fg text-right">{value}</span>
    </div>
  );

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("duplicateModal.title", "Duplicate Expense Detected")}
    >
      <p className="text-theme-xs text-fg-muted mb-4">
        {t("duplicateModal.description", "An expense with the same details already exists:")}
      </p>

      <div className="rounded-xl border border-line px-4 py-1 mb-6 bg-surface-raised">
        {detailRow(t("duplicateModal.date", "Date"), formattedDate)}
        {detailRow(t("duplicateModal.amount", "Amount"), `₹${formattedAmount}`)}
        {detailRow(t("duplicateModal.category", "Category"), match.category.name)}
        {/* Its own key: `duplicateModal.title` is the sheet's heading, so
            reusing it here meant translating "Duplicate Expense Detected" and
            the row label "Title" as one string. */}
        {detailRow(t("duplicateModal.titleRow", "Title"), match.title)}
        {detailRow(t("duplicateModal.addedBy", "Added by"), match.createdBy.name)}
      </div>

      <div className="flex flex-col gap-2">
        <ActionButton onClick={onConfirm} tone="warning">
          {t("duplicateModal.addAnyway", "Add Anyway")}
        </ActionButton>
        <ActionButton onClick={onClose} tone="neutral">
          {t("duplicateModal.cancel", "Cancel")}
        </ActionButton>
      </div>
    </BottomSheet>
  );
}
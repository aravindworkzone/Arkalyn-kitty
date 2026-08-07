import { useTranslation } from "react-i18next";
import ExpenseRow, { type ExpenseRowItem } from "../expense/ExpenseRow";

interface TodayExpense extends ExpenseRowItem {
  time: string;
}

interface Props {
  expenses: TodayExpense[] | undefined;
  onSelect: (expense: TodayExpense) => void;
  onViewAll: () => void;
}

/** Today's expense list. */
export default function TodayExpenseFeed({ expenses, onSelect, onViewAll }: Props) {
  const { t } = useTranslation();
  const total = (expenses ?? []).reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-0.5">
        <p className="text-theme-xs font-semibold uppercase tracking-widest text-fg-muted">{t("groupDetail.today")}</p>
        <div className="flex items-center gap-3">
          {(expenses?.length ?? 0) > 0 && (
            <p className="text-theme-xs font-mono font-semibold text-fg-muted" translate="no">
              ₹{total.toLocaleString("en-IN")}
            </p>
          )}
          <button
            onClick={onViewAll}
            className="text-theme-2xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300
              transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded"
          >
            {t("groupDetail.viewAll")}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {(expenses?.length ?? 0) === 0 ? (
        <div
          onClick={onViewAll}
          className="text-center text-fg-muted text-theme-xs py-6 cursor-pointer hover:text-fg transition-colors"
        >
          {t("groupDetail.noExpensesToday")}
        </div>
      ) : (
        <div className="space-y-2">
          {expenses?.map((expense, i) => (
            <ExpenseRow
              key={expense._id}
              expense={expense}
              meta={expense.time}
              onSelect={() => onSelect(expense)}
              ariaLabel={t("groupDetail.openExpense", "Open expense: {{title}}", { title: expense.title })}
              style={{
                animation: "fadeSlideIn 0.25s ease forwards",
                animationDelay: `${i * 50}ms`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

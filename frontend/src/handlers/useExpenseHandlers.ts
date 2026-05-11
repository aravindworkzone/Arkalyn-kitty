import { useNavigate } from "react-router-dom";
import { useCreateExpenseMutation } from "../redux/api/expense";
import type { SplitEntry } from "../interface/expense";
import { validateTitle, validateAmount, validateDate } from "../helpers/validators";
import type { SetFieldError } from "../hooks/useFieldError";

export type ExpenseField = "title" | "amount" | "date" | "category" | "paidBy" | "splits";

export const toggleSplit = (
  setSplits: React.Dispatch<React.SetStateAction<SplitEntry[]>>,
  member: { _id: string; name: string }
) => {
  setSplits((prev) => {
    const exists = prev.find((s) => s.userId === member._id);
    if (exists) return prev.filter((s) => s.userId !== member._id);
    return [...prev, { userId: member._id, name: member.name, amount: 0 }];
  });
};

export const updateSplitAmount = (
  setSplits: React.Dispatch<React.SetStateAction<SplitEntry[]>>,
  userId: string,
  value: number
) => {
  setSplits((prev) =>
    prev.map((s) => (s.userId === userId ? { ...s, amount: value } : s))
  );
};

export const useExpenseHandlers = (groupId: string | undefined) => {
  const navigate = useNavigate();
  const [createExpense, { isLoading: isCreating }] = useCreateExpenseMutation();

  const handleSubmit = async (
    e: React.FormEvent,
    {
      title, totalAmount, maxAmount, categoryId, paidBy,
      splits, splitValid, date, paymentType,
      setFieldError, setApiError,
    }: {
      title: string;
      totalAmount: number;
      maxAmount?: number;
      categoryId: string;
      paidBy: string;
      splits: SplitEntry[];
      splitValid: boolean;
      date: string;
      paymentType: string;
      setFieldError: SetFieldError<ExpenseField>;
      setApiError:   React.Dispatch<React.SetStateAction<string>>;
    }
  ) => {
    e.preventDefault();
    let valid = true;

    const titleV = validateTitle(title);
    if (!titleV.valid) { setFieldError("title",  titleV.message);  valid = false; }

    const amountV = validateAmount(totalAmount, maxAmount);
    if (!amountV.valid) { setFieldError("amount", amountV.message); valid = false; }

    const dateV = validateDate(date);
    if (!dateV.valid) { setFieldError("date",   dateV.message);   valid = false; }

    if (!categoryId)         { setFieldError("category", "Select a category");              valid = false; }
    if (!paidBy)             { setFieldError("paidBy",   "Select who paid");                valid = false; }
    if (splits.length === 0) { setFieldError("splits",   "Add at least one split");         valid = false; }
    else if (!splitValid)    { setFieldError("splits",   "Split amounts must equal total");  valid = false; }

    if (!valid) return;

    try {
      await createExpense({
        groupId,
        title: title.trim(),
        amount: totalAmount,
        date,
        category: categoryId,
        paymentType,
        paidBy,
        splitBetween: splits.map((s) => ({ userId: s.userId, amount: s.amount })),
      }).unwrap();
      navigate(`/groups/${groupId}`);
    } catch (error: any) {
      setApiError(error.data?.message || "Failed to create expense");
    }
  };

  return { handleSubmit, isCreating };
};

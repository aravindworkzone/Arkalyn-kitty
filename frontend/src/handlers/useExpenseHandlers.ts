import { useNavigate } from "react-router-dom";
import { useCreateExpenseMutation } from "../redux/api/expense";
import type { SplitEntry } from "../interface/expense";

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
      title, totalAmount, categoryId, paidBy,
      splits, splitValid, date, paymentType, setError,
    }: {
      title: string;
      totalAmount: number;
      categoryId: string;
      paidBy: string;
      splits: SplitEntry[];
      splitValid: boolean;
      date: string;
      paymentType: string;
      setError: React.Dispatch<React.SetStateAction<string>>;
    }
  ) => {
    setError("");
    e.preventDefault();
    if (!title.trim())       return setError("Title is required");
    if (!totalAmount)        return setError("Amount is required");
    if (!categoryId)         return setError("Select a category");
    if (!paidBy)             return setError("Select who paid");
    if (splits.length === 0) return setError("Add at least one split");
    if (!splitValid)         return setError("Split amounts must equal total amount");

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
      setError(error.data?.message || "Failed to create expense");
    }
  };

  return { handleSubmit, isCreating };
};

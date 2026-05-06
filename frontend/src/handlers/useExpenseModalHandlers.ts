import { useState } from "react";
import { useDeleteExpenseMutation } from "../redux/api/expense";
import type { Expense } from "../interface/expense";

export const useExpenseModalHandlers = (onClose: () => void) => {
  const [showRefund,  setShowRefund]  = useState(false);
  const [reason,      setReason]      = useState("");
  const [refundError, setRefundError] = useState("");

  const [deleteExpense, { isLoading: isDeleting }] = useDeleteExpenseMutation();

  const handleClose = () => {
    setShowRefund(false);
    setReason("");
    setRefundError("");
    onClose();
  };

  const handleRefund = async (expense: Expense | null, groupId: string | undefined) => {
    if (!expense || !groupId) return;
    setRefundError("");
    try {
      await deleteExpense({
        expenseId: expense._id,
        groupId,
        reason: reason.trim() || undefined,
      }).unwrap();
      handleClose();
    } catch (e: any) {
      setRefundError(e?.data?.message || "Failed to refund expense");
    }
  };

  return {
    showRefund, setShowRefund,
    reason, setReason,
    refundError, setRefundError,
    isDeleting,
    handleClose,
    handleRefund,
  };
};

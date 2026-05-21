import { useState } from "react";
import { useRemoveCreditMutation } from "../redux/api/group";
import type { GroupCredit } from "../interface/transaction";

export const useCreditModalHandlers = (onClose: () => void) => {
  const [showRemove,  setShowRemove]  = useState(false);
  const [reason,      setReason]      = useState("");
  const [removeError, setRemoveError] = useState("");

  const [removeCredit, { isLoading: isRemoving }] = useRemoveCreditMutation();

  const handleClose = () => {
    setShowRemove(false);
    setReason("");
    setRemoveError("");
    onClose();
  };

  const handleRemove = async (credit: GroupCredit | null, groupId: string | undefined) => {
    if (!credit || !groupId) return;
    setRemoveError("");
    try {
      await removeCredit({
        creditId: credit._id,
        groupId,
        reason: reason.trim() || undefined,
      }).unwrap();
      handleClose();
    } catch (e: any) {
      setRemoveError(e?.data?.message || "Failed to remove credit");
    }
  };

  return {
    showRemove, setShowRemove,
    reason, setReason,
    removeError, setRemoveError,
    isRemoving,
    handleClose,
    handleRemove,
  };
};

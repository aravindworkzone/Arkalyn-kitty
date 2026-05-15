import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useManageMemberMutation,
  useInviteMemberMutation,
  useManageAdminMutation,
  useAddContributionMutation,
  useSettlementMutation,
  useDeleteGroupMutation,
  useLeaveGroupMutation,
  useApproveLeaveMutation,
  useRejectLeaveMutation,
} from "../redux/api/group";
import { useVerifyUserMutation } from "../redux/api/user";
import { validateEmail, validateAmount, validateDescription } from "../helpers/validators";
import type { SetFieldError } from "../hooks/useFieldError";

export type AddMemberField = "searchEmail";
export type ContributionField = "myContrib";
export type ContributionDescField = "myContribDesc";
export type SettlementField = "settleAmount";
export type LeaveRequestField = "leaveSettle";

type Msg = { ok: boolean; text: string } | null;
type FoundUser = { _id: string; name: string } | null;
type DeleteTarget = { id: string; name: string } | null;

export const useGroupDetailHandlers = (groupId: string | undefined) => {
  const navigate = useNavigate();

  const [msg, setMsg] = useState<Msg>(null);

  const [verifyUser, { isLoading: isVerifying }] = useVerifyUserMutation();
  const [inviteMemberMut, { isLoading: isInvitingMember }] = useInviteMemberMutation();
  const [manageAdmin, { isLoading: isChangingRole }] = useManageAdminMutation();
  const [addContributionMut, { isLoading: isAddingContrib }] = useAddContributionMutation();
  const [settlementMut, { isLoading: isSettling }] = useSettlementMutation();
  const [deleteGroupMut, { isLoading: isDeletingGroup }] = useDeleteGroupMutation();
  const [leaveGroupMut, { isLoading: isLeavingGroup }] = useLeaveGroupMutation();
  const [removeMemberMut, { isLoading: isRemovingMember }] = useManageMemberMutation();
  const [approveLeaveMut, { isLoading: isApprovingLeave }] = useApproveLeaveMutation();
  const [rejectLeaveMut, { isLoading: isRejectingLeave }] = useRejectLeaveMutation();

  const handleVerifyUser = async (
    searchEmail: string,
    setFoundUser: React.Dispatch<React.SetStateAction<FoundUser>>,
    setFieldError: SetFieldError<AddMemberField>
  ) => {
    const emailV = validateEmail(searchEmail.trim());
    if (!emailV.valid) {
      setFieldError("searchEmail", emailV.message);
      return;
    }
    setFoundUser(null);
    setMsg(null);
    try {
      const res = await verifyUser(searchEmail.trim()).unwrap() as any;
      setFoundUser({ _id: res.user._id, name: res.user.name });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.message || "User not found" });
    }
  };

  // Adding a member to an existing group now goes through the invite flow —
  // the invitee accepts and sets their own contribution, mirroring group creation.
  const handleInviteMember = async (
    foundUser: FoundUser,
    setFoundUser: React.Dispatch<React.SetStateAction<FoundUser>>,
    setSearchEmail: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (!foundUser || !groupId) return;

    try {
      await inviteMemberMut({ groupId, invitedUser: foundUser._id }).unwrap();
      setMsg({ ok: true, text: "Invitation sent" });
      setFoundUser(null);
      setSearchEmail("");
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.error || e?.data?.message || "Failed to send invitation" });
    }
  };

  const handleChangeRole = async (
    roleMemberId: string,
    roleAction: "promote" | "demote",
    setRoleMemberId: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (!roleMemberId) {
      setMsg({ ok: false, text: "Select a member to change role" });
      return;
    }
    if (!groupId) return;
    try {
      await manageAdmin({ groupId, action: roleAction, member: roleMemberId }).unwrap();
      setMsg({
        ok: true,
        text: roleAction === "promote" ? "Promoted to Admin" : "Demoted to Member",
      });
      setRoleMemberId("");
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.error || "Failed to change role" });
    }
  };

  const handleAddContribution = async (
    myContrib: string,
    contribMemberId: string,
    setMyContrib: React.Dispatch<React.SetStateAction<string>>,
    setContribMemberId: React.Dispatch<React.SetStateAction<string>>,
    setFieldError: SetFieldError<ContributionField>,
    myContribDesc: string,
    setmyContribDesc: React.Dispatch<React.SetStateAction<string>>,
    setContribErrorDesc: SetFieldError<ContributionDescField>
  ) => {
    if (!groupId) return;

    const amtV = validateAmount(myContrib);
    if (!amtV.valid) {
      setFieldError("myContrib", amtV.message);
      return;
    }

    const decV = validateDescription(myContribDesc);
    if (!decV.valid) {
      setContribErrorDesc("myContribDesc", decV.message);
      return;
    }

    try {
      await addContributionMut({
        groupId,
        contribution: Number(myContrib),
        description: myContribDesc,
        ...(contribMemberId ? { userId: contribMemberId } : {}),
      }).unwrap();
      setMsg({ ok: true, text: "Contribution added" });
      setMyContrib("");
      setContribMemberId("");
      setmyContribDesc("");
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.error || "Failed to add contribution" });
    }
  };

  const handleSettlement = async (
    settleMemberId: string,
    settleAmount: string,
    setSettleMemberId: React.Dispatch<React.SetStateAction<string>>,
    setSettleAmount: React.Dispatch<React.SetStateAction<string>>,
    setFieldError: SetFieldError<SettlementField>,
    maxAmount?: number,
  ) => {
    if (!groupId) return;

    if (!settleMemberId) {
      setMsg({ ok: false, text: "Select a member to settle" });
      return;
    }

    // Settlement may legitimately be 0 (a member who owes/contributed nothing),
    // so we can't use validateAmount here — it rejects 0 by design.
    const amount = Number(settleAmount);
    if (settleAmount.trim() === "" || Number.isNaN(amount) || amount < 0) {
      setFieldError("settleAmount", "Enter a valid amount");
      return;
    }
    if (maxAmount !== undefined && amount > maxAmount) {
      setFieldError("settleAmount", `Amount cannot exceed ₹${maxAmount.toLocaleString("en-IN")}`);
      return;
    }

    try {
      await settlementMut({
        groupId,
        settlement: amount,
        member: settleMemberId,
      }).unwrap();
      setMsg({ ok: true, text: "Settlement completed" });
      setSettleMemberId("");
      setSettleAmount("0");
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.error || "Failed to process settlement" });
    }
  };

  const handleDeleteMember = async (
    deleteMemberTarget: DeleteTarget,
    setDeleteMemberTarget: React.Dispatch<React.SetStateAction<DeleteTarget>>,
    setDeleteMemberError: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (!deleteMemberTarget || !groupId) return;
    setDeleteMemberError("");
    try {
      await removeMemberMut({
        groupId,
        action: "remove",
        Member: deleteMemberTarget.id,
      }).unwrap();
      setDeleteMemberTarget(null);
    } catch (e: any) {
      setDeleteMemberError(
        e?.data?.error || "Failed to remove member. Ensure settlement is completed first."
      );
    }
  };

  const handleDeleteGroup = async (
    setDeleteGroupError: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (!groupId) return;
    setDeleteGroupError("");
    try {
      await deleteGroupMut(groupId).unwrap();
      navigate("/groups");
    } catch (e: any) {
      setDeleteGroupError(e?.data?.error || "Failed to delete group");
    }
  };

  // Returns "left" when the member was removed immediately (already settled),
  // "requested" when a leave request was filed for admin approval, or "error".
  const handleLeaveGroup = async (
    setLeaveGroupError: React.Dispatch<React.SetStateAction<string>>
  ): Promise<"left" | "requested" | "error"> => {
    if (!groupId) return "error";
    setLeaveGroupError("");
    try {
      const res = await leaveGroupMut(groupId).unwrap() as any;
      if (res?.data?.left) {
        navigate("/groups");
        return "left";
      }
      return "requested";
    } catch (e: any) {
      setLeaveGroupError(
        e?.data?.error || e?.data?.message || "Failed to leave group. Please try again."
      );
      return "error";
    }
  };

  const handleApproveLeave = async (
    memberId: string,
    settlementAmountReq: string,
    maxAmount: number,
    setFieldError: SetFieldError<LeaveRequestField>
  ) => {
    if (!groupId) return;
    const settlementAmount = settlementAmountReq || "0";
    let settlement = 0;
    if (maxAmount > 0) {
      const amtV = validateAmount(settlementAmount, maxAmount);
      if (!amtV.valid && settlementAmount != "0") {
        setFieldError("leaveSettle", amtV.message);
        return;
      }
      settlement = Number(settlementAmount);
    }

    try {
      await approveLeaveMut({ groupId, member: memberId, settlement }).unwrap();
      setMsg({ ok: true, text: "Leave request approved" });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.error || e?.data?.message || "Failed to approve leave request" });
    }
  };

  const handleRejectLeave = async (memberId: string) => {
    if (!groupId) return;
    try {
      await rejectLeaveMut({ groupId, member: memberId }).unwrap();
      setMsg({ ok: true, text: "Leave request rejected" });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.error || e?.data?.message || "Failed to reject leave request" });
    }
  };

  return {
    msg, setMsg,
    isVerifying, isInvitingMember, isChangingRole,
    isAddingContrib, isSettling, isDeletingGroup, isRemovingMember, isLeavingGroup,
    isApprovingLeave, isRejectingLeave,
    handleVerifyUser, handleInviteMember, handleChangeRole,
    handleAddContribution, handleSettlement, handleDeleteMember, handleDeleteGroup, handleLeaveGroup,
    handleApproveLeave, handleRejectLeave,
  };
};

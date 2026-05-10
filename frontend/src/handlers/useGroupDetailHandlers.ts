import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useManageMemberMutation,
  useManageAdminMutation,
  useAddContributionMutation,
  useSettlementMutation,
  useDeleteGroupMutation,
} from "../redux/api/group";
import { useVerifyUserMutation } from "../redux/api/user";
import { validateEmail, validateAmount, validateContribution, validateDescription } from "../helpers/validators";
import type { SetFieldError } from "../hooks/useFieldError";

export type AddMemberField = "searchEmail" | "memberContrib";
export type ContributionField = "myContrib";
export type ContributionDescField = "myContribDesc";
export type SettlementField = "settleAmount";

type Msg = { ok: boolean; text: string } | null;
type FoundUser = { _id: string; name: string } | null;
type DeleteTarget = { id: string; name: string } | null;

export const useGroupDetailHandlers = (groupId: string | undefined) => {
  const navigate = useNavigate();

  const [msg, setMsg] = useState<Msg>(null);

  const [verifyUser, { isLoading: isVerifying }] = useVerifyUserMutation();
  const [manageMember, { isLoading: isAddingMember }] = useManageMemberMutation();
  const [manageAdmin, { isLoading: isChangingRole }] = useManageAdminMutation();
  const [addContributionMut, { isLoading: isAddingContrib }] = useAddContributionMutation();
  const [settlementMut, { isLoading: isSettling }] = useSettlementMutation();
  const [deleteGroupMut, { isLoading: isDeletingGroup }] = useDeleteGroupMutation();
  const [removeMemberMut, { isLoading: isRemovingMember }] = useManageMemberMutation();

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

  const handleAddMember = async (
    foundUser: FoundUser,
    memberContrib: string,
    setFoundUser: React.Dispatch<React.SetStateAction<FoundUser>>,
    setSearchEmail: React.Dispatch<React.SetStateAction<string>>,
    setMemberContrib: React.Dispatch<React.SetStateAction<string>>,
    setFieldError: SetFieldError<AddMemberField>
  ) => {
    if (!foundUser || !groupId) return;

    const contribV = validateContribution(memberContrib);
    if (!contribV.valid) {
      setFieldError("memberContrib", contribV.message);
      return;
    }

    try {
      await manageMember({
        groupId,
        action: "add",
        Member: foundUser._id,
        contribution: Number(memberContrib) || 0,
      }).unwrap();
      setMsg({ ok: true, text: "Member added successfully" });
      setFoundUser(null);
      setSearchEmail("");
      setMemberContrib("");
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.error || "Failed to add member" });
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

    const amtV = validateAmount(settleAmount, maxAmount);
    if (!amtV.valid) {
      setFieldError("settleAmount", amtV.message);
      return;
    }

    try {
      await settlementMut({
        groupId,
        settlement: Number(settleAmount),
        member: settleMemberId,
      }).unwrap();
      setMsg({ ok: true, text: "Settlement completed" });
      setSettleMemberId("");
      setSettleAmount("");
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

  return {
    msg, setMsg,
    isVerifying, isAddingMember, isChangingRole,
    isAddingContrib, isSettling, isDeletingGroup, isRemovingMember,
    handleVerifyUser, handleAddMember, handleChangeRole,
    handleAddContribution, handleSettlement, handleDeleteMember, handleDeleteGroup,
  };
};

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

type Msg = { ok: boolean; text: string } | null;
type FoundUser = { _id: string; name: string } | null;
type DeleteTarget = { id: string; name: string } | null;

export const useGroupDetailHandlers = (groupId: string | undefined) => {
  const navigate = useNavigate();

  const [msg,     setMsg]     = useState<Msg>(null);

  const [verifyUser,         { isLoading: isVerifying }]      = useVerifyUserMutation();
  const [manageMember,       { isLoading: isAddingMember }]   = useManageMemberMutation();
  const [manageAdmin,        { isLoading: isChangingRole }]   = useManageAdminMutation();
  const [addContributionMut, { isLoading: isAddingContrib }]  = useAddContributionMutation();
  const [settlementMut,      { isLoading: isSettling }]       = useSettlementMutation();
  const [deleteGroupMut,     { isLoading: isDeletingGroup }]  = useDeleteGroupMutation();
  const [removeMemberMut,    { isLoading: isRemovingMember }] = useManageMemberMutation();

  const handleVerifyUser = async (
    searchEmail: string,
    setFoundUser: React.Dispatch<React.SetStateAction<FoundUser>>
  ) => {
    if (!searchEmail.trim()) return;
    setFoundUser(null);
    setMsg(null);
    try {
      const res = await verifyUser(searchEmail.trim()).unwrap();
      setFoundUser({ _id: res.user._id, name: res.user.name });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.message || "User not found" });
    }
  };

  const handleAddMember = async (
    foundUser: FoundUser,
    memberContrib: string,
    setFoundUser:    React.Dispatch<React.SetStateAction<FoundUser>>,
    setSearchEmail:  React.Dispatch<React.SetStateAction<string>>,
    setMemberContrib: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (!foundUser || !groupId) return;
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
    if (!roleMemberId || !groupId) return;
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
    setMyContrib:       React.Dispatch<React.SetStateAction<string>>,
    setContribMemberId: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const amount = Number(myContrib);
    if (!amount || amount <= 0 || !groupId) return;
    try {
      await addContributionMut({
        groupId,
        contribution: amount,
        ...(contribMemberId ? { userId: contribMemberId } : {}),
      }).unwrap();
      setMsg({ ok: true, text: "Contribution added" });
      setMyContrib("");
      setContribMemberId("");
    } catch (e: any) {
      setMsg({ ok: false, text: e?.data?.error || "Failed to add contribution" });
    }
  };

  const handleSettlement = async (
    settleMemberId: string,
    settleAmount: string,
    setSettleMemberId: React.Dispatch<React.SetStateAction<string>>,
    setSettleAmount:   React.Dispatch<React.SetStateAction<string>>
  ) => {
    const amount = Number(settleAmount);
    if (!settleMemberId || !amount || amount <= 0 || !groupId) return;
    try {
      await settlementMut({ groupId, settlement: amount, member: settleMemberId }).unwrap();
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
    setDeleteMemberError:  React.Dispatch<React.SetStateAction<string>>
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

import { useNavigate } from "react-router-dom";
import { useCreateGroupMutation } from "../redux/api/group";
import { useVerifyUserMutation } from "../redux/api/user";
import { validateEmail, validateGroupName } from "../helpers/validators";
import type { SetFieldError } from "../hooks/useFieldError";
import type { CreateGroupMember } from "../interface/member";

export type GroupField = "groupName" | "emailInput" | "members";

export const removeMember = (
  setMembers: React.Dispatch<React.SetStateAction<CreateGroupMember[]>>,
  id: string
) => {
  setMembers((prev) => prev.filter((m) => m._id !== id));
};

export const updateContribution = (
  setMembers: React.Dispatch<React.SetStateAction<CreateGroupMember[]>>,
  id: string,
  value: number
) => {
  setMembers((prev) =>
    prev.map((m) => (m._id === id ? { ...m, contribution: value } : m))
  );
};

export const useGroupHandlers = () => {
  const navigate = useNavigate();
  const [createGroup, { isLoading }]              = useCreateGroupMutation();
  const [verifyUser,  { isLoading: isVerifying }] = useVerifyUserMutation();

  const addMember = async (
    emailInput: string,
    members: CreateGroupMember[],
    setFieldError:  SetFieldError<GroupField>,
    setApiError:    React.Dispatch<React.SetStateAction<string>>,
    setMembers:     React.Dispatch<React.SetStateAction<CreateGroupMember[]>>,
    setEmailInput:  React.Dispatch<React.SetStateAction<string>>
  ) => {
    const email = emailInput.trim();
    const emailV = validateEmail(email);
    if (!emailV.valid) { setFieldError("emailInput", emailV.message); return; }
    if (members.some((m) => m.email === email)) {
      setFieldError("emailInput", "Member already added");
      return;
    }

    try {
      const result = await verifyUser(email).unwrap();
      const id   = (result as any)?.user?._id;
      const name = (result as any)?.user?.name;
      setMembers((prev) => [...prev, { _id: id, user: name, contribution: 0, email }]);
      setEmailInput("");
    } catch (err: any) {
      setApiError(err?.data?.message || "User not found");
    }
  };

  const handleSubmit = async (
    e: React.FormEvent,
    groupName: string,
    members: CreateGroupMember[],
    setFieldError: SetFieldError<GroupField>,
    setApiError:   React.Dispatch<React.SetStateAction<string>>
  ) => {
    e.preventDefault();
    let valid = true;

    const nameV = validateGroupName(groupName);
    if (!nameV.valid) { setFieldError("groupName", nameV.message); valid = false; }
    if (members.length === 0) { setFieldError("members", "At least one member is required"); valid = false; }
    if (!valid) return;

    try {
      await createGroup({ name: groupName.trim(), members }).unwrap();
      navigate("/groups");
    } catch (err: any) {
      setApiError(err?.data?.message || "Failed to create group");
    }
  };

  return { addMember, handleSubmit, isLoading, isVerifying };
};

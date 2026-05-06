import { useNavigate } from "react-router-dom";
import { useCreateGroupMutation } from "../redux/api/group";
import { useVerifyUserMutation } from "../redux/api/user";
import { validators } from "../helpers/Authentication";
import type { CreateGroupMember } from "../interface/member";

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
  const [createGroup, { isLoading }]            = useCreateGroupMutation();
  const [verifyUser,  { isLoading: isVerifying }] = useVerifyUserMutation();

  const addMember = async (
    emailInput: string,
    members: CreateGroupMember[],
    setError:    React.Dispatch<React.SetStateAction<string>>,
    setMembers:  React.Dispatch<React.SetStateAction<CreateGroupMember[]>>,
    setEmailInput: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const email = emailInput.trim();
    if (!email) return setError("Email is required");
    const isEmail = validators.email(email);
    if (!isEmail.valid) return setError(isEmail.message || "Invalid email format");
    if (members.some((m) => m.email === email)) return setError("Member already added");

    try {
      const result = await verifyUser(email).unwrap();
      const id   = (result as any)?.user?._id;
      const name = (result as any)?.user?.name;
      setMembers((prev) => [...prev, { _id: id, user: name, contribution: 0, email }]);
      setEmailInput("");
    } catch (err: any) {
      setError(err?.data?.message || "User not found");
    }
  };

  const handleSubmit = async (
    e: React.FormEvent,
    groupName: string,
    members: CreateGroupMember[],
    setError: React.Dispatch<React.SetStateAction<string>>
  ) => {
    e.preventDefault();
    if (!groupName.trim())    return setError("Group name is required");
    if (members.length === 0) return setError("At least one member is required");

    try {
      await createGroup({ name: groupName.trim(), members }).unwrap();
      navigate("/groups");
    } catch (err: any) {
      setError(err?.data?.message || "Failed to create group");
    }
  };

  return { addMember, handleSubmit, isLoading, isVerifying };
};

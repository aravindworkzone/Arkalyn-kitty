import { useNavigate } from "react-router-dom";
import { useGetUserGroupsQuery } from "../redux/api/user";
import Header from "../components/header";
import EmptyState from "../components/EmptyList";
import GroupCard from "../components/GroupCard";

const GroupPage = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useGetUserGroupsQuery();
  const groups = data?.j_groups || [];

  return (
    <div className="min-h-screen bg-[#080c14] ">
        <Header />
        <div className="max-w-2xl mx-auto px-5 py-8">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-cyan-500/5 blur-3xl" />
                <div className="absolute bottom-0 -right-48 w-[500px] h-[500px] rounded-full bg-indigo-500/4 blur-3xl" />
            </div>

            <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-[#f0eeff]">Groups</h1>
            <button
                onClick={() => navigate("/groups/create")}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px]
                font-medium text-violet-300 bg-violet-500/15 border border-violet-400/40
                hover:bg-violet-500/25 transition-all"
            >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="#c4b5fd" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Create Group
            </button>
            </div>

            {groups.length === 0 ? (
            <EmptyState onClick={() => navigate("/groups/create")} />
            ) : (
            <div className="flex flex-col gap-2.5">
                {groups.map((group: any) => (
                <GroupCard
                    key={group._id}
                    group={group}
                    onClick={() => navigate(`/groups/${group.displayId}`)} 
                />
                ))}
            </div>
            )}
        </div>
    </div>
  );
};

export default GroupPage;
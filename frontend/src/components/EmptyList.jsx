const EmptyState = ({ onClick }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center
    bg-white/[0.02] border border-dashed border-white/[0.08] rounded-xl">
    <span className="text-3xl mb-3">💸</span>
    <p className="text-[14px] font-medium text-white/40 mb-1.5">No groups yet</p>
    <p className="text-[12px] text-white/20 mb-5">Create a group to start pooling expenses</p>
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium
        text-violet-300 bg-violet-500/12 border border-violet-400/30 hover:bg-violet-500/20 transition-all"
    >
      + Create your first group
    </button>
  </div>
);

export default EmptyState;
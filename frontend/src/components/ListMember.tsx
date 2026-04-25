const MemberAvatars = ({ members }: { members: string[]}) => {
  const colors = [
    { bg: "#4f3d8a", text: "#c4b5fd" },
    { bg: "#1e3a5f", text: "#93c5fd" },
    { bg: "#1a3d2e", text: "#86efac" },
    { bg: "#3d1a1a", text: "#fca5a5" },
  ];
  const visible = members;
  const overflow = members.length - 4;

  return (
    <div className="flex">
      {visible.map((m, i) => (
        <div
          key={m}
          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px]
            font-semibold border-2 border-[#0a0a0f] -mr-1.5"
          style={{ background: colors[i].bg, color: colors[i].text, zIndex: 4 - i }}
        >
          {m.slice(0, 2).toUpperCase()}
        </div>
      ))}
      {overflow > 0 && (
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px]
          font-semibold border-2 border-[#0a0a0f] bg-[#1a2a3d] text-[#7dd3fc]"
          style={{ zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

export default MemberAvatars;
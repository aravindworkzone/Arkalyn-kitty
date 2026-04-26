const MemberAvatars = ({ members }: { members: string[] }) => {
  const colors = [
    { bg: "rgba(79,61,138,0.5)",  ring: "#6d4fc7", text: "#c4b5fd" },
    { bg: "rgba(30,58,95,0.5)",   ring: "#2563a8", text: "#93c5fd" },
    { bg: "rgba(26,61,46,0.5)",   ring: "#16a34a", text: "#86efac" },
    { bg: "rgba(61,26,26,0.5)",   ring: "#b91c1c", text: "#fca5a5" },
  ];

  const visible = members.slice(0, 4);
  const overflow = members.length - 4;

  return (
    <div className="flex items-center">
      {visible.map((m, i) => (
        <div
          key={m}
          className="w-6 h-6 rounded-full flex items-center justify-center
            text-[10px] font-bold -mr-2 transition-transform hover:scale-110 hover:z-10"
          style={{
            background: colors[i].bg,
            color: colors[i].text,
            border: `1.5px solid ${colors[i].ring}`,
            boxShadow: `0 0 0 1.5px #080c14`,
            zIndex: 4 - i,
          }}
        >
          {m.slice(0, 2).toUpperCase()}
        </div>
      ))}

      {overflow > 0 && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center
            text-[10px] font-bold -mr-2"
          style={{
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.35)",
            border: "1.5px solid rgba(255,255,255,0.1)",
            boxShadow: "0 0 0 1.5px #080c14",
            zIndex: 0,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

export default MemberAvatars;
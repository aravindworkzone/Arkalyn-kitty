export default function PageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
      <div className="absolute bottom-0 -right-60 w-[600px] h-[600px] rounded-full bg-violet-600/4 blur-[120px]" />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.07) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

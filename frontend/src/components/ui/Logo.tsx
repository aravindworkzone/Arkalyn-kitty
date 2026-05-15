type LogoProps = {
  variant?: "mini" | "main" | "word";
  className?: string;
  alt?: string;
};

const SRC = {
  mini: "/mini-logo.png",
  main: "/main-logo.png",
  word: "/word-logo.png",
} as const;

const Logo = ({ variant = "mini", className = "w-[26px] h-[38px]", alt = "ArkalynKitty" }: LogoProps) => (
  <img src={SRC[variant]} alt={alt} className={className} draggable={false} />
);

export default Logo;
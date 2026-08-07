type LogoProps = {
  variant?: "mini" | "main" | "word";
  className?: string;
  alt?: string;
};

const SRC = {
  mini: "/mini-logo.png",
  main: "/main-logo.png",
  lightWord: "/light-word-logo.png",
  darkWord: "/dark-word-logo.png",
} as const;

const Logo = ({ variant = "mini", className = "w-[26px] h-[38px]", alt = "ArkalynKitty" }: LogoProps) => (
  <>
    {variant === "word" ? (
      <>
      <img src={SRC["lightWord"]} alt={alt} className={`block dark:hidden ${className}`} draggable={false} />
      <img src={SRC["darkWord"]} alt={alt} className={`hidden dark:block ${className}`} draggable={false} />
      </>
    ) : (
      <img src={SRC[variant]} alt={alt} className={className} draggable={false} />
    )}
  </>
);

export default Logo;
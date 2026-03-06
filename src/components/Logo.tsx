import { Link } from "react-router-dom";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  linkTo?: string;
}

const Logo = ({ size = "md", linkTo = "/" }: LogoProps) => {
  const sizeClasses = {
    sm: { main: "text-lg", dot: "text-[0.55em]", ent: "text-[0.45em]" },
    md: { main: "text-2xl", dot: "text-[0.55em]", ent: "text-[0.45em]" },
    lg: { main: "text-3xl md:text-4xl", dot: "text-[0.55em]", ent: "text-[0.45em]" },
  };

  const s = sizeClasses[size];

  const content = (
    <span className={`font-display ${s.main} font-bold tracking-wider leading-tight inline-flex flex-col`}>
      <span className="text-gold-gradient">
        s2k
        <span className={`${s.dot} uppercase tracking-[0.15em] align-middle opacity-70 font-semibold`}>DOT</span>
        za
      </span>
      <span className={`${s.ent} uppercase tracking-[0.35em] text-gold-gradient font-semibold -mt-1`}>
        Entertainment
      </span>
    </span>
  );

  if (linkTo) {
    return <Link to={linkTo} className="inline-block">{content}</Link>;
  }
  return content;
};

export default Logo;

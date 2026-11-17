import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md border font-semibold tracking-[-0.01em] transition-colors duration-150 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:border-transparent disabled:bg-sunken disabled:text-muted [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  // 한 화면에 primary는 하나만 둔다 (DESIGN.md 색 규칙 4)
  primary: "border-transparent bg-ink text-on-ink hover:bg-ink-2",
  secondary: "border-line-strong bg-surface text-ink hover:border-ink",
  ghost: "border-transparent bg-transparent text-ink hover:bg-sunken",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-[18px] text-[15px]",
  sm: "min-h-11 px-3 text-[13px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

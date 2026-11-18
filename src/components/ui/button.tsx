import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

// 색 전환은 마우스를 올릴 때만 180ms로 한다. 꺼진 단추가 켜질 때(폼을 다 적었을 때)는 전환 없이 바로 켜진 색이 된다:
// 꺼진 회색에서 먹색으로 넘어가는 동안 단추가 여전히 꺼진 것처럼 보이지 않게 하기 위함이다.
// 꺼진 단추는 종류와 상관없이 옅은 회색 바탕에 회색 글씨이고 눌러도 움직이지 않는다(켜진 단추는 먹색 채움 또는 테두리).
const base =
  "inline-flex items-center justify-center gap-2 rounded-[10px] border font-semibold tracking-[-0.01em] transition-colors duration-0 ease-out hover:duration-180 active:translate-y-px disabled:cursor-not-allowed disabled:border-transparent disabled:bg-sunken disabled:text-muted disabled:active:translate-y-0 [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  // 한 화면에 primary는 하나만 둔다
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

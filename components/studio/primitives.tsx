import type { ButtonHTMLAttributes, ReactNode } from "react";

export const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "quiet";
  size?: "sm" | "md" | "lg";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition disabled:opacity-40 disabled:cursor-not-allowed select-none";

  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-[13px]",
    md: "h-10 px-4 text-[14px]",
    lg: "h-12 px-6 text-[15px]"
  };

  const variants: Record<string, string> = {
    primary: "bg-ink text-canvas hover:bg-[#000]",
    secondary: "bg-paper text-ink border border-line hover:border-ink/40",
    ghost: "bg-transparent text-ink hover:bg-black/5",
    quiet: "bg-transparent text-ink-3 hover:text-ink"
  };

  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.4rem] items-center justify-center rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink-3 shadow-[inset_0_-1px_0_rgba(17,17,18,0.06)]">
      {children}
    </kbd>
  );
}

export function Chip({
  children,
  active = false,
  onClick,
  className
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const interactive = Boolean(onClick);
  const Cmp = (interactive ? "button" : "span") as "button";
  return (
    <Cmp
      type={interactive ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] tracking-tight transition",
        active
          ? "border-ink bg-ink text-canvas"
          : "border-line bg-paper text-ink-2 hover:border-ink/30",
        interactive && "cursor-pointer",
        className
      )}
    >
      {children}
    </Cmp>
  );
}

export function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">
          {label}
        </span>
        {hint ? <span className="text-[11px] text-ink-4">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

export const fieldStyles =
  "w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] leading-snug text-ink placeholder:text-ink-4 outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10";

export function SectionLabel({
  number,
  title,
  trailing
}: {
  number: string;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] text-ink-4">{number}</span>
        <h2 className="font-display text-[22px] leading-none tracking-tighter text-ink">
          {title}
        </h2>
      </div>
      {trailing}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line-soft", className)} />;
}

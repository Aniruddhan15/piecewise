import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

/** Small shadcn-style primitives: cva variants, Tailwind classes, native elements. */

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const buttonStyles = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-base font-semibold no-underline transition-[background-color,box-shadow,transform] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-brand-ink shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_6px_16px_-8px_rgb(11_92_71/0.7)] hover:brightness-110",
        secondary: "border border-line bg-surface text-ink hover:border-ink-3 hover:bg-surface-2",
        ghost: "text-ink hover:bg-surface-2",
      },
      size: { md: "", sm: "min-h-11 px-3 py-1.5 text-sm", lg: "min-h-14 px-6 py-3 text-lg" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonVariants = VariantProps<typeof buttonStyles>;

export function Button({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"button"> & ButtonVariants) {
  return (
    <button type="button" className={cn(buttonStyles({ variant, size }), className)} {...props} />
  );
}

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ComponentProps<typeof Link> & ButtonVariants) {
  return <Link className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}

export function ExternalButton({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"a"> & ButtonVariants) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgb(15_29_24/0.04)] sm:p-6", className)} {...props} />
  );
}

export const inputClass =
  "w-full min-h-12 rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-2";

export function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      {children}
      {help ? <p className="text-sm text-ink-2">{help}</p> : null}
    </div>
  );
}

export function Chip({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function PageTitle({ title, intro }: { title: string; intro?: ReactNode }) {
  return (
    <header className="mb-6 space-y-2">
      <h1 className="text-3xl font-extrabold sm:text-5xl">{title}</h1>
      {intro ? <p className="max-w-2xl text-lg text-ink-2">{intro}</p> : null}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="space-y-3 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="text-ink-2">{children}</div>
    </Card>
  );
}

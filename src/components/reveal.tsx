"use client";

import { useEffect, useRef, useState, type ComponentProps, type ElementType } from "react";
import { cn } from "./ui";

/**
 * Fades and lifts its content in the first time it scrolls into view. Subtle on purpose:
 * one short movement, a small stagger via `delay`, and nothing at all for people who
 * ask their device for reduced motion.
 */
export function Reveal<T extends ElementType = "div">({
  as,
  delay = 0,
  className,
  style,
  ...props
}: { as?: T; delay?: number } & Omit<ComponentProps<T>, "as">) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no animation: show at once
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn("reveal", shown && "is-visible", className)}
      style={{ ...style, transitionDelay: shown ? `${delay}ms` : undefined }}
      {...props}
    />
  );
}

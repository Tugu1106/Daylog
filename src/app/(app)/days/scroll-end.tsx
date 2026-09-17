"use client";

import { useLayoutEffect, useRef } from "react";

/** Horizontal scroll container that starts at the right end (most recent days). */
export function ScrollEnd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);
  return (
    <div ref={ref} className={`overflow-x-auto ${className}`}>
      {children}
    </div>
  );
}

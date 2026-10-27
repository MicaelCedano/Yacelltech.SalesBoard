"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

const numberFormat = new Intl.NumberFormat("es-DO");

export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const current = useMotionValue(value);
  const formatted = useTransform(current, (latest) => numberFormat.format(Math.round(latest)));
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const animation = animate(current, value, { duration: reducedMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] });
    return () => animation.stop();
  }, [current, value, reducedMotion]);
  return <span className={className} aria-label={numberFormat.format(value)}><motion.span aria-hidden="true">{formatted}</motion.span></span>;
}

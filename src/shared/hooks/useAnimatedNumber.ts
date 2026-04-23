import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function useAnimatedNumber(value: number, duration = 700): number {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(display);
  displayRef.current = display;

  useEffect(() => {
    const start = displayRef.current;
    const target = value;
    const bothIntegers = Number.isInteger(start) && Number.isInteger(target);

    let rafId = 0;
    let startTime = 0;

    const tick = (now: number) => {
      if (startTime === 0) startTime = now;
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const next = start + (target - start) * easeOutCubic(t);
      setDisplay(bothIntegers ? Math.round(next) : next);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration]);

  return display;
}

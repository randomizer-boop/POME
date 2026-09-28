import { useEffect, useState } from 'react';

/** Animated number from 0 to target; `key` restarts the animation */
export function useCountUp(target: number, duration = 1300, key = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(0);
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const delay = setTimeout(() => { raf = requestAnimationFrame(tick); }, 120);
    return () => { clearTimeout(delay); cancelAnimationFrame(raf); };
  }, [target, duration, key]);
  return value;
}

/** Flips to true right after mount — used to animate progress bars from 0 */
export function useProgressLoad() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const id = setTimeout(() => setLoaded(true), 80); return () => clearTimeout(id); }, []);
  return loaded;
}

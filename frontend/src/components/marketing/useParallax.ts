import React from 'react';

/**
 * Moves an element at 6% of scroll depth, capped at 900px of travel, on
 * requestAnimationFrame with a passive listener. Skipped entirely under
 * reduced motion, where the CSS also pins the transform.
 */
export function useParallax<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      el.style.transform = `translateY(${Math.min(window.scrollY, 900) * 0.06}px)`;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    apply();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}

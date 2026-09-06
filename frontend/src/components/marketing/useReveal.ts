import { useEffect, useRef } from 'react';

// One IntersectionObserver for every `.reveal` block under the returned ref.
// A block gets `is-visible` when 10% of it enters the viewport (with a 10%
// bottom margin so it fires just before it is fully in view), once, and is
// then unobserved. Without IntersectionObserver (jsdom, old browsers) every
// block is shown at once.
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));

    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((t) => t.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return ref;
}

export default useReveal;

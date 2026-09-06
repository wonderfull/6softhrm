import React from 'react';

// Six illustrative events cycling through three visible slots, per the v2
// hero spec. The content is invented on purpose: a public page must never
// show a real tenant's activity.
const EVENTS = [
  { t: 'Leave approved', s: 'Priya Shah · 12 to 14 Mar · 3 days', m: 'now' },
  { t: 'Right-to-work expiring', s: 'A. Okafor · passport · 14 days', m: '2m' },
  { t: 'Timesheet submitted', s: 'Night shift · 37.5h · awaiting sign-off', m: '9m' },
  { t: 'Contract signed', s: 'M. Reyes · care assistant · e-signature', m: '14m' },
  { t: 'Training due', s: 'Moving and handling · 4 people · 30 days', m: '21m' },
  { t: 'New starter added', s: 'J. Adeyemi · from CSV import', m: '32m' },
];

const STEP_MS = 3000;

// Slot 0 to 2 are the visible stack, 3 is leaving below, 5 waits above.
function slotStyle(slot: number): React.CSSProperties {
  if (slot < 3) {
    return { transform: `translateY(${slot * 80}px) scale(1)`, opacity: 1 };
  }
  if (slot === 3) {
    return { transform: 'translateY(240px) scale(.96)', opacity: 0 };
  }
  if (slot === 5) {
    return { transform: 'translateY(-20px)', opacity: 0 };
  }
  return { opacity: 0, visibility: 'hidden' };
}

export default function HeroFeed() {
  const [head, setHead] = React.useState(0);

  React.useEffect(() => {
    const calm =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (calm) return;
    const id = window.setInterval(
      () => setHead((h) => (h + 1) % EVENTS.length),
      STEP_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="reveal-hero hidden min-[761px]:flex w-[300px] flex-col gap-3"
      style={{ animationDelay: '240ms' }}
    >
      <div className="flex items-center gap-2 px-1 text-xs text-ink-3">
        <span className="blink h-1.5 w-1.5 rounded-full bg-accent" />
        Today in the portal
      </div>
      <div className="relative h-[236px]">
        {EVENTS.map((e, i) => (
          <div
            key={e.t}
            className="feed-card absolute inset-x-0 top-0 flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow-md)]"
            style={slotStyle((i - head + EVENTS.length) % EVENTS.length)}
          >
            <span className="mt-[5px] h-2 w-2 flex-none rounded-full bg-accent" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13px] font-semibold tracking-[-0.005em] text-ink">
                {e.t}
              </span>
              <span className="text-xs text-ink-2">{e.s}</span>
            </span>
            <span className="ml-auto flex-none font-mono text-[11px] text-ink-3">
              {e.m}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

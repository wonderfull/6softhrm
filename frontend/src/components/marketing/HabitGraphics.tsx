import React from 'react';

// The three looping graphics above the habit cards. All decorative: each is
// aria-hidden, and every loop stops under calm or reduced motion.

const PANEL =
  'flex h-[200px] items-center justify-center border-b border-line p-6 [background:radial-gradient(ellipse_at_50%_100%,color-mix(in_srgb,var(--accent)_8%,transparent),transparent_70%)]';

// Cells 9, 10 and 11 fill in turn, then the approval pill pops.
const LIT = new Map([
  [9, '0s'],
  [10, '.35s'],
  [11, '.7s'],
]);

export function CalendarGraphic() {
  return (
    <div aria-hidden="true" className={PANEL}>
      <div className="flex w-[220px] flex-col gap-2.5 rounded-lg border border-line bg-surface p-3 shadow-sm">
        <div className="flex items-center justify-between text-[11px] font-semibold text-ink">
          <span>March</span>
          <span className="font-mono font-normal text-ink-3">2026</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              className={`aspect-square rounded-[3px] bg-surface-3 ${LIT.has(i) ? 'cell-on' : ''}`}
              style={LIT.has(i) ? { animationDelay: LIT.get(i) } : undefined}
            />
          ))}
        </div>
        <div className="pill-pop inline-flex h-[22px] items-center gap-1.5 self-start rounded-full bg-accent-tint px-2 text-[11px] font-semibold text-link">
          <span className="h-[5px] w-[5px] rounded-full bg-accent" />
          Approved · P. Shah · 3 days
        </div>
      </div>
    </div>
  );
}

const DOCS = [
  { t: 'Contract', s: 'Renews 2028', w: '78%', hot: false },
  { t: 'Right to work', s: '', w: '92%', hot: true },
  { t: 'DBS check', s: 'Renews 2027', w: '44%', hot: false },
];

export function DocumentsGraphic() {
  return (
    <div aria-hidden="true" className={PANEL}>
      <div className="flex w-[240px] flex-col gap-2">
        {DOCS.map((d) => (
          <div
            key={d.t}
            className="flex flex-col gap-[7px] rounded-lg border border-line bg-surface px-3 py-2.5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="whitespace-nowrap font-semibold text-ink">
                {d.t}
              </span>
              <span className="relative flex h-[18px] flex-1 justify-end">
                <span className="font-mono text-[11px] text-ink-3">{d.s}</span>
                {d.hot && (
                  <>
                    <span className="badge-warn absolute right-0 top-0 inline-flex h-[18px] items-center rounded-full px-1.5 text-[10px] font-semibold [background:var(--amber-tint)] [color:var(--amber)]">
                      Expires in 14 days
                    </span>
                    <span className="badge-sent absolute right-0 top-0 inline-flex h-[18px] items-center rounded-full bg-accent-tint px-1.5 text-[10px] font-semibold text-link">
                      Reminder sent
                    </span>
                  </>
                )}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-sm bg-surface-3">
              <div
                className={`h-full rounded-sm bg-accent ${d.hot ? 'bar-deplete' : ''}`}
                style={{ width: d.w }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const LOG = [
  { t: '14:02', m: 'consent recorded · R. Patel', d: '0s' },
  { t: '14:05', m: 'passport viewed · admin@northgate', d: '.9s' },
  { t: '14:11', m: 'retention rule applied · 3 files', d: '1.8s' },
  { t: '14:20', m: 'sponsor report filed · UKVI', d: '2.7s' },
  { t: '14:26', m: 'audit export downloaded', d: '3.6s' },
];

export function AuditLogGraphic() {
  return (
    <div aria-hidden="true" className={PANEL}>
      <div className="flex w-[250px] flex-col gap-[7px] rounded-lg border border-line bg-surface px-3.5 py-3 font-mono text-[11px] leading-[1.4] shadow-sm">
        <div className="flex justify-between border-b border-line pb-1.5 text-ink-3">
          <span>audit.log</span>
          <span>live</span>
        </div>
        {LOG.map((l) => (
          <div
            key={l.t}
            className="log-line flex gap-2.5"
            style={{ animationDelay: l.d }}
          >
            <span className="flex-none text-ink-3">{l.t}</span>
            <span className="truncate text-ink">{l.m}</span>
          </div>
        ))}
        <div className="flex gap-2.5">
          <span className="blink inline-block h-3 w-1.5 bg-accent" />
        </div>
      </div>
    </div>
  );
}

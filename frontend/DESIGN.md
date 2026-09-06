# OnsideHR design system

Visual authority for the frontend. When a screen and this file disagree, this
file wins. Source: Claude Design handoff (`design-handoff/design_handoff_onsidehr_redesign/README.md`,
gitignored); this file is the checked-in summary.

## Principles

- Trust-first. Restrained, factual, dense enough to work in. Nothing decorative.
- One accent (`#206fd6`) and it is the only fill colour. Status is text + tint, never a fill.
- One primary button per view.
- Plain copy, sentence case, no em-dashes, no claims not already on the site.

## Tokens

All colour comes from CSS custom properties in `src/styles/tokens.css`, exposed
through Tailwind (`tailwind.config.cjs`). Never write a hex in a component.

| Tailwind | var | use |
|---|---|---|
| `bg-bg` | `--bg` | page canvas |
| `bg-surface` / `-2` / `-3` | `--surface*` | cards, sidebar, inputs / hover rows, skeleton / active nav, tracks |
| `border-line` / `-2` | `--border*` | hairlines / input and secondary button borders |
| `text-ink` / `-2` / `-3` | `--text*` | primary / secondary / captions, placeholders |
| `bg-accent`, `hover:bg-accent-hover`, `bg-accent-tint` | `--accent*` | primary button, focus, selected row, avatar bg |
| `text-link` | `--link` | links, eyebrows, avatar initials |
| `text-ok bg-ok-tint` etc. | `--ok --warn --bad` (+ `-tint`) | status text and tint only |

Legacy `primary-*` classes map onto the accent vars and still compile; prefer
the semantic names in new code.

Type: `font-display` (Instrument Sans) for landing h1/h2 and app page titles;
`font-sans` (Geist) for everything else; `font-mono` (Geist Mono) for emails,
phone numbers, dates, codes. Tabular numerals are global. Fonts are self-hosted
(`public/fonts`, `src/styles/fonts.css`).

| step | classes |
|---|---|
| display-xl | `font-display text-[clamp(38px,5.5vw,64px)] leading-[1.04] tracking-[-0.022em] font-semibold` |
| display-l | `font-display text-[40px] leading-[1.1] tracking-[-0.02em] font-semibold` |
| title | `font-display text-[26px] sm:text-[28px] leading-[1.2] tracking-[-0.015em] font-semibold` |
| heading | `text-xl leading-[1.3] tracking-[-0.01em] font-semibold` |
| subheading | `text-base font-semibold` |
| body / body-s | `text-[15px]` (`text-sm` in tables) / `text-[13px]` |
| caption | `text-xs font-medium`; table headers `text-[11px] uppercase tracking-[0.06em]` |
| numeral | `text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums` |

Radius: `rounded-sm` 4 (badge, checkbox, skeleton) · `rounded-md` 6 (button,
input, nav item) · `rounded-lg` 10 (card, tile, panel, popover) · `rounded-xl` 16
(dialog, screenshot frame) · `rounded-full` (avatar, dot).

Spacing: 4px base. Inside a control 8/12; inside a card 16 (dense) or 20;
between cards 16; between page sections 24 to 32; marketing sections
`py-[clamp(48px,7vw,112px)]`.

Shadow: `shadow-sm` on cards, `shadow-md` on popovers, `shadow-lg` on dialogs
and the hero frame. Dark theme collapses them to a 1px ring automatically.

Motion: `duration-hover` 120ms (colour, opacity, press) · `duration-state`
200ms · `duration-layout` 320ms (panels, drawers, reveals) · hero entrance 600ms
once. Easing `ease-out` / `ease-in-out`; `--ease-spring` on the primary CTA only.
Reduced motion is handled in CSS (`tokens.css`, `tailwind.css`); do not branch
on it in JS.

## Components (`src/components/ui`)

- `Button` variants `primary | secondary | ghost | destructive`, sizes `sm 32 | md 36 | lg 40`, `loading` prop. Destructive is text-only and must confirm in a `Dialog`.
- `Input`, `Select`, `Textarea` with `label`, `help`, `error`; error sets `aria-invalid` and the border, the label stays neutral. `size="lg"` (40px) on sign-in and marketing only.
- `Card` with optional `title`, `description`, `action`; `dense` (16px) or `flush` (tables).
- `Badge` `tone="ok | warn | bad"` (dot + tint) or neutral (mono uppercase: roles, document types).
- `KpiTile` label / value / footnote / inline badge / `loading`. No colour prop, no icon.
- `EmptyState` dashed, icon tile, title, one sentence, at most one small secondary button.
- `Skeleton` blocks at the final shape's radius; content fades in over 200ms.
- `Table`, `Th`, `Tr` (`clickable`, `selected`), `Td`. Whole row is the target; no icon action column.

CSS classes behind them (`.btn-*`, `.form-input`, `.badge-*`, `.skeleton`,
`.card`) live in `src/styles/tailwind.css` and may be used directly in older
pages during migration.

## Shell

Sidebar rail 240px, items 32px high, `rounded-md`, icon 16px 1.5px stroke,
rest `text-ink-2`, hover `bg-surface-2`, active `bg-surface-3 text-ink
font-medium`. No accent fill or bar. Counts mono 11 `text-ink-3` right-aligned.
Top bar: page title left, search, bell, avatar. Content max width 1200 on
desktop with 24px gutters.

## Don'ts

Coloured KPI tiles · gradients · red-filled buttons · nested cards · coloured
card headers · left-border accents · icon action columns · emoji · Inter ·
`#2b8cff`, the orange scale, or any hex outside `tokens.css`.

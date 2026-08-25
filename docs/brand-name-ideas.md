# Brand name ideas — v4 (the verified `…HR` round)

**The brief, as it now stands:** 6softHRM becomes a **multi-tenant SaaS** sold to companies
and small offices. Every customer gets their own subdomain. The name should carry **HR** or
**HRM** as a suffix, be minimalistic, and — per the feedback on v2 — actually pull a crowd.

**What v4 adds over v3.** v3 was a good list built on reasoning alone. This round *checked*.
Every name below has been run against a live Nominet WHOIS lookup, a DNS delegation check and
an HR-sector web search on **20 Aug 2026**. Three things changed as a result:

1. **MusterHR is demoted from top pick.** "Muster" turns out to be crowded in UK workforce
   software specifically — see [Killed and demoted](#killed-and-demoted).
2. **The `.hr` domain is available after all.** v3 said don't bother. v3 was wrong, and this
   is the single best idea in the document — see [Decision 2](#decision-2-the-hr-domain-play).
3. **SpotOnHR is dead** (`spotonhr.com`, a OneDigital HR consultancy). Removed before it got
   onto the list.

> **Caveat on the checks.** WHOIS/DNS tells you a domain is unregistered; it does not tell you
> a name is legally clear. Nothing here replaces a UK IPO search and a solicitor. Treat this as
> "don't fall in love with a dead name", not as clearance.

---

## Decide this first: `HR`, not `HRM`

Use **HR**.

1. **It's what UK buyers type.** A small office searches "HR software", never "HRM software".
   `HRM`/`HRMS` is the dominant term in South Asia, the Middle East and textbooks — not in a
   Sheffield accountancy firm with 18 staff.
2. **`HRM` reads older, heavier, on-premise** — the opposite of "minimalistic".
3. **Two fewer characters** in every domain, wordmark, email address and tenant URL.
4. **The convention is proven in the UK**: BrightHR, CharlieHR, People HR, Breathe HR,
   Cezanne HR, Natural HR, Sage HR, RootHR, oneHR. Buyers parse `<Word>HR` instantly.

Keep `HRM` only as a defensive redirect. Both `musterhrm.co.uk` and `onsidehrm.co.uk` are
free (checked), so this costs ~£20/yr, not a decision.

**Casing:** one word, capital H-R — **OnsideHR** — with an all-lowercase domain. Avoid a space
("Onside HR") as the primary lockup; it splits your SEO and gets typed three different ways.

---

## Decision 2: the `.hr` domain play

**This is the most valuable finding in this document.** v3 told you to forget `.hr` because it's
Croatia's ccTLD and restricted. That was half-right and led to the wrong conclusion.

**The evidence:** `sense.hr` — *"#1 Rated HR Software for UK-Based Companies"* — is a UK company,
UK-built, UK-hosted, sitting on a second-level `.hr` domain. Its nameservers are
`ns1.101domain.com` / `ns2.101domain.com`, and 101domain is one of the registrars that sells a
**trustee / local-presence service** for `.hr`. So a UK HR SaaS has already done exactly this.

**Why it matters more for you than for them — multi-tenancy.** Say the tenant URLs out loud:

| Shape | Tenant URL | Syllables |
|---|---|---|
| v3 plan | `acme.onsidehr.co.uk` | 8 |
| `.hr` plan | `acme.onside.hr` | 5 |

For a product whose customers each live on a subdomain, that difference is on every login
screen, every invite email, every support call. And the `.hr` **is** the suffix — `onside.hr`
reads as "OnsideHR" with zero characters wasted. That is the most minimalistic possible
expression of this brief, and it's a genuine talking point at a trade stand.

**Availability (DNS delegation check, 20 Aug 2026).** Undelegated, so very likely free:

`muster.hr` · `onside.hr` · `cuppa.hr` · `fettle.hr` · `proper.hr` · `lanyard.hr` · `kettle.hr` · `staffroom.hr`

Already taken: `sense.hr` (the UK competitor above), `tidy.hr` (parked on Vercel).

**The honest catch — read this before you get excited.** Post-Brexit a UK company has no EU VAT
number in VIES, so you are *not* directly eligible for a second-level `.hr`. Your routes are:

- **A trustee / local-presence service** (101domain, EuroDNS, Web Solutions, EuropeID). Works —
  `sense.hr` is the proof. But the domain is held *on your behalf*. **Do not make a
  trustee-held domain the thing your customers' logins depend on** without reading the contract
  on transfer and termination. That is a supplier dependency on your most critical asset.
- **An EU entity** — e.g. an Irish subsidiary with a VIES VAT number. Clean ownership, real
  overhead. Only worth it if you were opening one anyway.
- **`.com.hr`** — third-level, open to anyone worldwide with a local contact. Cheap and safe,
  but `acme.onside.com.hr` throws away the elegance that made this idea good.

Expect roughly $97+/yr for the domain, more with trustee fees.

**Recommendation:** buy the `.co.uk` as the **primary, owned-outright** domain and run tenants
on it from day one. Acquire the `.hr` in parallel as the marketing/vanity domain. Migrate tenant
URLs onto `.hr` **only** once you've confirmed you can hold it in your own name. Best of both,
no single point of failure.

---

## The shortlist — re-ranked, with verification

All `.co.uk` domains below confirmed **available** at Nominet on 20 Aug 2026 unless stated, and
no existing HR product was found for any of them.

### 1. OnsideHR ★ best positioning
`onsidehr.co.uk` ✅ free · `onside.hr` ✅ free · `acme.onside.hr` · **"Keep everyone onside."**

Does two jobs in one word. *Onside* is warm and human — keeping your people happy — **and** it's
compliance: onside with the Home Office, onside with HMRC, onside with the ICO. That is the
entire emotional pitch of this product in six letters, and it's the only name here that sells
the fear *and* the culture at once. Football-adjacent without being laddish, easy to spell,
easy to say down the phone. *"Right to work, right side of the line."*

*Clearance work needed:* **ONSIDE (BRAND CONSULTANCY) LTD** is a live UK company (no. 12693971)
whose SIC codes include retail of software and management consultancy — different field, but a
Companies House "too like" question. There's also an "Onside" farm-management product in New
Zealand. Neither is fatal; both mean this name needs a real IPO search in classes 9 and 42
before you spend money on it.

### 2. ProperHR ★ safest strong pick
`properhr.co.uk` ✅ free · `proper.hr` ✅ free · **"HR, done proper."**

Pure British vernacular — *a proper job*, *properly sorted* — mapping straight onto the
compliance promise: your records are proper, your right-to-work checks are proper, your audit
trail would survive a visit. Seven letters, zero explanation required, strapline pre-written.

Strongest name here for the small-office end, where the buyer's actual fear is *"am I doing this
properly?"* — and the cleanest search results of any name on this list. Nothing to disambiguate
from, nothing to buy out.

*Risk:* "proper" is a common adjective, so the trade mark leans on the stylised lockup and SEO
needs work. Regionally flavoured (Northern / West Country) — a feature unless you're chasing
FTSE HR directors. Buy "properhr" and "proper-hr" variants; people will type the space.

### 3. CuppaHR ★ the crowd puller
`cuppahr.co.uk` ✅ free · `cuppa.hr` ✅ free · **"HR in the time it takes to make a cuppa."**

The name the ticket asked for. Every British workplace runs on the tea round, so it's instantly
warm, instantly national, and repeatable in a pub — and the `HR` suffix means it's never
mistaken for a beverage brand. Better than v3's KettleHR for the same reason: *cuppa* is the
**break**, the small human moment, where *kettle* is just the appliance. It also carries a real
product promise — HR admin that takes five minutes, which is precisely the small-office pitch.

`acme.cuppa.hr` is the best-sounding tenant URL in this document. Trade-stand execution is
obvious and nobody else on the floor will have it: serve actual tea.

*Risk:* the least "serious" name here — it caps how enterprise the brand can look, and a
mid-market HR director may hesitate to put it in a procurement doc. Choose it deliberately if
SMEs and small offices are the target, which the brief says they are.

### 4. LanyardHR ★ most instantly understood
`lanyardhr.co.uk` ✅ free · `lanyard.hr` ✅ free · **"From first day to last."**

The most universal object in employment: issued on day one, handed back on the last — the whole
employee lifecycle in one thing every British worker has worn. A lanyard *is* an identity
credential (badge, access, right-to-work, "are you allowed to be here"), which is literally what
this product manages. Best logo of the set — a hanging strap and clip, or just the clip. Merch
is free.

*Risk:* longest word in the top five; physical-object names feel small unless set big.

### 5. FettleHR
`fettlehr.co.uk` ✅ free · `fettle.hr` ✅ free · **"Keep your business in fine fettle."**

*In fine fettle* = in good order, in good health. Distinctive, warm, unmistakably British, and
nothing turned up in HR software — clean clearance, cheap domain. Frames HR as **the health of
the business**, a nicer story than "compliance software", and one that travels across leave,
timesheets and projects equally well.

*Risk:* a chunk of buyers under 40 won't know the idiom cold. The strapline must carry it on
first contact.

### 6. KettleHR
`kettlehr.co.uk` ✅ free · `kettle.hr` ✅ free · **"Put the kettle on."**

v3's crowd puller, kept but ranked below CuppaHR, which does the same job with a warmer word and
a built-in speed promise. Take this one only if you prefer the harder consonants or want the
object rather than the ritual.

### 7. StaffroomHR
`staffroomhr.co.uk` ✅ free · `staffroom.hr` ✅ free · **"Every company gets a room."**

Best multi-tenant metaphor available: a tenant *is* a room, the workspace switcher is a
corridor, onboarding is being shown where the kettle is. Says **staff** in the name and is warm
in a way almost no HR software manages.

*Risk:* longest lockup here; leans culture over compliance, so the sponsor-licence story must be
loud in the copy; most likely of the set to be in use somewhere in education.

### 8. ShipshapeHR — new this round
`shipshapehr.co.uk` ✅ free · **"Everything in order."**

*Shipshape and Bristol fashion.* Distinctive, British, and the idiom means exactly what a
compliance product sells: everything stowed, everything where an inspector would want it. Long,
but it earns the length.

### 9. MusterHR ▼ demoted — see below
`musterhr.co.uk` ✅ free · `muster.hr` ✅ free · **"Everyone accounted for."**

Still the best *positioning line* in this document, and *muster* is real HR vocabulary rather
than a metaphor. But the prefix has a problem v3 missed — see the next section. Domains are
free; the name is not as clear as it looks.

---

## Killed and demoted

**SpotOnHR — dead.** `spotonhr.com` is live: SpotOn HR, a OneDigital HR consulting solution.
Same sector, same suffix convention. Don't.

**MusterHR — demoted from #1 to #9.** The domains are free, but "Muster" is crowded in UK
workforce software specifically:

- **Musterd** — Thinking Software, Oxfordshire. Roll call and evacuation management that
  explicitly *"integrates with HR systems"* and with **RotaOne**, their cloud time-and-attendance
  product. UK. Adjacent to your timesheets module.
- **Computime Muster App** — UK. Time-and-attendance plus access control.

This matters more than a normal near-miss because of how "HR" is treated in trade marks: **"HR"
is descriptive and gets effectively disclaimed, so your distinctive element is the prefix
alone.** You would not be clearing "MusterHR" — you'd be clearing **"Muster"**, against two
existing UK workforce products. That is an expensive fight for a word you don't need.

Keep MusterHR only if a solicitor comes back clean. Otherwise spend the positioning line
("everyone accounted for") on a prefix nobody else is using.

**TidyHR / DayOneHR — domains gone.** `tidyhr.co.uk` and `dayonehr.co.uk` are both registered.
DayOneHR was v3's #8; drop it.

**Already-taken names carried forward from v3:** RotaHR (`rotahr.com`, live), PebbleHR /
PebbleHRM (both live), Wrenly (makes WrenHR risky), HR Sorted (makes SortedHR a bad idea).

**RootHR** (`roothr.co.uk`) — not a name conflict, but read it carefully: *"HR Software UK |
Workforce Management & UKVI Compliance."* A direct competitor already selling the exact
sponsor-licence wedge in the exact `<Word>HR` convention. So is **sense.hr**. You are entering a
contested category; the name has to work harder than the feature list.

---

## Reserve bench

Checked and free, but lost on distinctiveness or fit.

| Name | Line | Note |
|---|---|---|
| **SoundHR** | "Sound as a pound." | `soundhr.co.uk` free. British slang for reliable; slightly generic. |
| **ChuffedHR** | "Happy staff, sorted paperwork." | `chuffedhr.co.uk` free. Warmest name found; possibly too jokey. |
| **BrewHR** | "Sorted before the brew's gone cold." | `brewhr.co.uk` free. Cousin of CuppaHR; "brew" is heavily used in beer/coffee. |
| **TallyHR** | "Everyone counted." | Tally is a giant accounting brand in India. |
| **BadgeHR** | "Who's who, and who's cleared." | Strong logo, close cousin of LanyardHR. |
| **BooksHR** | "Everyone on the books." | Best compliance idiom; "OnTheBooksHR" is too long a lockup. |
| **SnugHR** | "HR for the small firm." | A *snug* is the small room in a pub. Charming, maybe signals too small. |
| **RollcallHR** | "Names, faces, paperwork." | Legible, slightly school-ish. |
| **SlateHR** | "A clean slate for every hire." | Handsome and minimal; "Slate" is heavily used generally. |
| **FrontDeskHR** | "The first desk everyone meets." | Clear and safe; low distinctiveness. |
| **BrollyHR** | "Cover, whatever the weather." | **Avoid** — "umbrella company" is a loaded term in UK employment. |
| **InPostHR** | "Everyone in post, everything in order." | Collides with the InPost parcel lockers. |
| **ClockOnHR** | "From clocking on to signing off." | Reads as time-and-attendance only. |

---

## Recommendation

**Pick OnsideHR**, subject to the IPO search coming back clean. It carries warmth and compliance
in a single word, it's short, `onside.hr` gives you the best tenant URL in this document
(`acme.onside.hr`), and it stretches from a 6-person office to a 600-person employer without
changing register. Budget a few hundred pounds for a proper clearance search first — the
Companies House and New Zealand hits are the only thing between you and this name.

**If you don't want to spend on clearance: ProperHR.** It's the cleanest set of search results
here, needs no explanation to a UK buyer, and "HR, done proper" is already the strapline. This
is the low-risk answer and it is genuinely good — not a consolation prize.

**If the goal is to be talked about: CuppaHR.** It's the crowd puller the ticket asked for, it's
perfect for small offices, `acme.cuppa.hr` is delightful, and it will out-perform every serious
name here at a trade stand. It also has the lowest ceiling — choose it deliberately, not by
accident.

Fallbacks in order: **LanyardHR**, **FettleHR**.

Whichever you pick: buy the `.co.uk` **and** the bare `.uk` (a squatter buys the `.uk` to ride
your brand — `musterhr.uk` and `onsidehr.uk` are both free), plus the `HRM` variant as a
redirect, then start the `.hr` conversation with a registrar.

---

## Before committing

1. **Companies House** — availability plus the "same as" / "too like" rules.
2. **UK IPO search**, classes 9 (software) and 42 (SaaS); add 35 if HR consultancy is ever on
   the roadmap. **Search the prefix alone, not the prefix+HR** — "HR" is descriptive and will be
   disclaimed, so any existing HR-sector mark on the bare prefix blocks you. This is exactly
   what demoted MusterHR.
3. **Domains** — `.co.uk` + bare `.uk` + `HRM` redirect. `.hr` per [Decision 2](#decision-2-the-hr-domain-play).
4. **Nominet dispute exposure** — check nobody is already trading under the prefix in HR.
5. **The phone test** — say it to someone outside tech and have them spell it back.
   *OnsideHR* and *CuppaHR* pass cleanly; *ProperHR* gets typed as "Proper HR" (buy both);
   *FettleHR* gets misheard as "Fettel".
6. **The tenant test** — say the full customer URL out loud. "acme dot onside dot h-r" is five
   syllables and fine. "acme dot staffroom h-r dot co dot uk" is not.

---

## Multi-tenant naming mechanics

Decisions the name forces, worth settling at the same time:

- **Tenant slug is customer-visible and permanent.** Lowercase `[a-z0-9-]`, 3–30 chars, and
  changing it later breaks every bookmark and invite link — plan a redirect from day one.
- **Reserve a slug blocklist** before the first signup: `www`, `api`, `app`, `admin`, `mail`,
  `status`, `help`, `billing`, `support`, `docs`, `blog`, `static`, `cdn`, `login`, `auth`.
- **Decide subdomain vs path now.** `acme.onside.hr` (subdomain) is better branding and gives
  cookie isolation between tenants; `onside.hr/acme` is far cheaper on TLS and DNS. Subdomains
  are the right call here, but they're the reason you need a wildcard certificate.

---

## Engineering follow-ups a rename touches

Not part of this ticket, but a rename plus tenant subdomains lands on:

- Branding strings in `frontend/index.html`, `frontend/src/components/NavBar.tsx`,
  `frontend/src/components/Footer.tsx` (including `CONTACT_EMAIL`).
- CORS whitelist in `backend/src/app.ts` — currently pinned to `6soft.co.uk` / `hrm.6soft.co.uk`;
  multi-tenant needs a wildcard-subdomain matcher, not a fixed list.
- Nginx + TLS: `acme.<brand>` needs a **wildcard** certificate, i.e. Let's Encrypt DNS-01 rather
  than the `certbot --nginx` flow in `nginx.conf`.
- Outbound email identity: `noreply@<brand>` with SPF/DKIM/DMARC re-issued for the new domain
  before any tenant onboards.
- There is still **no `Tenant` model** in `backend/prisma/schema.prisma`. Multi-tenancy is a
  plan, not an implementation — the name is the easy part.

---

## Appendix — earlier rounds

**Round 1 (rejected — "doesn't sound like HR"):** Kew · Fold · Belfry · Rightly · Terrace · Wren.

**Round 2 (rejected — needed more pull):** Muster · Lanyard · Staff Only · Staffroom ·
Right Foot · Hire Ground · On the Books, plus a first-name tier (Reg, Ivy, Wilf, Nell).

**Round 3:** the `…HR` suffix round — correct instinct, unverified. Superseded by this document,
which keeps its reasoning but corrects its two factual errors (the `.hr` restriction and the
cleanliness of "Muster").

**Still-mineable pools:** staff artifacts (Badge, Rota, Noticeboard, Timecard, Handbook,
Pigeonhole, Payslip) · rituals (Day One, Roll Call, Handover, Induction, Probation, Tea Break) ·
idioms (Onside, Right Foot, On the Books, Full Time, In Post, Fine Fettle, Shipshape) · register
words (Muster, Tally, Ledger, Roster, Headcount, Tenure) · places (Staffroom, Front Desk,
Shop Floor).

---

*Domain and sector checks performed 20 Aug 2026 via Nominet WHOIS, DNS delegation lookup and web
search. Not a legal clearance.*

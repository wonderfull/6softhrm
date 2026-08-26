# OnsideHR — DNS & email authentication checklist (P5)

Do these BEFORE the first real transactional email is sent, or leave-approval
emails land in spam and the product looks broken.

## DNS on onsidehr.co.uk
| Record | Host | Value |
|---|---|---|
| A | `@` / `www` / `app` | VPS IP |
| MX / mail | per your mailbox provider | — |

## Email authentication (SMTP sender: noreply@onsidehr.co.uk)
1. **SPF** — TXT on `@`: `v=spf1 include:<smtp-provider-spf> ~all`
2. **DKIM** — enable in the SMTP provider, publish the CNAME/TXT they give you.
3. **DMARC** — TXT on `_dmarc`: `v=DMARC1; p=quarantine; rua=mailto:dmarc@onsidehr.co.uk; fo=1`
   (start with `p=none` for a week of reports if unsure).
4. Set backend env: `SMTP_FROM_NAME=OnsideHR`, sender address on the new domain.
5. **Verify**: send the Notifications page test email to a Gmail address —
   confirm inbox placement and that "show original" reports SPF/DKIM/DMARC pass.

## Nginx / CORS
- Serve the app at `https://app.onsidehr.co.uk` (already in the backend CORS allowlist,
  plus `onsidehr.co.uk` and `www`).
- Redirect http→https; the CORS allowlist accepts https origins only.

## Legal pages shipped in-app
`/privacy`, `/terms`, `/dpa` (incl. sub-processor register), `/gdpr`.
**Have a solicitor review Terms + DPA before the first paying customer signs.**

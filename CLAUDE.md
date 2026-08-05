# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Omen Trip is the marketing/booking website for a Japan travel agency (Indonesian-owned, operating in Japan). The live site is a **single static HTML file**, `index.html`, deployed as-is via GitHub Pages (custom domain `omentrip.com`, set via `CNAME`). There is no build step, no package manager, no framework, and no server-side code. The repo also contains `premium.html`, a separate, deliberately unlinked preview of a redesigned landing page (see below).

## Repository layout

- `index.html` — the whole live site: all CSS (in a `<style>` block in `<head>`), all markup, and all JS (in a `<script>` block at the end of `<body>`).
- `premium.html` — a standalone redesign preview, **not linked from `index.html` and not part of the live site's navigation**. Kept out of search indexing via `robots.txt` and its own `<meta name="robots" content="noindex, nofollow">`. Unlike `index.html`, it's a single-scroll landing page (no `showPage`/multi-step booking form) with its own inline `setLang`/`reserve`/`toggleFaq` JS, and it references images via **relative paths into `premium-assets/`** rather than the `raw.githubusercontent.com` convention below. Treat it as an isolated file — don't assume changes to `index.html` conventions apply here or vice versa.
- `premium-assets/` — `.webp` images used only by `premium.html`.
- `apps-script/` — source-only copy of the Google Apps Script webhook that receives bookings (`booking-webhook.gs`) plus its deploy/troubleshooting guide (`README.md`). **Nothing here executes on the live site** — the running copy lives in the owner's Google account (`japan@omentrip.com`); this is version control for it. See "Booking → Google Sheets" below.
- `*.jpg` / `*.jpeg` / `*.JPG` / `*.png` — trip photos referenced by `index.html`, stored at the repo root.
- `Omen-Trip-Company-Profile.pdf` — a static company profile document, linked directly from the site.
- `CNAME` — GitHub Pages custom domain config (`omentrip.com`).
- `sitemap.xml` — SEO sitemap for the anchor-based sections on the home page.
- `robots.txt` — allows crawling of the live site but disallows `/premium.html`, `/premium-assets/`, and `/apps-script/`.

Apart from `premium-assets/` and `apps-script/`, there is no `src/`, no shared `assets/` folder for the live site, and no config files — everything lives flat at the repo root.

## Development workflow

There is no build, lint, or test tooling in this repo. To work on the site:

- Edit `index.html` (or `premium.html`) directly.
- Preview by opening the file in a browser, or serving the directory (e.g. `python3 -m http.server`) since some behavior (e.g. relative paths in `premium.html`) should be checked over `http://`, not `file://`.
- Deployment is automatic: pushing to the branch GitHub Pages is configured against publishes the live site at `omentrip.com`. There is no CI/build pipeline — what's committed is what ships. `premium.html` deploys the same way but stays reachable only by direct URL (it's noindexed and unlinked, not access-controlled).

## Important convention: image URLs are absolute, not relative (index.html only)

Even though the image files live in this same repo, `index.html` references them via **absolute `raw.githubusercontent.com` URLs**, e.g.:

```
https://raw.githubusercontent.com/Nasuryou/omen-trip/main/Shirakawa%206.jpg
```

not relative paths like `Shirakawa 6.jpg`. When adding or renaming images used by `index.html`, update these URLs (and URL-encode spaces as `%20`) rather than switching to relative paths — that's the existing pattern throughout the file, for both `<img src>` and inline `background:url(...)` CSS. (This convention doesn't apply to `premium.html`, which uses relative `premium-assets/...` paths.)

## Page architecture (single-page app via show/hide, not routing)

The site behaves like a multi-page app but is really one document with several `<div class="page" id="page-*">` blocks that are toggled with CSS (`display:none` / `.active`). There is no router and no URL-based navigation — `showPage(name)` in the inline `<script>` just swaps which `.page` element is visible and scrolls to top:

- `page-home` — the landing page: hero, inclusions strip, about, packages grid, "how to book" steps, a teaser for the trip photo/video access feature, team, and the booking form.
- `page-winter`, `page-hokkaido`, `page-private` — detail pages for each tour package (hero, photo gallery, destinations, itinerary timeline, departure city options, sticky price sidebar).
- `page-galeri` — lets a past customer look up their trip's Google Drive photo/video folder by departure date (see "Trip photo/video access" below).

Navigation between these is done via `onclick="showPage('winter')"` etc., not `<a href>`. The `hokkaido` detail page additionally has season tabs (`switchSeason('spring'|'summer'|'autumn'|'winter')`) that toggle `.season-content` blocks (`#sc-spring`, `#sc-summer`, ...).

## Bilingual content (ID/EN), not i18n library

Every user-facing string that needs translation is duplicated inline as `data-id="..."` (Indonesian) and `data-en="..."` (English) attributes on the element, with the Indonesian text also present as the element's default `innerHTML`. `setLang(l)` iterates `[data-${l}]` elements and replaces their `innerHTML` with the attribute value. When adding new copy, follow this pattern — add both `data-id` and `data-en` attributes rather than introducing a new translation mechanism. HTML is allowed inside these attributes (e.g. `<br>`, `<em>`, `<strong>`), so escape `&amp;` etc. accordingly.

## Package/pricing data and the booking flow

Package data (name, duration, price, currency, deposit %) lives in a single JS object, `CFG.paket`, near the top of the inline `<script>` (alongside `CFG.wa`, `CFG.email`, `CFG.emailjs`, and `CFG.sheetsWebhook` — see below). The multi-step booking form (`#booking-card`) is driven by:

- `pickPkg(id)` — select a package (looks it up in `CFG.paket`).
- `goStep(n)` — advance/validate the 4-step form (package → personal info → deposit payment info → done), toggling `.form-sec` / `.fs` (step indicator) elements.
- `renderSum()` / `fmt()` / `fmtDP()` — compute and render the order summary and deposit amount (JPY prices formatted `ja-JP`, IDR prices formatted `id-ID`).
- `kirimWA()` — the submit action for step 3. It builds a formatted order message, fires two best-effort side notifications — `kirimSheet()` and `kirimEmail()` (EmailJS, via `CFG.emailjs.{serviceId,templateId,publicKey}`, guarded by a check that the public key isn't still the `"YOUR_EMAILJS_PUBLIC_KEY"` placeholder) — and only *then* opens `wa.me/<CFG.wa>?text=...` so the customer confirms the booking directly with the team. **Keep that order**: on mobile, opening the `wa.me` link backgrounds the tab and can cancel a request that hasn't left yet. Both notifications are fire-and-forget — errors are only `console.error`'d, never surfaced to the user, and WhatsApp remains the real confirmation channel; there is still no real backend/database.
- `tanyaWA(paket)` — same pattern as `kirimWA` but simpler: just a "ask about this package" WhatsApp deep link from a detail page sidebar (no email/sheet logging).

If you change a package's price or name, update it in `CFG.paket` (used by the booking form) **and** in the corresponding hardcoded display copy in the packages grid / detail page / sidebar — these are not currently derived from a single source of truth.

## Booking → Google Sheets (`kirimSheet` + `CFG.sheetsWebhook`)

`kirimSheet()` POSTs the order as JSON to `CFG.sheetsWebhook`, a Google Apps Script web app that writes it into **two** spreadsheets owned by `japan@omentrip.com`: `Customer_Recap_Data` (sheet `Data Tamu & Pembayaran` — the working recap) and `Omen Trip - Data Pesanan` (sheet `Bookings` — the raw log). One deployment, two destinations; the script's source is checked in at `apps-script/booking-webhook.gs`.

Two rules keep this working — both have broken it in the past:

- **The payload is a superset, on purpose.** It carries raw values (`jumlah`, `hargaSatuan`, `mataUang`, `tanggalISO`, `totalAngka`, `dpAngka`) *and* pre-formatted display strings (`tanggal`, `total`, `dp`). The recap sheet needs real numbers and dates; the `Bookings` log stores the formatted text verbatim. Adding a field is safe; **renaming or removing one silently blanks the matching spreadsheet columns**, because the script reads by field name and never sees an error.
- **Redeploying must reuse the existing deployment.** In Apps Script, `Deploy → Manage deployments → ✏️ Edit → Version: New version` keeps the same `/exec` URL. Choosing `New deployment` mints a *new* URL and silently orphans the one in `CFG.sheetsWebhook`. Access must be **"Anyone"**, not "Anyone with a Google account".

The request is sent via `navigator.sendBeacon` (with a `fetch(..., {mode:'no-cors', keepalive:true})` fallback) so it survives the tab being backgrounded by the WhatsApp hand-off. `no-cors`/beacon means the response is unreadable by design — **failures are invisible in the browser**. To verify a change actually lands, check the Apps Script **Executions** log, not the browser console. `apps-script/README.md` has the full deploy and troubleshooting checklist.

## Trip photo/video access (`page-galeri`)

Customers receive their trip photos/videos as a Google Drive folder, shared one folder per departure date (never two different packages depart the same date, so date alone is a unique key). Rather than hardcoding every date→folder link in `index.html` (which would expose the full list to anyone viewing page source), the lookup goes through a small external Google Apps Script "web app" whose URL lives in `CFG.driveLookup`:

- The site owner maintains a Google Sheet (one row per departure date, columns: date, Drive folder link) and a bound Apps Script `doGet(e)` that reads `e.parameter.tanggal` (an ISO `YYYY-MM-DD` string) and returns `{found, link}` as JSON — only the one matching link, never the full list. That script is not part of this repo; it lives in the owner's Google account.
- `cariGaleri()` (in `page-galeri`) reads the `#galeri-tgl` date input, calls `CFG.driveLookup?tanggal=...`, and renders a loading/found/not-found state into `#galeri-result`. It's guarded the same way as `CFG.emailjs`: if `CFG.driveLookup` is still the `"PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE"` placeholder, it shows a "service not active yet, contact us on WhatsApp" message instead of fetching.
- Any returned link is validated (`/^https:\/\//`) and HTML-escaped via `escapeHtml()` before being rendered, and a `waGaleri()` WhatsApp fallback is always shown alongside the form.
- Entry points into `page-galeri`: a teaser section on `page-home` (`#galeri-akses`) and a footer link, both calling `showPage('galeri')`.

## Icons

SVG icons are defined once as `<symbol id="i-*">` inside a hidden `<svg>` at the top of `<body>`, then reused elsewhere via `<svg><use href="#i-name"/></svg>`. Add new icons the same way rather than inlining full `<svg>` markup at each use site. Emoji are also used directly as icons in several places (inclusions strip, contact items, team avatars).

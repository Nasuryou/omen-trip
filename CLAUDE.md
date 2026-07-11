# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Omen Trip is the marketing/booking website for a Japan travel agency (Indonesian-owned, operating in Japan). The entire site is a **single static HTML file**, `index.html`, deployed as-is via GitHub Pages (custom domain `omentrip.com`, set via `CNAME`). There is no build step, no package manager, no framework, and no server-side code.

## Repository layout

- `index.html` — the whole site: all CSS (in a `<style>` block in `<head>`), all markup, and all JS (in a `<script>` block at the end of `<body>`).
- `*.jpg` / `*.jpeg` / `*.JPG` / `*.png` — trip photos referenced by the page, stored at the repo root.
- `CNAME` — GitHub Pages custom domain config (`omentrip.com`).
- `sitemap.xml` — SEO sitemap for the anchor-based sections on the home page.

There is no `src/`, no `assets/` folder, no config files — everything lives flat at the repo root.

## Development workflow

There is no build, lint, or test tooling in this repo. To work on the site:

- Edit `index.html` directly.
- Preview by opening `index.html` in a browser, or serving the directory (e.g. `python3 -m http.server`) since some behavior (e.g. relative paths) should be checked over `http://`, not `file://`.
- Deployment is automatic: pushing to the branch GitHub Pages is configured against publishes the live site at `omentrip.com`. There is no CI/build pipeline — what's committed is what ships.

## Important convention: image URLs are absolute, not relative

Even though the image files live in this same repo, `index.html` references them via **absolute `raw.githubusercontent.com` URLs**, e.g.:

```
https://raw.githubusercontent.com/Nasuryou/omen-trip/main/Shirakawa%206.jpg
```

not relative paths like `Shirakawa 6.jpg`. When adding or renaming images, update these URLs (and URL-encode spaces as `%20`) rather than switching to relative paths — that's the existing pattern throughout the file, for both `<img src>` and inline `background:url(...)` CSS.

## Page architecture (single-page app via show/hide, not routing)

The site behaves like a multi-page app but is really one document with several `<div class="page" id="page-*">` blocks that are toggled with CSS (`display:none` / `.active`). There is no router and no URL-based navigation — `showPage(name)` in the inline `<script>` just swaps which `.page` element is visible and scrolls to top:

- `page-home` — the landing page: hero, inclusions strip, about, packages grid, "how to book" steps, team, and the booking form.
- `page-winter`, `page-hokkaido`, `page-private` — detail pages for each tour package (hero, photo gallery, destinations, itinerary timeline, departure city options, sticky price sidebar).

Navigation between these is done via `onclick="showPage('winter')"` etc., not `<a href>`. The `hokkaido` detail page additionally has season tabs (`switchSeason('spring'|'summer'|'autumn'|'winter')`) that toggle `.season-content` blocks (`#sc-spring`, `#sc-summer`, ...).

## Bilingual content (ID/EN), not i18n library

Every user-facing string that needs translation is duplicated inline as `data-id="..."` (Indonesian) and `data-en="..."` (English) attributes on the element, with the Indonesian text also present as the element's default `innerHTML`. `setLang(l)` iterates `[data-${l}]` elements and replaces their `innerHTML` with the attribute value. When adding new copy, follow this pattern — add both `data-id` and `data-en` attributes rather than introducing a new translation mechanism. HTML is allowed inside these attributes (e.g. `<br>`, `<em>`, `<strong>`), so escape `&amp;` etc. accordingly.

## Package/pricing data and the booking flow

Package data (name, duration, price, currency, deposit %) lives in a single JS object, `CFG.paket`, near the top of the inline `<script>`. The multi-step booking form (`#booking-card`) is driven by:

- `pickPkg(id)` — select a package (looks it up in `CFG.paket`).
- `goStep(n)` — advance/validate the 4-step form (package → personal info → deposit payment info → done), toggling `.form-sec` / `.fs` (step indicator) elements.
- `renderSum()` / `fmt()` / `fmtDP()` — compute and render the order summary and deposit amount (JPY prices formatted `ja-JP`, IDR prices formatted `id-ID`).
- `kirimWA()` — builds a formatted order message and opens `wa.me/<CFG.wa>?text=...` (WhatsApp) to complete the booking; there is no backend/API — WhatsApp is the entire submission mechanism.
- `tanyaWA(paket)` — same pattern for a simpler "ask about this package" WhatsApp deep link from a detail page sidebar.

If you change a package's price or name, update it in `CFG.paket` (used by the booking form) **and** in the corresponding hardcoded display copy in the packages grid / detail page / sidebar — these are not currently derived from a single source of truth.

## Icons

SVG icons are defined once as `<symbol id="i-*">` inside a hidden `<svg>` at the top of `<body>`, then reused elsewhere via `<svg><use href="#i-name"/></svg>`. Add new icons the same way rather than inlining full `<svg>` markup at each use site. Emoji are also used directly as icons in several places (inclusions strip, contact items, team avatars).

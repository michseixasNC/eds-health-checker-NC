# EDS Health Checker — Backlog

Planned checks and features identified during a design review on 2026-06-11.
Items are ordered by implementation priority within each category.

---

## New Checks

### Accessibility
| ID | Label | Status | Notes |
|----|-------|--------|-------|
| `skip-navigation` | Skip Navigation | ✅ Done | WCAG 2.4.1 Level A — skip link presence, DOM order, target existence |
| `aria-landmarks` | ARIA Landmarks | ☐ Todo | `<main>`, `<nav>`, `<header>`, `<footer>` or ARIA role equivalents present |
| `positive-tabindex` | Tab Order | ☐ Todo | Flag `tabindex` > 0 (WCAG 2.4.3 Level A) |
| `focus-visible` | Focus Indicator | ☐ Todo | Scan `<style>` blocks for `outline: none` / `outline: 0` without `:focus-visible` compensation |
| `table-accessibility` | Table Accessibility | ☐ Todo | `<th scope>`, `<caption>` / `aria-label`, `<thead>` presence on data tables |
| `reduced-motion` | Reduced Motion | ☐ Todo | `@keyframes` in `<style>` blocks must have a `prefers-reduced-motion` counterpart |

### GEO / SEO
| ID | Label | Status | Notes |
|----|-------|--------|-------|
| `schema-quality` | Schema Quality | ☐ Todo | Required property depth: Article needs `author`+`datePublished`, FAQPage needs `mainEntity`, Organization needs `name`+`url`+`logo` |
| `same-as` | Knowledge Graph | ☐ Todo | Organization/Person schema missing `sameAs` array — entity recognition by AI systems |
| `twitter-card` | Twitter Card | ☐ Todo | `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` — OG tags are not inherited |
| `title-h1-alignment` | Title / H1 Alignment | ☐ Todo | Page `<title>` and first `<h1>` should be semantically aligned |
| `thin-content` | Content Depth | ☐ Todo | Word count in `<main>` — under ~300 words is a GEO/ranking risk |
| `content-freshness` | Content Freshness | ☐ Todo | `dateModified` in Article schema + `Last-Modified` response header presence |
| `llms-full-txt` | llms-full.txt | ☐ Todo | Check for `/llms-full.txt` at domain root (companion to existing llms.txt check) |
| `og-image-dimensions` | OG Image Size | ☐ Todo | og:image should be ≥ 1200×630px; fetch via HEAD + proxy |

### EDS-Specific
| ID | Label | Status | Notes |
|----|-------|--------|-------|
| `nav-footer` | Nav / Footer | ☐ Todo | `{origin}/nav` and `{origin}/footer` must return 200; 404 silently breaks the site shell |
| `query-index` | Query Index | ☐ Todo | `/query-index.json` present with standard fields: `path`, `title`, `description`, `image`, `lastModified` |
| `eds-boilerplate` | Boilerplate Integrity | ☐ Todo | `scripts.js`, `aem.js`, `styles/styles.css`, `styles/lazy-styles.css` must return 200 |
| `block-asset-404` | Block Asset 404 | ☐ Todo | For each block detected on page, verify `blocks/{name}/{name}.js` and `.css` return 200 |

### Infrastructure / Security
| ID | Label | Status | Notes |
|----|-------|--------|-------|
| `security-headers` | Security Headers | ☐ Todo | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` via proxy |
| `cache-headers` | Cache Headers | ☐ Todo | `Cache-Control` / `Surrogate-Control` — missing or `no-store` breaks EDS edge caching |

---

## App / Tool Features

| Feature | Status | Notes |
|---------|--------|-------|
| Filter results by status | ☐ Todo | `fail` / `warn` / `pass` tab strip above result cards — big UX win post-crawl |
| CSV export | ☐ Todo | Export crawl results as CSV alongside existing PDF |
| Shareable results URL | ☐ Todo | Encode results as base64 in `?results=` param for sharing without re-running |
| Side-by-side URL compare | ☐ Todo | Two URL inputs, parallel result columns — useful for staging vs production |
| Browser notification on crawl complete | ☐ Todo | Notifications API ping when 30-page crawl finishes |

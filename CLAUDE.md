see @AGENTS.md

# Project-Specific Context

## What This Is

EDS Health Checker by Cognizant Netcentric — a single-page AEM EDS tool that audits any AEM EDS site URL and reports a dashboard of health checks. It runs fully client-side except for a Cloudflare Worker proxy used for redirect checking.

## Architecture

### Primary Block: `health-checker`

`blocks/health-checker/health-checker.js` is the entire app entry point. It:
- Renders the app header (logo, URL input form, API key input, dark/light mode toggle)
- Orchestrates all 19 checks in parallel via `Promise.all`
- Persists URL history and PSI API key to `localStorage`
- Auto-runs if the page is opened with a `?url=` query param
- Saves run history per URL and renders sparklines for trend data

### Checks (`scripts/checks/`)

Each check file exports `run(url)` → `Promise<CheckResult>`.

```js
// CheckResult shape
{ id: string, label: string, status: 'pass'|'warn'|'fail', findings: string[], checks: string[] }
```

Current checks (19 total):

| ID | Label | File |
|----|-------|------|
| performance | Performance | performance.js — calls PSI API (optional key) |
| metadata | Metadata | metadata.js |
| blocks | Block Structure | blocks.js |
| images | Image Routing | images.js |
| redirect | Redirect Check | redirect.js |
| headings | Heading Hierarchy | headings.js |
| links | Link Health | links.js |
| fonts | Font Loading | fonts.js |
| inline-styles | Inline Styles | inline-styles.js |
| accessibility | Accessibility | accessibility.js |
| lazy-loading | Lazy Loading | lazy-loading.js |
| script-loading | Script Loading | script-loading.js |
| duplicate-ids | Duplicate IDs | duplicate-ids.js |
| structured-data | Structured Data | structured-data.js |
| ai-readiness | AI Readiness | ai-readiness.js |
| sitemap | Sitemap | sitemap.js |
| viewport | Viewport Meta | viewport.js |
| lang | Language Attribute | lang.js |
| webmcp | WebMCP | webmcp.js |

Only `performance.js` receives a second argument (the PSI API key).

### Reporting (`scripts/report/`)

- `dashboard.js` — renders result cards, progress, summary, sparklines; exports `renderCard`, `renderSummary`, `renderSparklines`, `renderLoading`, `renderError`, `updateProgress`, `setContainer`
- `pdf.js` — PDF export
- `seo-summary.js` — SEO-focused summary view

### Utilities (`scripts/lib/`)

- `history.js` — `getHistory(url)` / `saveRun(url, results)` — localStorage run history per URL
- `fetch.js` — shared fetch helper

### External Dependency

Redirect check uses a Cloudflare Worker proxy: `https://eds-hc-proxy.michelle-seixas.workers.dev/redirect-check?url=<encoded>`

## Known Quirks

- **`redirect.js` self-check**: When the checker itself is running on `*.aem.page`, checking an `aem.page` URL returns `warn` instead of `fail` (so preview testing doesn't tank the score).
- **Logo theming**: `logo.svg` (light) / `logo-dark.svg` (dark) — swapped via a `MutationObserver` on `document.documentElement[data-theme]`. `logo-dark.svg` is currently untracked in git.
- **localStorage keys**: `eds-hc-psi-api-key`, `eds-hc-url-history`, `eds-hc-theme`

## Adding a New Check

1. Create `scripts/checks/<name>.js` exporting `run(url)` returning a `CheckResult`
2. Import and register it in the `CHECKS` array in `blocks/health-checker/health-checker.js`

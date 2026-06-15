# EDS Health Checker by Cognizant Netcentric

A single-page AEM Edge Delivery Services tool that audits any EDS site URL and reports a dashboard of health check results. Runs fully client-side — no build step, no server — except for a Cloudflare Worker proxy used to bypass CORS for fetch operations.

## Live tool

**https://main--eds-health-checker-nc--michseixasnc.aem.page/**

## How to use

1. Paste any AEM EDS page URL into the input field (e.g. `https://www.yoursite.aem.live/page`)
2. Click **Run Checks** — 20 checks run in parallel and results appear as a dashboard with pass / warn / fail per check, plus findings and recommendations

**PageSpeed API key** *(optional)* — only needed for the Performance check, which calls the Google PageSpeed Insights API. Without a key the check still runs but may be rate-limited. Paste your key into the "PageSpeed API key" field; it is saved in your browser for future runs. [Get a free key](https://developers.google.com/speed/docs/insights/v5/get-started).

**Crawl Sitemap** — click instead of Run Checks to automatically audit up to 30 pages from the site's `sitemap.xml`. Results show an aggregate report across all pages. If a PSI API key is entered, this will use 1 PSI call per page (up to 30).

**Tips**
- URL history is saved in your browser — use the dropdown to re-run past checks
- Deep-link with a pre-filled URL: `?url=https://www.yoursite.aem.live`
- Toggle dark / light mode with the button in the top right

## Features

- **20 automated checks** covering performance, metadata, accessibility, SEO, fonts, images, redirects, structured data, AI-readiness, and more
- **Sitemap crawl mode** — fetch `sitemap.xml`, run all checks across up to 30 pages, and view a per-check breakdown table showing pass/warn/fail counts and which pages are failing each check
- **Run history & sparklines** — previous results per URL are stored in `localStorage` and visualised as trend sparklines on each check card
- **PSI integration** — optional PageSpeed Insights API key for the Performance check
- **Dark / light mode** — persisted to `localStorage`
- **PDF export** and **copy link** for sharing results
- **SEO & AI readiness summary panel** with category-based filtering

## Checks

| ID | Label |
|----|-------|
| performance | Performance (PSI) |
| metadata | Metadata |
| blocks | Block Structure |
| images | Image Routing |
| redirect | Redirect Check |
| headings | Heading Hierarchy |
| links | Link Health |
| fonts | Font Loading |
| inline-styles | Inline Styles |
| accessibility | Accessibility |
| skip-navigation | Skip Navigation |
| lazy-loading | Lazy Loading |
| script-loading | Script Loading |
| duplicate-ids | Duplicate IDs |
| structured-data | Structured Data |
| ai-readiness | AI Readiness |
| sitemap | Sitemap |
| viewport | Viewport Meta |
| lang | Language Attribute |
| webmcp | WebMCP |

## Local development

```sh
npm install
npx @adobe/aem-cli up
```

The dev server runs at `http://localhost:3000` with auto-reload.

## Linting

```sh
npm run lint        # check
npm run lint:fix    # auto-fix
```

## Architecture

```
blocks/health-checker/
  health-checker.js   # app entry point — form, orchestration, crawl mode
  health-checker.css  # all app styles

scripts/checks/       # 20 checks, each exports run(url) → CheckResult
scripts/report/
  dashboard.js        # single-URL results rendering
  crawl-report.js     # sitemap crawl results rendering
  pdf.js              # PDF export
  seo-summary.js      # SEO/AI summary panel
scripts/lib/
  crawl.js            # getSitemapUrls() — sitemap parsing, up to 30 URLs
  fetch.js            # fetchAndParse, fetchRaw, truncate, addCapped
  history.js          # localStorage run history per URL
```

## Adding a new check

1. Create `scripts/checks/<name>.js` exporting `run(url)` returning a `CheckResult`
2. Import and add it to the `CHECKS` array in `blocks/health-checker/health-checker.js`

```js
// CheckResult shape
{ id: string, label: string, status: 'pass'|'warn'|'fail', findings: string[], checks: string[] }
```

## Documentation

- [AEM Edge Delivery docs](https://www.aem.live/docs/)
- [Developer Tutorial](https://www.aem.live/developer/tutorial)
- [Web Performance](https://www.aem.live/developer/keeping-it-100)
- [Markup, Sections, Blocks](https://www.aem.live/developer/markup-sections-blocks)

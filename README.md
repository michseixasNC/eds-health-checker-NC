# EDS Health Checker by Cognizant Netcentric

A single-page AEM Edge Delivery Services tool that audits any EDS site URL and reports a dashboard of health check results. Runs fully client-side — no build step, no server — except for a Cloudflare Worker proxy used to bypass CORS for fetch operations.

## Features

- **19 automated checks** covering performance, metadata, accessibility, SEO, fonts, images, redirects, structured data, AI-readiness, and more
- **Sitemap crawl mode** — fetch `sitemap.xml`, run all checks across up to 30 pages, and view a per-check breakdown table showing pass/warn/fail counts and which pages are failing each check
- **Run history & sparklines** — previous results per URL are stored in `localStorage` and visualised as trend sparklines on each check card
- **PSI integration** — optional PageSpeed Insights API key for the Performance check
- **Dark / light mode** — persisted to `localStorage`
- **PDF export** and **copy link** for sharing results
- **SEO & AI readiness summary panel** with category-based filtering

## Environments

- Preview: `https://main--eds-health-checker-NC--netcentric.aem.page/`
- Live: `https://main--eds-health-checker-NC--netcentric.aem.live/`

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

scripts/checks/       # 19 checks, each exports run(url) → CheckResult
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

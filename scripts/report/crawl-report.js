/**
 * report/crawl-report.js
 *
 * Renders the sitemap crawl results. All DOM construction uses
 * createElement + textContent — no innerHTML with dynamic data.
 */

const STATUS_LABEL = { pass: 'Pass', warn: 'Warn', fail: 'Fail' };
const STATUS_ORDER = { fail: 0, warn: 1, pass: 2 };
const MAX_PAGES_SHOWN = 5;

let container = null;

/**
 * Point the crawl report at the same dashboard element used by dashboard.js.
 * @param {HTMLElement} el
 */
export function setCrawlContainer(el) {
  container = el;
}

/**
 * Show an initial loading screen while the sitemap is being fetched/crawled.
 * @param {number} total  Total pages to crawl (0 = sitemap not yet fetched).
 */
export function renderCrawlLoading(total) {
  container.innerHTML = '';
  const box = mkEl('div', 'crawl-loading');
  const msg = mkEl('p', 'crawl-loading__msg');
  msg.id = 'crawl-progress-msg';
  msg.textContent = total > 0 ? `Auditing 0 / ${total} pages…` : 'Fetching sitemap…';
  box.appendChild(msg);
  container.appendChild(box);
}

/**
 * Update the live counter during crawl.
 * @param {number} done
 * @param {number} total
 */
export function updateCrawlProgress(done, total) {
  const msg = document.getElementById('crawl-progress-msg');
  if (msg) msg.textContent = `Auditing ${done} / ${total} pages…`;
}

/**
 * Render the full crawl report: summary bar + per-check breakdown table.
 * @param {string} siteUrl
 * @param {Array<{url:string, results:Array}>} crawlResults
 * @param {Array<{id:string, label:string}>} checks  Ordered check list from CHECKS constant.
 */
export function renderCrawlReport(siteUrl, crawlResults, checks) {
  container.innerHTML = '';
  container.appendChild(buildCrawlSummary(siteUrl, crawlResults));
  container.appendChild(buildBreakdownTable(crawlResults, checks));
}

// ---------------------------------------------------------------------------
// Summary bar
// ---------------------------------------------------------------------------

function buildCrawlSummary(siteUrl, crawlResults) {
  const origin = new URL(siteUrl).origin;
  const total = crawlResults.length;

  const pageCounts = { pass: 0, warn: 0, fail: 0 };
  for (const { results } of crawlResults) {
    const hasFail = results.some((r) => r.status === 'fail');
    const hasWarn = results.some((r) => r.status === 'warn');
    const pageStatus = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';
    pageCounts[pageStatus] += 1;
  }

  const overall = pageCounts.fail > 0 ? 'fail' : pageCounts.warn > 0 ? 'warn' : 'pass';

  const section = mkEl('div', 'score-summary');

  const urlLine = mkEl('p', 'score-summary__url');
  urlLine.textContent = `Sitemap crawl — ${origin}`;
  section.appendChild(urlLine);

  const subtitle = mkEl('p', 'score-summary__pass-rate');
  subtitle.textContent = `${total} page${total !== 1 ? 's' : ''} audited`;
  section.appendChild(subtitle);

  const meta = mkEl('div', 'score-summary__meta');

  const badge = mkEl('span', `score-summary__badge status-${overall}`);
  badge.textContent = `Overall: ${STATUS_LABEL[overall]}`;
  meta.appendChild(badge);

  const statLabels = { pass: 'all pass', warn: 'with warnings', fail: 'with failures' };
  for (const [status, count] of Object.entries(pageCounts)) {
    if (count === 0) continue; // eslint-disable-line no-continue
    const pill = mkEl('span', `crawl-summary__pill status-${status}`);
    pill.textContent = `${count} ${statLabels[status]}`;
    meta.appendChild(pill);
  }

  section.appendChild(meta);
  return section;
}

// ---------------------------------------------------------------------------
// Per-check breakdown table
// ---------------------------------------------------------------------------

function buildBreakdownTable(crawlResults, checks) {
  // Aggregate per-check stats
  const stats = checks.map(({ id, label }) => {
    const counts = { pass: 0, warn: 0, fail: 0 };
    const nonPassingPages = [];

    for (const { url, results } of crawlResults) {
      const r = results.find((res) => res.id === id);
      if (!r) continue; // eslint-disable-line no-continue
      counts[r.status] += 1;
      if (r.status !== 'pass') nonPassingPages.push({ url, status: r.status });
    }

    const worst = counts.fail > 0 ? 'fail' : counts.warn > 0 ? 'warn' : 'pass';
    return {
      label,
      counts,
      nonPassingPages,
      worst,
    };
  });

  // Sort: fail → warn → pass
  stats.sort((a, b) => STATUS_ORDER[a.worst] - STATUS_ORDER[b.worst]);

  const wrapper = mkEl('div', 'crawl-table-wrapper');

  const heading = mkEl('h2', 'crawl-table__heading');
  heading.textContent = 'Per-check breakdown';
  wrapper.appendChild(heading);

  const table = document.createElement('table');
  table.className = 'crawl-table';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const text of ['Check', 'Pass', 'Warn', 'Fail', 'Status', 'Non-passing pages']) {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  for (const { label, counts, nonPassingPages, worst } of stats) {
    const row = document.createElement('tr');
    row.className = `crawl-table__row crawl-table__row--${worst}`;

    // Check name
    const nameTd = document.createElement('td');
    nameTd.className = 'crawl-table__check-name';
    nameTd.textContent = label;
    row.appendChild(nameTd);

    // Count cells
    for (const status of ['pass', 'warn', 'fail']) {
      const td = document.createElement('td');
      td.className = `crawl-table__count crawl-table__count--${status}`;
      td.textContent = counts[status];
      row.appendChild(td);
    }

    // Status badge
    const statusTd = document.createElement('td');
    const badgeEl = mkEl('span', `crawl-table__badge status-${worst}`);
    badgeEl.textContent = STATUS_LABEL[worst];
    statusTd.appendChild(badgeEl);
    row.appendChild(statusTd);

    // Non-passing pages
    const pagesTd = document.createElement('td');
    pagesTd.className = 'crawl-table__pages';
    if (nonPassingPages.length === 0) {
      pagesTd.textContent = '—';
    } else {
      const shown = nonPassingPages.slice(0, MAX_PAGES_SHOWN);
      const rest = nonPassingPages.length - shown.length;
      for (const { url, status } of shown) {
        const chip = mkEl('span', `crawl-table__page-chip crawl-table__page-chip--${status}`);
        try {
          chip.textContent = new URL(url).pathname;
        } catch {
          chip.textContent = url;
        }
        pagesTd.appendChild(chip);
      }
      if (rest > 0) {
        const more = mkEl('span', 'crawl-table__page-more');
        more.textContent = `+${rest} more`;
        pagesTd.appendChild(more);
      }
    }
    row.appendChild(pagesTd);

    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  wrapper.appendChild(table);

  return wrapper;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function mkEl(tag, className = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

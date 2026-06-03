/**
 * report/dashboard.js
 *
 * Renders the visual results dashboard. All DOM construction uses
 * createElement + textContent — no innerHTML with dynamic data.
 */

import { exportPdf } from './pdf.js';
import { buildSeoLoading, buildSeoPanel } from './seo-summary.js';

const STATUS_ICON = { pass: '✓', warn: '⚠', fail: '✕' };
const STATUS_LABEL = { pass: 'Pass', warn: 'Warn', fail: 'Fail' };

// Sparkline y positions: pass at top, fail at bottom
const SPARK_Y = { pass: 3, warn: 8, fail: 13 };
const SPARK_CLASS = { pass: 'spark-pass', warn: 'spark-warn', fail: 'spark-fail' };

let dashboard = null;

/**
 * Called by the EDS block decorate() after it creates the #dashboard element.
 * @param {HTMLElement} el
 */
export function setContainer(containerEl) {
  dashboard = containerEl;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render the full results dashboard.
 * @param {Array<{id:string, label:string, status:string, findings:string[]}>} results
 * @param {string} url  The audited URL, shown in the summary bar.
 */
export function render(results, url) {
  clear();
  dashboard.appendChild(buildSummary(results, url));
  dashboard.appendChild(buildGrid(results));
}

/**
 * Pre-render named skeleton cards, each tagged with its check id so renderCard()
 * can swap them in as checks resolve.
 * @param {{id:string, label:string}[]} checks  Ordered list of checks (matches CHECKS in main.js)
 */
export function renderLoading(checks) {
  clear();
  dashboard.appendChild(buildLoadingSummary(checks.length));

  const seoWrapper = el('div');
  seoWrapper.id = 'seo-ai-panel';
  seoWrapper.appendChild(buildSeoLoading());
  dashboard.appendChild(seoWrapper);

  const grid = el('div', 'check-grid');
  for (const { id, label } of checks) {
    const card = buildLoadingCard(label);
    card.dataset.checkId = id;
    grid.appendChild(card);
  }
  dashboard.appendChild(grid);
}

/**
 * Increment the live "X / N complete" counter shown during loading.
 * @param {number} done   Checks resolved so far.
 * @param {number} total  Total check count.
 */
export function updateProgress(done, total) {
  const counter = document.getElementById('checks-progress');
  if (counter) counter.textContent = `Running checks… ${done} / ${total}`;
}

/**
 * Replace the skeleton card for result.id with a fully rendered check card.
 * Called progressively as each check resolves.
 * @param {{id:string, label:string, status:string, findings:string[], checks?:string[]}} result
 */
export function renderCard(result) {
  const slot = dashboard.querySelector(`.check-card[data-check-id="${result.id}"]`);
  if (slot) slot.replaceWith(buildCard(result));
}

/**
 * Update the summary bar once all checks have resolved.
 * @param {Array<{id:string, label:string, status:string, findings:string[]}>} results
 * @param {string} url
 */
export function renderSummary(results, url, runCount = 0) {
  const existing = dashboard.querySelector('.score-summary');
  if (existing) existing.replaceWith(buildSummary(results, url, runCount));

  const seoWrapper = dashboard.querySelector('#seo-ai-panel');
  if (seoWrapper) seoWrapper.replaceChildren(buildSeoPanel(results, handleCategoryFilter));
}

/**
 * Inject sparkline SVGs into each check card header.
 * Called once after all checks resolve and the run has been saved to history.
 * @param {Array<{ts:number, checks:Record<string,string>}>} runs  Newest-first array from getHistory().
 */
export function renderSparklines(runs) {
  const grid = dashboard.querySelector('.check-grid');
  if (!grid || runs.length === 0) return;

  grid.querySelectorAll('.check-card[data-check-id]').forEach((card) => {
    const id = card.dataset.checkId;
    const statuses = runs
      .map((r) => r.checks[id])
      .filter(Boolean)
      .reverse(); // oldest → newest
    if (statuses.length === 0) return;
    card.querySelector('.check-card__header').appendChild(buildSparkline(statuses));
  });
}

/**
 * Show a top-level error message (e.g. invalid URL before checks run).
 * @param {string} message
 */
export function renderError(message) {
  clear();
  const p = document.createElement('p');
  p.className = 'error-message';
  p.textContent = message;
  dashboard.appendChild(p);
}

// ---------------------------------------------------------------------------
// Score summary
// ---------------------------------------------------------------------------

function buildSummary(results, url, runCount = 0) {
  const counts = tally(results);
  const overall = counts.fail > 0 ? 'fail' : counts.warn > 0 ? 'warn' : 'pass';

  const section = el('div', 'score-summary');

  // Audited URL
  const urlLine = el('p', 'score-summary__url');
  urlLine.textContent = url;
  section.appendChild(urlLine);

  // Pass-rate headline + run count
  const total = results.length;
  const passRate = el('p', 'score-summary__pass-rate');
  passRate.textContent = `${counts.pass} of ${total} checks passed`;
  section.appendChild(passRate);

  if (runCount > 0) {
    const runLine = el('p', 'score-summary__run-count');
    runLine.textContent =
      runCount === 1
        ? '1 run recorded — run again to see trend sparklines per check'
        : `${runCount} runs recorded — sparklines visible in each check card`;
    section.appendChild(runLine);
  }

  // Badge + per-status counts + export button
  const meta = el('div', 'score-summary__meta');

  const badge = el('span', `score-summary__badge score-summary__badge--interactive status-${overall}`);
  badge.textContent = `Overall: ${STATUS_LABEL[overall]}`;
  badge.title = 'Click to reset filters';
  badge.addEventListener('click', clearAllFilters);
  meta.appendChild(badge);

  for (const [status, count] of Object.entries(counts)) {
    const pill = el('button', `score-summary__count status-${status}`);
    pill.textContent = `${count} ${status}`;
    pill.setAttribute('aria-pressed', 'false');
    pill.addEventListener('click', () => toggleFilter(status, pill));
    meta.appendChild(pill);
  }

  const resetBtn = el('button', 'score-summary__reset');
  resetBtn.id = 'reset-filter-btn';
  resetBtn.textContent = 'Reset Filter';
  resetBtn.hidden = true;
  resetBtn.addEventListener('click', clearAllFilters);
  meta.appendChild(resetBtn);

  const copyBtn = el('button', 'copy-link-btn');
  copyBtn.textContent = 'Copy link';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy link';
      }, 2000);
    });
  });
  meta.appendChild(copyBtn);

  const btn = el('button', 'export-btn');
  btn.id = 'export-btn';
  btn.textContent = 'Export PDF';
  btn.addEventListener('click', () => exportPdf(results, url));
  meta.appendChild(btn);

  section.appendChild(meta);
  return section;
}

function buildLoadingSummary(total) {
  const section = el('div', 'score-summary score-summary--loading');
  section.appendChild(skeleton('score-summary__url skeleton'));
  const meta = el('div', 'score-summary__meta');
  meta.appendChild(skeleton('score-summary__badge skeleton'));
  const progress = el('span', 'score-summary__progress');
  progress.id = 'checks-progress';
  progress.textContent = `Running checks… 0 / ${total}`;
  meta.appendChild(progress);
  section.appendChild(meta);
  return section;
}

// ---------------------------------------------------------------------------
// Check card grid
// ---------------------------------------------------------------------------

function buildGrid(results) {
  const grid = el('div', 'check-grid');
  for (const r of results) grid.appendChild(buildCard(r));
  return grid;
}

function buildCard(result) {
  const card = el('div', `check-card check-card--${result.status}`);
  card.dataset.checkId = result.id;

  // Header row
  const header = el('div', 'check-card__header');

  const icon = el('span', 'check-card__icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = STATUS_ICON[result.status];

  const label = el('h2', 'check-card__label');
  label.textContent = result.label;

  const badge = el('span', `check-card__status-badge status-${result.status}`);
  badge.textContent = STATUS_LABEL[result.status];

  header.appendChild(icon);
  header.appendChild(label);
  header.appendChild(badge);
  card.appendChild(header);

  // Findings (collapsible, open by default so users see them immediately)
  if (result.findings.length > 0) {
    const details = el('details', 'check-card__findings');
    details.open = true;

    const summary = el('summary');
    summary.textContent = `${result.findings.length} finding${result.findings.length !== 1 ? 's' : ''}`;
    details.appendChild(summary);

    const list = el('ul');
    for (const text of result.findings) {
      const li = el('li');
      li.textContent = text;
      list.appendChild(li);
    }
    details.appendChild(list);
    card.appendChild(details);
  }

  // For passing cards, show what was verified (collapsed)
  if (result.status === 'pass' && result.checks?.length > 0) {
    const details = el('details', 'check-card__criteria');

    const summary = el('summary');
    summary.textContent = `${result.checks.length} criteria verified`;
    details.appendChild(summary);

    const list = el('ul');
    for (const text of result.checks) {
      const li = el('li');
      li.textContent = text;
      list.appendChild(li);
    }
    details.appendChild(list);
    card.appendChild(details);
  }

  return card;
}

function buildLoadingCard(label = '') {
  const card = el('div', 'check-card check-card--loading');
  const header = el('div', 'check-card__header');
  header.appendChild(skeleton('skeleton--icon'));
  const labelEl = el('h2', 'check-card__label');
  labelEl.textContent = label;
  header.appendChild(labelEl);
  header.appendChild(skeleton('skeleton--line skeleton--short'));
  card.appendChild(header);
  return card;
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

function toggleFilter(status, btn) {
  const grid = dashboard.querySelector('.check-grid');
  if (!grid) return;

  clearCategoryFilter();

  const isActive = btn.getAttribute('aria-pressed') === 'true';

  dashboard.querySelectorAll('.score-summary__count').forEach((p) => {
    p.setAttribute('aria-pressed', 'false');
  });

  if (isActive) {
    delete grid.dataset.filter;
  } else {
    btn.setAttribute('aria-pressed', 'true');
    grid.dataset.filter = status;
  }

  syncResetButton();
}

function handleCategoryFilter(ids) {
  const grid = dashboard.querySelector('.check-grid');
  if (!grid) return;

  dashboard.querySelectorAll('.score-summary__count').forEach((p) => {
    p.setAttribute('aria-pressed', 'false');
  });
  delete grid.dataset.filter;

  if (!ids) {
    grid.querySelectorAll('.check-card--cat-hidden').forEach((c) => {
      c.classList.remove('check-card--cat-hidden');
    });
    syncResetButton();
    return;
  }

  const idSet = new Set(ids);
  grid.querySelectorAll('.check-card[data-check-id]').forEach((card) => {
    card.classList.toggle('check-card--cat-hidden', !idSet.has(card.dataset.checkId));
  });

  grid
    .querySelector('.check-card:not(.check-card--cat-hidden)')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  syncResetButton();
}

function clearCategoryFilter() {
  dashboard.querySelectorAll('.check-card--cat-hidden').forEach((c) => {
    c.classList.remove('check-card--cat-hidden');
  });
  dashboard.querySelectorAll('[data-filter-ids][aria-pressed="true"]').forEach((t) => {
    t.setAttribute('aria-pressed', 'false');
  });
}

function clearAllFilters() {
  const grid = dashboard.querySelector('.check-grid');
  if (grid) delete grid.dataset.filter;
  clearCategoryFilter();
  dashboard.querySelectorAll('.score-summary__count').forEach((p) => {
    p.setAttribute('aria-pressed', 'false');
  });
  syncResetButton();
}

function syncResetButton() {
  const btn = document.getElementById('reset-filter-btn');
  if (!btn) return;
  const grid = dashboard.querySelector('.check-grid');
  const statusActive = grid?.dataset.filter;
  const catActive = dashboard.querySelector('[data-filter-ids][aria-pressed="true"]');
  btn.hidden = !statusActive && !catActive;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function tally(results) {
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}

function clear() {
  dashboard.innerHTML = '';
}

/** Shorthand for createElement + className. */
function el(tag, className = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/** Create a div with skeleton class(es) for the loading state. */
function skeleton(extraClass = '') {
  return el('div', `skeleton ${extraClass}`.trim());
}

/**
 * Build a small SVG sparkline for a check's run history.
 * @param {string[]} statuses  Ordered oldest→newest, length ≥ 2.
 */
function buildSparkline(statuses) {
  const STEP = 10;
  const H = 16;
  const W = statuses.length * STEP;
  const NS = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'check-card__sparkline');

  const titleEl = document.createElementNS(NS, 'title');
  titleEl.textContent = `Last ${statuses.length} runs: ${statuses.join(', ')}`;
  svg.appendChild(titleEl);

  const points = statuses.map((s, i) => `${STEP / 2 + i * STEP},${SPARK_Y[s] ?? 8}`).join(' ');
  const line = document.createElementNS(NS, 'polyline');
  line.setAttribute('points', points);
  line.setAttribute('class', 'spark-line');
  svg.appendChild(line);

  for (let i = 0; i < statuses.length; i++) {
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', STEP / 2 + i * STEP);
    circle.setAttribute('cy', SPARK_Y[statuses[i]] ?? 8);
    circle.setAttribute('r', i === statuses.length - 1 ? 4 : 2.5);
    circle.setAttribute('class', SPARK_CLASS[statuses[i]] ?? '');
    svg.appendChild(circle);
  }

  return svg;
}

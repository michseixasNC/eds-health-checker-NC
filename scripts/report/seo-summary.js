/**
 * report/seo-summary.js
 *
 * Renders the "Site Health Overview" panel above the check grid.
 * Four category tiles (Speed, SEO, Accessibility, EDS Quality) followed
 * by a full-width AI / LLM Readiness strip.
 */

import { truncate } from '../lib/fetch.js';

const STATUS_ICON = { pass: '✓', warn: '⚠', fail: '✕' };
const STATUS_RANK = { fail: 2, warn: 1, pass: 0 };
const BADGE_TEXT = { pass: 'All Good', warn: 'Needs Attention', fail: 'Issues Found' };

const SPEED_GROUP = [
  { id: 'performance', label: 'Performance (CWV)' },
  { id: 'lazy-loading', label: 'Lazy Loading' },
  { id: 'script-loading', label: 'Script Loading' },
  { id: 'fonts', label: 'Font Loading' },
  { id: 'inline-styles', label: 'Inline Styles' },
];

const SEO_GROUP = [
  { id: 'metadata', label: 'Metadata' },
  { id: 'sitemap', label: 'Sitemap' },
  { id: 'structured-data', label: 'Structured Data' },
  { id: 'headings', label: 'Heading Structure' },
];

const A11Y_GROUP = [
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'viewport', label: 'Viewport' },
  { id: 'lang', label: 'Language' },
  { id: 'links', label: 'Link Health' },
  { id: 'duplicate-ids', label: 'Duplicate IDs' },
];

const EDS_GROUP = [
  { id: 'blocks', label: 'Block Structure' },
  { id: 'images', label: 'Image Routing' },
  { id: 'redirect', label: 'URL & Redirects' },
];

const AI_GROUP = [
  { id: 'ai-readiness', label: 'llms.txt & AI Crawlers' },
  { id: 'webmcp', label: 'WebMCP Agent Tools' },
  { id: 'structured-data', label: 'Structured Data (JSON-LD)' },
  { id: 'metadata', label: 'Open Graph Tags' },
];

const TILE_CATEGORIES = [
  { title: 'Speed', group: SPEED_GROUP },
  { title: 'SEO', group: SEO_GROUP },
  { title: 'Accessibility', group: A11Y_GROUP },
  { title: 'EDS Quality', group: EDS_GROUP },
  { title: 'AI Readiness', group: AI_GROUP },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildSeoLoading() {
  const section = el('section', 'seo-ai-panel seo-ai-panel--loading');

  const heading = el('h2', 'seo-ai-panel__title');
  heading.textContent = 'Site Health Overview';

  const tiles = el('div', 'seo-ai-panel__tiles');
  for (let i = 0; i < 5; i++) tiles.appendChild(buildSkeletonTile());

  section.append(heading, tiles, buildSkeletonAiRow(AI_GROUP.length));
  return section;
}

export function buildSeoPanel(results, onCategoryFilter) {
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));

  const section = el('section', 'seo-ai-panel');
  const heading = el('h2', 'seo-ai-panel__title');
  heading.textContent = 'Site Health Overview';

  section.append(heading, buildTileGrid(byId), buildAiRow(byId));

  section.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-filter-ids]');
    if (tile) {
      const isActive = tile.getAttribute('aria-pressed') === 'true';
      section.querySelectorAll('[data-filter-ids]').forEach((t) => {
        t.setAttribute('aria-pressed', 'false');
      });
      if (!isActive) tile.setAttribute('aria-pressed', 'true');
      onCategoryFilter?.(isActive ? null : tile.dataset.filterIds.split(','));
      return;
    }
    const btn = e.target.closest('[data-scroll-to]');
    if (!btn) return;
    document
      .querySelector(`[data-check-id="${btn.dataset.scrollTo}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  return section;
}

// ---------------------------------------------------------------------------
// Tile grid
// ---------------------------------------------------------------------------

function buildTileGrid(byId) {
  const grid = el('div', 'seo-ai-panel__tiles');
  for (const { title, group } of TILE_CATEGORIES) {
    grid.appendChild(buildTile(title, group, byId));
  }
  return grid;
}

function buildTile(title, group, byId) {
  const status = worstStatus(group, byId);
  const { passing, total } = countPassing(group, byId);

  const tile = el('button', 'seo-ai-panel__tile');
  tile.dataset.filterIds = group.map((g) => g.id).join(',');
  tile.setAttribute('aria-pressed', 'false');

  const name = el('span', 'seo-ai-panel__tile-name');
  name.textContent = title;

  const badge = el('span', `seo-ai-panel__group-badge status-${status}`);
  badge.textContent = BADGE_TEXT[status];

  const count = el('span', 'seo-ai-panel__tile-count');
  count.textContent = `${passing}/${total} pass`;

  tile.append(name, badge, count);
  return tile;
}

// ---------------------------------------------------------------------------
// AI / LLM Readiness row
// ---------------------------------------------------------------------------

function buildAiRow(byId) {
  const wrap = el('div', 'seo-ai-panel__ai-row');

  const header = el('div', 'seo-ai-panel__group-header');
  const lbl = el('span', 'seo-ai-panel__group-label');
  lbl.textContent = 'AI / LLM Readiness';
  const aggStatus = worstStatus(AI_GROUP, byId);
  const badge = el('span', `seo-ai-panel__group-badge status-${aggStatus}`);
  badge.textContent = BADGE_TEXT[aggStatus];
  header.append(lbl, badge);
  wrap.appendChild(header);

  const list = el('ul', 'seo-ai-panel__list');
  for (const { id, label } of AI_GROUP) {
    const r = byId[id];
    const status = r?.status ?? 'pass';

    const item = el('li', 'seo-ai-panel__item');

    const icon = el('span', `seo-ai-panel__item-icon seo-ai-panel__item-icon--${status}`);
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = STATUS_ICON[status];

    const body = el('div', 'seo-ai-panel__item-body');
    const btn = el('button', 'seo-ai-panel__item-btn');
    btn.textContent = label;
    btn.dataset.scrollTo = id;
    body.appendChild(btn);

    if (status !== 'pass' && r?.findings?.length) {
      const hint = el('span', 'seo-ai-panel__item-hint');
      hint.textContent = truncate(r.findings[0], 80);
      body.appendChild(hint);
    }

    item.append(icon, body);
    list.appendChild(item);
  }
  wrap.appendChild(list);
  return wrap;
}

// ---------------------------------------------------------------------------
// Skeleton loading states
// ---------------------------------------------------------------------------

function buildSkeletonTile() {
  const tile = el('div', 'seo-ai-panel__tile seo-ai-panel__tile--skeleton');
  tile.append(sk('skeleton--seo-label'), sk('skeleton--tile-badge'), sk('skeleton--tile-count'));
  return tile;
}

function buildSkeletonAiRow(rowCount) {
  const wrap = el('div', 'seo-ai-panel__ai-row');
  const header = el('div', 'seo-ai-panel__group-header');
  header.append(sk('skeleton--seo-label'), sk('skeleton--seo-badge'));
  wrap.appendChild(header);
  const list = el('ul', 'seo-ai-panel__list');
  for (let i = 0; i < rowCount; i++) {
    const item = el('li', 'seo-ai-panel__item');
    item.append(sk('skeleton--seo-icon'), sk('skeleton--seo-row'));
    list.appendChild(item);
  }
  wrap.appendChild(list);
  return wrap;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function worstStatus(group, byId) {
  return group.reduce((worst, { id }) => {
    const s = byId[id]?.status ?? 'pass';
    return STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst;
  }, 'pass');
}

function countPassing(group, byId) {
  const passing = group.filter(({ id }) => (byId[id]?.status ?? 'pass') === 'pass').length;
  return { passing, total: group.length };
}

function el(tag, className = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function sk(...extra) {
  return el('div', ['skeleton', ...extra].join(' '));
}

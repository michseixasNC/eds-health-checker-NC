import { run as runAccessibility } from '../../scripts/checks/accessibility.js';
import { run as runAiReadiness } from '../../scripts/checks/ai-readiness.js';
import { run as runBlocks } from '../../scripts/checks/blocks.js';
import { run as runDuplicateIds } from '../../scripts/checks/duplicate-ids.js';
import { run as runFonts } from '../../scripts/checks/fonts.js';
import { run as runHeadings } from '../../scripts/checks/headings.js';
import { run as runImages } from '../../scripts/checks/images.js';
import { run as runInlineStyles } from '../../scripts/checks/inline-styles.js';
import { run as runLang } from '../../scripts/checks/lang.js';
import { run as runLazyLoading } from '../../scripts/checks/lazy-loading.js';
import { run as runLinks } from '../../scripts/checks/links.js';
import { run as runMetadata } from '../../scripts/checks/metadata.js';
import { run as runPerformance } from '../../scripts/checks/performance.js';
import { run as runRedirect } from '../../scripts/checks/redirect.js';
import { run as runScriptLoading } from '../../scripts/checks/script-loading.js';
import { run as runSitemap } from '../../scripts/checks/sitemap.js';
import { run as runStructuredData } from '../../scripts/checks/structured-data.js';
import { run as runViewport } from '../../scripts/checks/viewport.js';
import { run as runWebMcp } from '../../scripts/checks/webmcp.js';
import { getHistory, saveRun } from '../../scripts/lib/history.js';
import {
  renderCard,
  renderError,
  renderLoading,
  renderSparklines,
  renderSummary,
  setContainer,
  updateProgress,
} from '../../scripts/report/dashboard.js';

const CHECKS = [
  { id: 'performance', label: 'Performance', run: runPerformance },
  { id: 'metadata', label: 'Metadata', run: runMetadata },
  { id: 'blocks', label: 'Block Structure', run: runBlocks },
  { id: 'images', label: 'Image Routing', run: runImages },
  { id: 'redirect', label: 'Redirect Check', run: runRedirect },
  { id: 'headings', label: 'Heading Hierarchy', run: runHeadings },
  { id: 'links', label: 'Link Health', run: runLinks },
  { id: 'fonts', label: 'Font Loading', run: runFonts },
  { id: 'inline-styles', label: 'Inline Styles', run: runInlineStyles },
  { id: 'accessibility', label: 'Accessibility', run: runAccessibility },
  { id: 'lazy-loading', label: 'Lazy Loading', run: runLazyLoading },
  { id: 'script-loading', label: 'Script Loading', run: runScriptLoading },
  { id: 'duplicate-ids', label: 'Duplicate IDs', run: runDuplicateIds },
  { id: 'structured-data', label: 'Structured Data', run: runStructuredData },
  { id: 'ai-readiness', label: 'AI Readiness', run: runAiReadiness },
  { id: 'sitemap', label: 'Sitemap', run: runSitemap },
  { id: 'viewport', label: 'Viewport Meta', run: runViewport },
  { id: 'lang', label: 'Language Attribute', run: runLang },
  { id: 'webmcp', label: 'WebMCP', run: runWebMcp },
];

// SVG bulb icons for the dark/light mode toggle
const BULB_LIT = '<svg width="11" height="13" viewBox="0 0 11 13" aria-hidden="true" focusable="false" style="vertical-align:-2px;margin-right:4px"><circle cx="5.5" cy="5" r="4" fill="#fbbf24" stroke="#f59e0b" stroke-width="0.5"/><rect x="3.5" y="8.5" width="4" height="0.7" rx="0.35" fill="#9ca3af"/><rect x="3.8" y="9.4" width="3.4" height="0.7" rx="0.35" fill="#9ca3af"/><rect x="4.1" y="10.3" width="2.8" height="0.7" rx="0.35" fill="#9ca3af"/></svg>';
const BULB_OFF = '<svg width="11" height="13" viewBox="0 0 11 13" aria-hidden="true" focusable="false" style="vertical-align:-2px;margin-right:4px"><circle cx="5.5" cy="5" r="3.5" fill="none" stroke="currentColor" stroke-width="1"/><rect x="3.5" y="8.5" width="4" height="0.7" rx="0.35" fill="currentColor" opacity="0.5"/><rect x="3.8" y="9.4" width="3.4" height="0.7" rx="0.35" fill="currentColor" opacity="0.5"/><rect x="4.1" y="10.3" width="2.8" height="0.7" rx="0.35" fill="currentColor" opacity="0.5"/></svg>';

const LS_KEY = 'eds-hc-psi-api-key';
const LS_HISTORY_KEY = 'eds-hc-url-history';
const LS_THEME_KEY = 'eds-hc-theme';

function normalizeUrl(raw) {
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return new URL(withProtocol).href;
}

function buildHistoryOptions(datalist) {
  const hist = JSON.parse(localStorage.getItem(LS_HISTORY_KEY) ?? '[]');
  // eslint-disable-next-line no-param-reassign
  datalist.innerHTML = '';
  hist.forEach((h) => {
    const opt = document.createElement('option');
    opt.value = h;
    datalist.appendChild(opt);
  });
}

function saveToHistory(url, datalist) {
  let hist = JSON.parse(localStorage.getItem(LS_HISTORY_KEY) ?? '[]');
  hist = [url, ...hist.filter((h) => h !== url)].slice(0, 10);
  localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(hist));
  buildHistoryOptions(datalist);
}

function buildAppHeader() {
  const header = document.createElement('div');
  header.id = 'app-header';

  const heading = document.createElement('h1');
  heading.textContent = 'EDS Site Health Checker';
  header.appendChild(heading);

  const form = document.createElement('form');
  form.id = 'check-form';

  const urlInput = document.createElement('input');
  urlInput.id = 'url-input';
  urlInput.type = 'url';
  urlInput.placeholder = 'https://www.example.aem.live';
  urlInput.setAttribute('list', 'url-history');
  urlInput.autocomplete = 'off';
  urlInput.spellcheck = false;
  urlInput.required = true;
  form.appendChild(urlInput);

  const datalist = document.createElement('datalist');
  datalist.id = 'url-history';
  form.appendChild(datalist);

  const apiInput = document.createElement('input');
  apiInput.id = 'api-key-input';
  apiInput.type = 'password';
  apiInput.placeholder = 'PageSpeed API key (optional)';
  apiInput.autocomplete = 'off';
  apiInput.spellcheck = false;
  form.appendChild(apiInput);

  const submitBtn = document.createElement('button');
  submitBtn.id = 'submit-btn';
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Run Checks';
  form.appendChild(submitBtn);

  header.appendChild(form);

  const themeBtn = document.createElement('button');
  themeBtn.id = 'theme-btn';
  themeBtn.type = 'button';
  themeBtn.textContent = 'Dark mode';
  header.appendChild(themeBtn);

  return header;
}

export default function decorate(block) {
  block.textContent = '';

  const appHeader = buildAppHeader();
  block.appendChild(appHeader);

  const dashboard = document.createElement('div');
  dashboard.id = 'dashboard';
  block.appendChild(dashboard);
  setContainer(dashboard);

  const form = block.querySelector('#check-form');
  const input = block.querySelector('#url-input');
  const apiKeyInput = block.querySelector('#api-key-input');
  const submitBtn = block.querySelector('#submit-btn');
  const themeBtn = block.querySelector('#theme-btn');
  const urlHistoryDatalist = block.querySelector('#url-history');

  function applyTheme(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : '';
    themeBtn.innerHTML = dark ? `${BULB_OFF}Light mode` : `${BULB_LIT}Dark mode`;
  }

  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme !== 'dark';
    localStorage.setItem(LS_THEME_KEY, next ? 'dark' : 'light');
    applyTheme(next);
  });

  applyTheme(localStorage.getItem(LS_THEME_KEY) === 'dark');

  apiKeyInput.value = localStorage.getItem(LS_KEY) ?? '';
  buildHistoryOptions(urlHistoryDatalist);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let url;
    try {
      url = normalizeUrl(input.value.trim());
    } catch {
      renderError('Please enter a valid URL (e.g. https://www.example.aem.live).');
      return;
    }

    saveToHistory(url, urlHistoryDatalist);
    submitBtn.disabled = true;
    submitBtn.textContent = 'Running…';
    renderLoading(CHECKS);

    const apiKey = apiKeyInput.value.trim();
    if (apiKey) localStorage.setItem(LS_KEY, apiKey);
    else localStorage.removeItem(LS_KEY);

    let done = 0;
    const promises = CHECKS.map(({ id, label, run }) => {
      const p = id === 'performance' ? run(url, apiKey) : run(url);
      return p.then(
        (result) => {
          renderCard(result);
          done += 1;
          updateProgress(done, CHECKS.length);
          return result;
        },
        (reason) => {
          const fallback = {
            id,
            label,
            status: 'fail',
            findings: [`Unexpected error: ${reason?.message ?? String(reason)}`],
          };
          renderCard(fallback);
          done += 1;
          updateProgress(done, CHECKS.length);
          return fallback;
        },
      );
    });

    const results = await Promise.all(promises);
    try {
      saveRun(url, results);
      const runs = getHistory(url);
      renderSummary(results, url, runs.length);
      renderSparklines(runs);
      window.history.pushState(null, '', `?url=${encodeURIComponent(url)}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Run Checks';
    }
  });

  // Auto-run if page opened with ?url=
  const prefilledUrl = new URLSearchParams(window.location.search).get('url');
  if (prefilledUrl) {
    input.value = prefilledUrl;
    form.requestSubmit();
  }
}

/**
 * checks/metadata.js
 *
 * Audits EDS metadata block completeness on the target page.
 *
 * EDS metadata originates from a table in the source Google Doc; EDS renders
 * it as standard <meta> / <link> / <title> tags in <head>.
 *
 * Fetches and parses the page HTML directly. aem.live and aem.page are CDN-served
 * with permissive CORS headers so this works for the primary EDS audience.
 * Non-CORS-enabled URLs surface a clear finding rather than throwing.
 *
 * Status:
 *   - All required fields present and within ideal ranges → pass
 *   - Any field out of range, or og:image / canonical issues → warn
 *   - title or description absent entirely → fail
 */

import { fetchAndParse } from '../lib/fetch.js';

const RULES = {
  title: {
    label: 'Page title',
    minLen: 30,
    maxLen: 60,
  },
  description: {
    label: 'Meta description',
    minLen: 50,
    maxLen: 160,
  },
};

/**
 * @param {string} url
 * @returns {Promise<{id: string, label: string, status: 'pass'|'warn'|'fail', findings: string[]}>}
 */
export async function run(url) {
  let doc;
  try {
    doc = await fetchAndParse(url);
  } catch (err) {
    return result('fail', [`Could not fetch page HTML: ${err.message}`]);
  }

  const findings = [];
  let hasMissing = false;

  // --- title ---
  const title = doc.querySelector('title')?.textContent?.trim() ?? '';
  if (!title) {
    findings.push('Missing: <title> element');
    hasMissing = true;
  } else {
    checkLength('Page title', title, RULES.title, findings);
  }

  // --- meta description ---
  const description = getMeta(doc, 'name', 'description');
  if (!description) {
    findings.push('Missing: <meta name="description">');
    hasMissing = true;
  } else {
    checkLength('Meta description', description, RULES.description, findings);
  }

  // --- og:image ---
  const ogImage = getMeta(doc, 'property', 'og:image');
  if (!ogImage) {
    findings.push('Missing: <meta property="og:image">');
  } else if (isPlaceholderImage(ogImage)) {
    findings.push(`og:image appears to be a placeholder: ${ogImage}`);
  } else if (!isEdsMediaUrl(ogImage, url)) {
    findings.push(`og:image is not routed through EDS media pipeline: ${ogImage}`);
  }

  // --- canonical ---
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
  if (!canonical) {
    findings.push('Missing: <link rel="canonical">');
  } else {
    checkCanonical(canonical, url, findings);
  }

  // --- og:title and og:description (recommended) ---
  if (!getMeta(doc, 'property', 'og:title')) {
    findings.push('Missing: <meta property="og:title"> (recommended)');
  }
  if (!getMeta(doc, 'property', 'og:description')) {
    findings.push('Missing: <meta property="og:description"> (recommended)');
  }

  // --- robots (warn if noindex) ---
  const robots = getMeta(doc, 'name', 'robots');
  if (robots && /noindex/i.test(robots)) {
    findings.push(`Page is set to noindex — will not appear in search results (robots: "${robots}")`);
  }

  let status;
  if (hasMissing) {
    status = 'fail';
  } else if (findings.length > 0) {
    status = 'warn';
  } else {
    status = 'pass';
  }

  return result(status, findings);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHECKS = [
  '<title> present and 30–60 characters',
  '<meta name="description"> present and 50–160 characters',
  '<meta property="og:image"> present and routed through EDS media pipeline',
  '<link rel="canonical"> present and points to production (aem.live)',
  '<meta property="og:title"> present',
  '<meta property="og:description"> present',
  'Page is not set to noindex',
];

function result(status, findings) {
  return { id: 'metadata', label: 'Metadata Completeness', status, findings, checks: CHECKS };
}

/**
 * Get content of a <meta> tag by attribute name+value pair.
 * @param {Document} doc
 * @param {'name'|'property'} attr
 * @param {string} value
 */
function getMeta(doc, attr, value) {
  return doc.querySelector(`meta[${attr}="${value}"]`)?.getAttribute('content')?.trim() ?? '';
}

/**
 * Add a finding if the string length is outside [minLen, maxLen].
 */
function checkLength(label, text, { minLen, maxLen }, findings) {
  const len = text.length;
  if (len < minLen) {
    findings.push(`${label} too short: ${len} chars (ideal: ${minLen}–${maxLen})`);
  } else if (len > maxLen) {
    findings.push(`${label} too long: ${len} chars (ideal: ${minLen}–${maxLen})`);
  }
}

/**
 * Detect common placeholder image patterns.
 */
function isPlaceholderImage(src) {
  return /placeholder|default|dummy|example|lorem/i.test(src);
}

/**
 * Check whether an image URL is routed through the EDS media pipeline.
 * Valid forms: same-origin paths containing /media/ or media_<hash>.
 */
function isEdsMediaUrl(src, pageUrl) {
  try {
    const imgUrl = new URL(src, pageUrl);
    const pageOrigin = new URL(pageUrl).origin;
    if (imgUrl.origin !== pageOrigin) return false;
    return /\/media\/|media_[a-z0-9]/i.test(imgUrl.pathname);
  } catch {
    return false;
  }
}

/**
 * Validate the canonical URL:
 *   - Should be absolute
 *   - For production EDS sites, should point to aem.live (not aem.page)
 *   - Should match the page's own origin (no cross-origin canonical)
 */
function checkCanonical(canonical, pageUrl, findings) {
  let canonicalUrl;
  try {
    canonicalUrl = new URL(canonical);
  } catch {
    findings.push(`Canonical is not a valid absolute URL: "${canonical}"`);
    return;
  }

  // Preview URL set as canonical is a common authoring mistake
  if (canonicalUrl.hostname.endsWith('.aem.page')) {
    findings.push(`Canonical points to preview (aem.page) — should point to production (aem.live): ${canonical}`);
    return;
  }

  try {
    const pageOrigin = new URL(pageUrl).origin;
    if (canonicalUrl.origin !== pageOrigin) {
      findings.push(`Canonical points to a different origin than the page: ${canonical}`);
    }
  } catch {
    // pageUrl already validated by the caller
  }
}

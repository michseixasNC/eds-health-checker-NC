/**
 * checks/links.js
 *
 * Audits all <a> tags on the target EDS page for broken links,
 * non-HTTPS external hrefs, missing rel="noopener" on external links,
 * suspicious href values, and links with no accessible label.
 */

import { addCapped, fetchAndParse, truncate } from '../lib/fetch.js';

/** Same-origin links sampled for live 404/5xx probing */
const MAX_PROBE = 10;

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

  const pageOrigin = new URL(url).origin;
  const findings = [];

  const anchors = [...doc.querySelectorAll('a[href]')];
  if (anchors.length === 0) return result('pass', []);

  const insecure = [];
  const missingRel = [];
  const suspicious = [];
  const noLabel = [];
  const uniqueSameOrigin = new Set();

  for (const a of anchors) {
    const href = a.getAttribute('href') ?? '';
    const text = a.textContent.trim();
    const ariaLabel = a.getAttribute('aria-label') ?? '';

    // Suspicious / non-navigating hrefs
    if (!href || href === '#' || href.startsWith('javascript:')) {
      suspicious.push(href || '(empty)');
      continue;
    }

    // Skip non-http(s) schemes (mailto:, tel:, …) — valid by design
    if (!/^https?:\/\//i.test(href) && !href.startsWith('/') && !href.startsWith('.') && !href.startsWith('#')) {
      continue;
    }

    let resolved;
    try {
      resolved = new URL(href, url);
    } catch {
      suspicious.push(href);
      continue;
    }

    const isExternal = resolved.origin !== pageOrigin;

    // Non-HTTPS external links
    if (isExternal && resolved.protocol === 'http:') {
      insecure.push(href);
    }

    // External links missing rel="noopener" (security: opener access)
    if (isExternal) {
      const rel = (a.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
      if (!rel.includes('noopener') && !rel.includes('noreferrer')) {
        missingRel.push(truncate(resolved.href));
      }
    }

    // No accessible label
    if (!text && !ariaLabel) {
      noLabel.push(truncate(resolved.href));
    }

    if (!isExternal) {
      uniqueSameOrigin.add(resolved.href);
    }
  }

  // Probe a sample of same-origin links for 4xx/5xx responses
  const broken = [];
  const toProbe = [...uniqueSameOrigin].slice(0, MAX_PROBE);
  if (toProbe.length > 0) {
    const probes = await Promise.allSettled(
      toProbe.map(async (href) => {
        const res = await fetch(`/proxy?url=${encodeURIComponent(href)}`);
        return { href, status: res.status };
      }),
    );
    for (const r of probes) {
      if (r.status === 'fulfilled' && r.value.status >= 400) {
        broken.push(`${truncate(r.value.href)} (HTTP ${r.value.status})`);
      }
    }
  }

  // Build findings
  if (broken.length > 0) {
    addCapped(findings, broken, (h) => `Broken link: ${h}`, 'broken links');
  }
  if (insecure.length > 0) {
    addCapped(findings, insecure, (h) => `Non-HTTPS external link: "${truncate(h)}"`, 'non-HTTPS links');
  }
  if (missingRel.length > 0) {
    addCapped(findings, missingRel, (h) => `External link missing rel="noopener": "${h}"`, 'links missing noopener');
  }
  if (suspicious.length > 0) {
    addCapped(findings, suspicious, (h) => `Suspicious href: "${h}" — non-navigating link.`, 'suspicious hrefs');
  }
  if (noLabel.length > 0) {
    addCapped(findings, noLabel, (h) => `Link has no text or aria-label: "${h}"`, 'unlabelled links');
  }

  const status = broken.length > 0 || insecure.length > 0 ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
  return result(status, findings);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHECKS = [
  'No same-origin links return 4xx/5xx (sampled up to 10)',
  'All external links use HTTPS',
  'All external links have rel="noopener" or rel="noreferrer"',
  'No javascript: or empty href values',
  'All links have accessible text or aria-label',
];

function result(status, findings) {
  return { id: 'links', label: 'Link Health', status, findings, checks: CHECKS };
}

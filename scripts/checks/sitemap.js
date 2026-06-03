/**
 * checks/sitemap.js
 *
 * Audits the sitemap at <origin>/sitemap.xml.
 *
 * A valid, reachable sitemap is essential for search engine and AI crawler
 * discovery. Without it, crawlers may miss content entirely.
 *
 * Checks:
 *   FAIL — /sitemap.xml not reachable (404 or network error)
 *   FAIL — sitemap found but response is not valid XML
 *   FAIL — XML root is not <urlset> or <sitemapindex> (not a valid sitemap)
 *   FAIL — sitemap contains no <loc> entries
 *   WARN — audited page URL not found in any <loc> entry
 *   WARN — robots.txt does not reference the sitemap via a Sitemap: directive
 */

import { fetchRaw } from '../lib/fetch.js';

/**
 * @param {string} url
 * @returns {Promise<{id: string, label: string, status: 'pass'|'warn'|'fail', findings: string[]}>}
 */
export async function run(url) {
  const origin = new URL(url).origin;
  const sitemapUrl = `${origin}/sitemap.xml`;

  // Fetch sitemap and robots.txt in parallel
  const [sitemapRes, robotsRes] = await Promise.allSettled([fetchRaw(sitemapUrl), fetchRaw(`${origin}/robots.txt`)]);

  const findings = [];
  let hasFail = false;

  // 1. Sitemap reachability
  if (sitemapRes.status === 'rejected' || !sitemapRes.value.ok) {
    return result('fail', [
      `No sitemap found at ${sitemapUrl} — add a sitemap.xml so search engines and AI crawlers can discover your content.`,
    ]);
  }

  const sitemapBody = sitemapRes.value.body;

  // 2. Parse XML
  let xmlDoc;
  try {
    xmlDoc = new DOMParser().parseFromString(sitemapBody, 'application/xml');
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) throw new Error(parseError.textContent.trim().split('\n')[0]);
  } catch (err) {
    return result('fail', [`sitemap.xml found but could not be parsed as XML: ${err.message}`]);
  }

  // 3. Validate root element
  const root = xmlDoc.documentElement;
  const rootName = root.localName.toLowerCase();
  const isUrlset = rootName === 'urlset';
  const isSitemapIndex = rootName === 'sitemapindex';

  if (!isUrlset && !isSitemapIndex) {
    return result('fail', [`sitemap.xml root element is <${root.localName}> — expected <urlset> or <sitemapindex>.`]);
  }

  // 4. Collect all <loc> values
  const locs = [...xmlDoc.querySelectorAll('loc')].map((el) => el.textContent.trim());

  if (locs.length === 0) {
    findings.push(
      `sitemap.xml ${isSitemapIndex ? 'index' : ''} contains no <loc> entries — crawlers have nothing to follow.`,
    );
    hasFail = true;
  } else {
    // 5. Check audited URL appears in sitemap
    const normAudited = normalizeForCompare(url);
    const found = locs.some((loc) => normalizeForCompare(loc) === normAudited);
    if (!found) {
      findings.push(
        `Audited URL not found in sitemap (${locs.length} URL${locs.length > 1 ? 's' : ''} listed) — verify the page is included or that this is expected for subpages.`,
      );
    }

    // Surface sitemap type and count as context
    if (isSitemapIndex) {
      findings.push(`sitemap.xml is a sitemap index referencing ${locs.length} child sitemap(s).`);
    }
  }

  // 6. Check robots.txt for Sitemap: directive
  if (robotsRes.status === 'fulfilled' && robotsRes.value.ok) {
    const robotsBody = robotsRes.value.body;
    const hasSitemapDirective = /^Sitemap:/im.test(robotsBody);
    if (!hasSitemapDirective) {
      findings.push(
        'robots.txt does not include a Sitemap: directive — add "Sitemap: <full-url>/sitemap.xml" to help crawlers find it.',
      );
    }
  }

  const status = hasFail ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
  return result(status, findings);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip trailing slash and lowercase for loose URL comparison. */
function normalizeForCompare(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/$/, '') || '/'}`.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

const CHECKS = [
  '/sitemap.xml is reachable (HTTP 200)',
  'sitemap.xml is valid XML with <urlset> or <sitemapindex> root',
  'sitemap.xml contains at least one <loc> entry',
  'Audited page URL is listed in the sitemap',
  'robots.txt includes a Sitemap: directive',
];

function result(status, findings) {
  return { id: 'sitemap', label: 'Sitemap', status, findings, checks: CHECKS };
}

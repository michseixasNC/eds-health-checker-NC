/**
 * checks/fonts.js
 *
 * Detects external font service dependencies that add render-blocking requests
 * and bypass EDS performance optimisations. EDS best practice is system fonts
 * or self-hosted fonts loaded via the EDS media pipeline.
 *
 * Checks:
 *   FAIL — <link rel="stylesheet"> loading from an external font CDN (render-blocking)
 *   FAIL — @import url(...) inside a <style> tag pointing to a font CDN
 *   WARN — <link rel="preconnect"> / rel="dns-prefetch" to a font CDN (font CDN in use)
 *   WARN — @font-face src: url(...) referencing an external origin
 */

import { fetchAndParse, truncate } from '../lib/fetch.js';

/** Known font CDN hostnames (substrings matched against URL hostname) */
const FONT_CDNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'use.typekit.net',
  'p.typekit.net',
  'kit.fontawesome.com',
  'use.fontawesome.com',
  'fast.fonts.net',
  'cloud.typography.com',
  'netdna.bootstrapcdn.com',
  'maxcdn.bootstrapcdn.com',
  'cdnjs.cloudflare.com',
];

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
  let hasFail = false;

  // 1. Render-blocking font stylesheets: <link rel="stylesheet" href="[font-cdn]">
  const stylesheetLinks = [...doc.querySelectorAll('link[rel="stylesheet"][href]')];
  for (const link of stylesheetLinks) {
    const cdn = matchesFontCdn(link.getAttribute('href'), url);
    if (cdn) {
      findings.push(
        `Render-blocking font stylesheet from ${cdn}: "${truncate(link.getAttribute('href'))}" — load fonts locally or use a font-display swap.`,
      );
      hasFail = true;
    }
  }

  // 2. @import inside <style> blocks pointing to font CDNs
  const styleTags = [...doc.querySelectorAll('style')];
  for (const style of styleTags) {
    const imports = extractCssImports(style.textContent ?? '');
    for (const importUrl of imports) {
      const cdn = matchesFontCdn(importUrl, url);
      if (cdn) {
        findings.push(
          `CSS @import from font CDN (${cdn}): "${truncate(importUrl)}" — @import is render-blocking and should be replaced with a <link> or removed.`,
        );
        hasFail = true;
      }
    }
  }

  // 3. Preconnect / dns-prefetch hints to font CDNs (signals CDN is in use even if not caught above)
  const hintLinks = [...doc.querySelectorAll('link[rel~="preconnect"], link[rel~="dns-prefetch"]')];
  const hintedCdns = new Set();
  for (const link of hintLinks) {
    const cdn = matchesFontCdn(link.getAttribute('href') ?? '', url);
    if (cdn && !hintedCdns.has(cdn)) {
      hintedCdns.add(cdn);
      findings.push(`Preconnect/dns-prefetch hint to font CDN "${cdn}" — indicates external fonts are being loaded.`);
    }
  }

  // 4. @font-face src: url(...) with external origins inside <style> blocks
  const externalFontFaces = [];
  for (const style of styleTags) {
    for (const extUrl of extractFontFaceUrls(style.textContent ?? '', url)) {
      externalFontFaces.push(extUrl);
    }
  }
  if (externalFontFaces.length > 0) {
    for (const f of externalFontFaces.slice(0, 5)) {
      findings.push(
        `@font-face loads from external origin: "${truncate(f)}" — host font files through the EDS media pipeline instead.`,
      );
    }
    if (externalFontFaces.length > 5) {
      findings.push(`…and ${externalFontFaces.length - 5} more external @font-face source(s).`);
    }
  }

  const status = hasFail ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
  return result(status, findings);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the matched CDN label if the href resolves to a known font CDN, else null.
 */
function matchesFontCdn(href, pageUrl) {
  if (!href) return null;
  try {
    const resolved = new URL(href, pageUrl);
    return FONT_CDNS.find((cdn) => resolved.hostname === cdn || resolved.hostname.endsWith(`.${cdn}`)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract all url(...) values from CSS @import rules in a stylesheet string.
 */
function extractCssImports(css) {
  const urls = [];
  // Matches: @import "url" or @import url("url") or @import url('url')
  const re = /@import\s+(?:url\s*\(\s*['"]?([^'")]+)['"]?\s*\)|['"]([^'"]+)['"])/gi;
  let m;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iterator pattern
  while ((m = re.exec(css)) !== null) {
    urls.push(m[1] ?? m[2]);
  }
  return urls;
}

/**
 * Extract external-origin url(...) values from @font-face src declarations.
 */
function extractFontFaceUrls(css, pageUrl) {
  const pageOrigin = new URL(pageUrl).origin;
  const urls = [];
  // Isolate @font-face blocks
  const blockRe = /@font-face\s*\{([^}]*)\}/gi;
  let block;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iterator pattern
  while ((block = blockRe.exec(css)) !== null) {
    const srcRe = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
    let m;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iterator pattern
    while ((m = srcRe.exec(block[1])) !== null) {
      const href = m[1].trim();
      try {
        const resolved = new URL(href, pageUrl);
        if (resolved.origin !== pageOrigin) urls.push(href);
      } catch {
        // unparseable — skip
      }
    }
  }
  return urls;
}

const CHECKS = [
  'No render-blocking font stylesheets from external CDNs',
  'No @import rules loading from font CDNs',
  'No preconnect/dns-prefetch hints to font CDNs',
  'No @font-face declarations loading from external origins',
];

function result(status, findings) {
  return { id: 'fonts', label: 'Font Loading', status, findings, checks: CHECKS };
}

/**
 * checks/skip-navigation.js
 *
 * Audits the page for a "skip to main content" (or equivalent) link —
 * required by WCAG 2.4.1 (Bypass Blocks, Level A).
 *
 * A skip link lets keyboard and screen-reader users jump past repeated
 * navigation directly to the main content area. Without one, every page
 * visit requires tabbing through the entire header before reaching content.
 *
 * Checks:
 *   FAIL — no skip link found anywhere on the page
 *   WARN — skip link is not the first focusable element (comes after header/nav)
 *   WARN — skip link href target (#id) does not exist on the page
 */

import { fetchAndParse } from '../lib/fetch.js';

const SKIP_PATTERNS = [
  /skip\s+(to\s+)?(main|content|navigation|nav)/i,
  /jump\s+to\s+(main|content)/i,
  /bypass\s+(navigation|nav|blocks)/i,
  /go\s+to\s+(main|content)/i,
];

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export async function run(url) {
  let doc;
  try {
    doc = await fetchAndParse(url);
  } catch (err) {
    return result('fail', [`Could not fetch page HTML: ${err.message}`]);
  }

  const findings = [];

  // Find all in-page anchor links whose accessible name matches skip patterns
  const candidates = [...doc.querySelectorAll('a[href^="#"]')].filter((a) => {
    const name = (a.getAttribute('aria-label') ?? a.textContent ?? '').trim();
    return SKIP_PATTERNS.some((re) => re.test(name));
  });

  if (candidates.length === 0) {
    return result('fail', [
      'No skip navigation link found — add a "Skip to main content" <a href="#..."> as the first focusable element on the page (WCAG 2.4.1 Level A). Without it, keyboard users must tab through the entire header on every page visit.',
    ]);
  }

  const skipLink = candidates[0];

  // Check 1: skip link should come before <header> or <nav> in DOM order
  const header = doc.querySelector('header, nav, [role="navigation"]');
  if (header) {
    // Node.DOCUMENT_POSITION_FOLLOWING (4) means header comes after skipLink — correct order
    const pos = skipLink.compareDocumentPosition(header);
    // eslint-disable-next-line no-bitwise
    const skipIsAfterHeader = !(pos & Node.DOCUMENT_POSITION_FOLLOWING);
    if (skipIsAfterHeader) {
      findings.push(
        'Skip link appears after the <header> or <nav> in DOM order — it must precede navigation to be reachable before the user has already tabbed past it.',
      );
    }
  } else {
    // No header/nav — check that skip link is among the first few focusable elements
    const focusable = [...doc.querySelectorAll(FOCUSABLE_SELECTOR)];
    const idx = focusable.indexOf(skipLink);
    if (idx > 3) {
      findings.push(
        `Skip link is focusable element #${idx + 1} on the page — move it to be the very first focusable element so keyboard users can reach it immediately.`,
      );
    }
  }

  // Check 2: the href target must exist on the page
  const href = skipLink.getAttribute('href') ?? '';
  const targetId = href.startsWith('#') ? href.slice(1) : '';
  if (targetId) {
    const target = doc.getElementById(targetId) ?? doc.querySelector(`[name="${CSS.escape(targetId)}"]`);
    if (!target) {
      findings.push(
        `Skip link points to "${href}" but no element with that id or name exists on the page — the link leads nowhere and the skip will not work.`,
      );
    }
  } else {
    findings.push(
      `Skip link has no in-page anchor target (href="${href}") — use href="#<id>" pointing to the <main> element or main content wrapper.`,
    );
  }

  const status = findings.length > 0 ? 'warn' : 'pass';
  return result(status, findings);
}

const CHECKS = [
  'A skip navigation link is present on the page (WCAG 2.4.1 Level A)',
  'Skip link precedes <header> / <nav> in DOM order',
  'Skip link href target exists on the page',
];

function result(status, findings) {
  return { id: 'skip-navigation', label: 'Skip Navigation', status, findings, checks: CHECKS };
}

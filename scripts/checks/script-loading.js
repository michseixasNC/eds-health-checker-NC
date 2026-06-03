/**
 * checks/script-loading.js
 *
 * Detects render-blocking scripts in <head>.
 *
 * A <script src="..."> in <head> without defer or async blocks HTML parsing
 * until the script is fetched, parsed, and executed — directly hurting FCP
 * and LCP. EDS standard is to load all scripts with defer (or as type="module",
 * which is implicitly deferred).
 *
 * Checks:
 *   FAIL — external <script src> in <head> with no defer, async, or type="module"
 *   WARN — external <script src async> in <head> (async can still block render
 *           if the script executes before first paint)
 *   WARN — large inline <script> in <head> (> 2 KB; blocks the parser while
 *           the JS engine parses and compiles the inline code)
 */

import { fetchAndParse, truncate } from '../lib/fetch.js';

/** Inline script size threshold in bytes above which we warn */
const INLINE_WARN_BYTES = 2048;

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

  const headScripts = [...doc.head.querySelectorAll('script')];
  if (headScripts.length === 0) return result('pass', []);

  const findings = [];
  let hasFail = false;

  for (const script of headScripts) {
    const src = script.getAttribute('src');
    const isModule = script.getAttribute('type') === 'module';
    const hasDefer = script.hasAttribute('defer');
    const hasAsync = script.hasAttribute('async');

    if (src) {
      // type="module" and defer are both safe — implicitly or explicitly deferred
      if (isModule || hasDefer) continue;

      if (!hasAsync) {
        findings.push(
          `Render-blocking script in <head>: "${truncate(src)}" — add defer (or type="module") to unblock HTML parsing.`,
        );
        hasFail = true;
      } else {
        findings.push(
          `Async script in <head> may still block first paint: "${truncate(src)}" — prefer defer for non-critical scripts.`,
        );
      }
    } else {
      // Inline script — warn if large
      const size = new Blob([script.textContent ?? '']).size;
      if (size > INLINE_WARN_BYTES) {
        findings.push(
          `Large inline <script> in <head>: ${(size / 1024).toFixed(1)} KB — move non-critical code to a deferred external file.`,
        );
      }
    }
  }

  const status = hasFail ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
  return result(status, findings);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHECKS = [
  'No render-blocking <script src> in <head> (must have defer or type="module")',
  'No async scripts in <head> that could block first paint',
  'No large inline <script> blocks in <head> (> 2 KB)',
];

function result(status, findings) {
  return { id: 'script-loading', label: 'Script Loading', status, findings, checks: CHECKS };
}

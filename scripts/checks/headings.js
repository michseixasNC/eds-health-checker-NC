/**
 * headings.js
 *
 * Validates heading hierarchy on the page:
 *  - Exactly one <h1> (zero or multiple = fail)
 *  - <h1> text is not empty
 *  - No skipped heading levels (e.g. h1 → h3 without h2 = warn)
 */

import { fetchAndParse } from '../lib/fetch.js';

export async function run(url) {
  let doc;
  try {
    doc = await fetchAndParse(url);
  } catch (err) {
    return result('warn', [`Could not fetch page: ${err.message}`]);
  }

  const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  const h1s = headings.filter((h) => h.tagName === 'H1');
  const findings = [];
  let hasFail = false;

  if (h1s.length === 0) {
    findings.push('No <h1> found on the page.');
    hasFail = true;
  } else if (h1s.length > 1) {
    findings.push(`${h1s.length} <h1> elements found — there should be exactly one.`);
    hasFail = true;
  } else if (!h1s[0].textContent.trim()) {
    findings.push('<h1> is present but contains no text.');
    hasFail = true;
  }

  const levels = headings.map((h) => parseInt(h.tagName[1], 10));
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      findings.push(`Heading level skipped: h${levels[i - 1]} → h${levels[i]} (missing h${levels[i - 1] + 1}).`);
    }
  }

  const status = hasFail ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
  return result(status, findings);
}

const CHECKS = [
  'Exactly one <h1> present on the page',
  '<h1> contains non-empty text',
  'No heading levels are skipped (e.g. h1 → h3)',
];

function result(status, findings) {
  return { id: 'headings', label: 'Heading Hierarchy', status, findings, checks: CHECKS };
}

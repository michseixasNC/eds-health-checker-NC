/**
 * checks/duplicate-ids.js
 *
 * Finds duplicate id attributes anywhere in the document.
 *
 * Duplicate IDs cause silent failures across the stack:
 *   - document.getElementById() returns only the first match
 *   - <label for="x"> binds to the first element with id="x"
 *   - aria-labelledby / aria-describedby reference the wrong element
 *   - Fragment links (#section) scroll to an unpredictable element
 *   - CSS :target selectors match the wrong element
 *
 * Status:
 *   FAIL — any ID appears more than once in the document
 */

import { fetchAndParse } from '../lib/fetch.js';

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

  const allIds = [...doc.querySelectorAll('[id]')].map((el) => el.getAttribute('id'));

  if (allIds.length === 0) return result('pass', []);

  const counts = new Map();
  for (const id of allIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const duplicates = [...counts.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]);

  if (duplicates.length === 0) return result('pass', []);

  const findings = [];
  const shown = duplicates.slice(0, 10);
  for (const [id, count] of shown) {
    findings.push(`id="${id}" appears ${count} times — IDs must be unique per document.`);
  }
  if (duplicates.length > 10) {
    findings.push(`…and ${duplicates.length - 10} more duplicate ID(s).`);
  }

  return result('fail', findings);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHECKS = ['All id attributes are unique within the document'];

function result(status, findings) {
  return { id: 'duplicate-ids', label: 'Duplicate IDs', status, findings, checks: CHECKS };
}

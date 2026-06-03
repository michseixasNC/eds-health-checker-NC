/**
 * checks/viewport.js
 *
 * Verifies that the page declares a correct viewport meta tag.
 *
 * Without <meta name="viewport" content="width=device-width, initial-scale=1">
 * mobile browsers render the page at desktop width and then scale it down,
 * which is the primary cause of Lighthouse mobile score failures on EDS sites.
 *
 * Checks:
 *   FAIL — viewport meta tag is absent entirely
 *   FAIL — viewport meta is present but missing width=device-width
 *   WARN — viewport meta is present but missing initial-scale=1
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

  const tag = doc.querySelector('meta[name="viewport"]');
  if (!tag) {
    return result('fail', [
      'No <meta name="viewport"> found — mobile browsers will render at desktop width, failing Lighthouse mobile scoring.',
    ]);
  }

  const content = (tag.getAttribute('content') ?? '').toLowerCase();
  const findings = [];

  if (!content.includes('width=device-width')) {
    findings.push(
      `viewport meta is missing width=device-width (content: "${tag.getAttribute('content')}") — mobile layout will be broken.`,
    );
    return result('fail', findings);
  }

  if (!content.includes('initial-scale=1')) {
    findings.push(
      `viewport meta is missing initial-scale=1 (content: "${tag.getAttribute('content')}") — add it to ensure correct initial zoom on mobile.`,
    );
  }

  return result(findings.length > 0 ? 'warn' : 'pass', findings);
}

const CHECKS = [
  '<meta name="viewport"> is present',
  'viewport includes width=device-width',
  'viewport includes initial-scale=1',
];

function result(status, findings) {
  return { id: 'viewport', label: 'Viewport Meta', status, findings, checks: CHECKS };
}

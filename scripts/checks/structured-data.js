/**
 * checks/structured-data.js
 *
 * Audits JSON-LD structured data blocks for AI/LLM discoverability.
 *
 * Structured data is the primary signal LLMs and AI search engines
 * (Google AI Overviews, Perplexity, ChatGPT Search) use to understand
 * page context, entity type, and authoritativeness.
 *
 * Checks:
 *   FAIL — <script type="application/ld+json"> contains malformed JSON
 *   FAIL — JSON-LD block is missing @context or @type
 *   WARN — no JSON-LD blocks found on the page
 *   WARN — none of the high-value schemas present
 */

import { fetchAndParse } from '../lib/fetch.js';

/** Schemas with the most impact for AI search visibility */
const HIGH_VALUE_SCHEMAS = [
  'Organization',
  'WebSite',
  'WebPage',
  'Article',
  'NewsArticle',
  'BlogPosting',
  'FAQPage',
  'HowTo',
  'BreadcrumbList',
  'Product',
  'Event',
  'Person',
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

  const scriptTags = [...doc.querySelectorAll('script[type="application/ld+json"]')];

  if (scriptTags.length === 0) {
    return result('warn', [
      'No <script type="application/ld+json"> blocks found — structured data helps AI search engines understand page context and entity type.',
    ]);
  }

  const findings = [];
  let hasFail = false;
  const foundTypes = [];

  for (let i = 0; i < scriptTags.length; i++) {
    const tag = scriptTags[i];
    const label = `JSON-LD block ${scriptTags.length > 1 ? `#${i + 1}` : ''}`.trim();

    // 1. Parse JSON
    let data;
    try {
      data = JSON.parse(tag.textContent ?? '');
    } catch {
      findings.push(`${label}: malformed JSON — could not be parsed by LLMs or search engines.`);
      hasFail = true;
      continue;
    }

    // 2. Flatten @graph arrays into individual objects for type collection
    const objects = Array.isArray(data['@graph']) ? data['@graph'] : [data];

    for (const obj of objects) {
      // 3. Validate @context
      if (!obj['@context']) {
        findings.push(`${label}: missing @context — add "@context": "https://schema.org".`);
        hasFail = true;
      }

      // 4. Validate @type
      if (!obj['@type']) {
        findings.push(`${label}: missing @type — LLMs cannot determine the entity type without it.`);
        hasFail = true;
      } else {
        const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
        foundTypes.push(...types);
      }
    }
  }

  // 5. Check for high-value schema presence
  const matched = HIGH_VALUE_SCHEMAS.filter((s) => foundTypes.some((t) => t === s || t.endsWith(`/${s}`)));

  if (!hasFail && matched.length === 0 && foundTypes.length > 0) {
    findings.push(
      `No high-value schemas found (found: ${foundTypes.join(', ')}). Consider adding: Organization, WebPage, Article, or FAQPage for better AI search visibility.`,
    );
  }

  if (!hasFail && matched.length === 0 && foundTypes.length === 0) {
    findings.push(
      `Structured data blocks found but no recognised @type values — check that @type matches a schema.org type.`,
    );
  }

  if (matched.length > 0 && findings.length === 0) {
    // All good — optionally surface what was found as context
    findings.push(...[]); // pass with no findings
  }

  const status = hasFail ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
  return result(status, findings);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHECKS = [
  'At least one <script type="application/ld+json"> block present',
  'All JSON-LD blocks contain valid, parseable JSON',
  'All JSON-LD blocks have @context and @type',
  'At least one high-value schema present (Organization, WebPage, Article, FAQPage, BreadcrumbList…)',
];

function result(status, findings) {
  return { id: 'structured-data', label: 'Structured Data', status, findings, checks: CHECKS };
}

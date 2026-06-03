/**
 * checks/lang.js
 *
 * Verifies that the <html> element declares a language attribute.
 *
 * The lang attribute on <html> is required by WCAG SC 3.1.1 (Level A).
 * Screen readers use it to select the correct voice profile and pronunciation
 * rules. Search engines also use it for language-targeted indexing.
 *
 * Checks:
 *   FAIL — <html lang> attribute is absent
 *   FAIL — <html lang> is present but empty
 *   WARN — lang value does not look like a valid BCP 47 tag (e.g. "en", "en-US", "pt-BR")
 */

import { fetchAndParse } from '../lib/fetch.js';

/** Loose BCP 47 pattern: 2–3 letter primary subtag, optional region/script subtags */
const BCP47_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

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

  const html = doc.documentElement;
  const lang = html.getAttribute('lang');

  if (lang === null) {
    return result('fail', [
      '<html> element has no lang attribute — screen readers cannot determine the page language (WCAG 3.1.1).',
    ]);
  }

  if (!lang.trim()) {
    return result('fail', [
      '<html lang> is present but empty — set it to a valid BCP 47 language tag (e.g. lang="en" or lang="en-US").',
    ]);
  }

  if (!BCP47_RE.test(lang.trim())) {
    return result('warn', [
      `<html lang="${lang}"> does not look like a valid BCP 47 tag — expected values like "en", "en-US", "pt-BR", "de".`,
    ]);
  }

  return result('pass', []);
}

const CHECKS = [
  '<html> element has a lang attribute',
  'lang attribute is non-empty',
  'lang value matches BCP 47 format (e.g. "en", "en-US")',
];

function result(status, findings) {
  return { id: 'lang', label: 'Language Attribute', status, findings, checks: CHECKS };
}

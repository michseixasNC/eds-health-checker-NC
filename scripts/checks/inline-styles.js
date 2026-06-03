/**
 * checks/inline-styles.js
 *
 * Audits the page for inline style usage that breaks EDS theming.
 * EDS uses CSS custom properties for all design tokens (colors, spacing,
 * typography). Inline styles override custom properties and make pages
 * impossible to re-theme without editing HTML.
 *
 * Checks:
 *   FAIL — style attribute contains !important (cannot be overridden by any stylesheet)
 *   FAIL — <style> tag inside <body> (styles must live in <head> or external sheets)
 *   WARN — inline style sets a theming property (color, background, font-*)
 *   WARN — high volume of elements carrying any style attribute (> 10)
 */

/**
 * CSS properties that map to EDS design tokens and should never be inlined.
 * Setting these inline locks the visual output and bypasses CSS custom properties.
 */
import { fetchAndParse, truncate } from '../lib/fetch.js';

const THEMING_PROPS = [
  'color',
  'background',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'border-color',
  'border-radius',
  'padding',
  'margin',
];

const MAX_FINDINGS = 5;

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

  // 1. <style> tags inside <body>
  const bodyStyleTags = [...doc.body.querySelectorAll('style')];
  if (bodyStyleTags.length > 0) {
    findings.push(
      `${bodyStyleTags.length} <style> tag(s) found inside <body> — styles must live in <head> or external stylesheets.`,
    );
    hasFail = true;
  }

  // 2. Elements with style attributes (search within <body> only)
  const styledEls = [...doc.body.querySelectorAll('[style]')];

  if (styledEls.length === 0 && bodyStyleTags.length === 0) {
    return result('pass', []);
  }

  // 3. !important in any style attribute → always fail
  const importantEls = styledEls.filter((el) => el.getAttribute('style').includes('!important'));
  if (importantEls.length > 0) {
    const shown = importantEls.slice(0, MAX_FINDINGS);
    for (const el of shown) {
      findings.push(
        `!important in inline style on <${el.tagName.toLowerCase()}${el.className ? ` class="${[...el.classList].slice(0, 2).join(' ')}"` : ''}>: "${truncate(el.getAttribute('style'))}" — cannot be overridden by any stylesheet.`,
      );
    }
    if (importantEls.length > MAX_FINDINGS) {
      findings.push(`…and ${importantEls.length - MAX_FINDINGS} more element(s) with !important inline styles.`);
    }
    hasFail = true;
  }

  // 4. Theming properties set inline
  const themingEls = styledEls.filter((el) => usesThemingProp(el.getAttribute('style')));
  const nonImportantTheming = themingEls.filter((el) => !el.getAttribute('style').includes('!important'));
  if (nonImportantTheming.length > 0) {
    const shown = nonImportantTheming.slice(0, MAX_FINDINGS);
    for (const el of shown) {
      const props = extractThemingProps(el.getAttribute('style'));
      findings.push(
        `Theming propert${props.length > 1 ? 'ies' : 'y'} (${props.join(', ')}) set inline on <${el.tagName.toLowerCase()}${el.className ? ` class="${[...el.classList].slice(0, 2).join(' ')}"` : ''}> — use CSS custom properties instead.`,
      );
    }
    if (nonImportantTheming.length > MAX_FINDINGS) {
      findings.push(
        `…and ${nonImportantTheming.length - MAX_FINDINGS} more element(s) with theming properties set inline.`,
      );
    }
  }

  // 5. High volume of any inline styles (non-theming, non-!important remainder)
  const otherStyled = styledEls.filter(
    (el) => !el.getAttribute('style').includes('!important') && !usesThemingProp(el.getAttribute('style')),
  );
  if (otherStyled.length > 10) {
    findings.push(
      `${otherStyled.length} element(s) carry inline style attributes — consider moving repeated styles to a stylesheet.`,
    );
  }

  const status = hasFail ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
  return result(status, findings);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function usesThemingProp(styleAttr) {
  return extractThemingProps(styleAttr).length > 0;
}

function extractThemingProps(styleAttr) {
  const decl = styleAttr.toLowerCase();
  return THEMING_PROPS.filter((prop) => {
    // Match "prop:" with optional whitespace, avoiding partial matches (e.g. "color" in "background-color")
    const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:`);
    return re.test(decl);
  });
}

const CHECKS = [
  'No <style> tags inside <body>',
  'No inline style attributes use !important',
  'No theming properties (color, background, font-*) set inline',
  'Fewer than 10 elements carry any inline style attribute',
];

function result(status, findings) {
  return { id: 'inline-styles', label: 'Inline Styles', status, findings, checks: CHECKS };
}

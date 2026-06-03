/**
 * checks/accessibility.js
 *
 * Static accessibility audit against the raw page HTML.
 *
 * Checks:
 *   FAIL — <img> missing alt attribute (WCAG 1.1.1)
 *   FAIL — <img> inside <a> with alt="" (link has no accessible name)
 *   FAIL — <input>/<select>/<textarea> with no accessible label (WCAG 1.3.1, 4.1.2)
 *   FAIL — <button> or [role="button"] with no accessible name (WCAG 4.1.2)
 *   WARN — <div>/<span> with onclick but no role and no tabindex (keyboard trap)
 *   WARN — Inline color + background-color with contrast ratio below 4.5:1 (WCAG 1.4.3)
 */

import { addCapped, fetchAndParse, truncate } from '../lib/fetch.js';

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

  // 1. <img> missing alt attribute
  const imgs = [...doc.querySelectorAll('img')];
  const missingAlt = imgs.filter((img) => !img.hasAttribute('alt'));
  if (missingAlt.length > 0) {
    addCapped(
      findings,
      missingAlt,
      (img) => `<img> missing alt attribute: src="${truncate(img.getAttribute('src') ?? '')}"`,
      'images missing alt',
    );
    hasFail = true;
  }

  // 2. <img> inside <a> with alt="" — link has no accessible name from the image
  const linkedImgsEmptyAlt = imgs
    .filter((img) => img.getAttribute('alt') === '' && img.closest('a') !== null)
    .filter((img) => {
      const anchor = img.closest('a');
      // Only flag if the anchor also has no other text / aria-label
      const labelText =
        (anchor.getAttribute('aria-label') ?? '') + anchor.textContent.replace(img.textContent, '').trim();
      return !labelText.trim();
    });
  if (linkedImgsEmptyAlt.length > 0) {
    addCapped(
      findings,
      linkedImgsEmptyAlt,
      (img) =>
        `<img alt=""> inside <a> with no other accessible name — link is invisible to screen readers: src="${truncate(img.getAttribute('src') ?? '')}"`,
      'linked images with empty alt',
    );
    hasFail = true;
  }

  // 3. Unlabelled form controls
  const formControls = [
    ...doc.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea',
    ),
  ];
  const unlabelledControls = formControls.filter((el) => !hasAccessibleLabel(el, doc));
  if (unlabelledControls.length > 0) {
    addCapped(
      findings,
      unlabelledControls,
      (el) =>
        `<${el.tagName.toLowerCase()}${el.getAttribute('type') ? ` type="${el.getAttribute('type')}"` : ''}${el.getAttribute('name') ? ` name="${el.getAttribute('name')}"` : ''}> has no associated label, aria-label, or aria-labelledby`,
      'unlabelled form controls',
    );
    hasFail = true;
  }

  // 4. Buttons with no accessible name
  const buttons = [...doc.querySelectorAll('button'), ...doc.querySelectorAll('[role="button"]')];
  const unlabelledButtons = buttons.filter((el) => !getAccessibleName(el).trim());
  if (unlabelledButtons.length > 0) {
    addCapped(
      findings,
      unlabelledButtons,
      (el) =>
        `<${el.tagName.toLowerCase()}${el.hasAttribute('role') ? ` role="${el.getAttribute('role')}"` : ''}> has no accessible name (no text, aria-label, or aria-labelledby)`,
      'unlabelled buttons',
    );
    hasFail = true;
  }

  // 5. Non-semantic interactive elements (div/span with onclick, no role, no tabindex)
  const clickableDivs = [...doc.querySelectorAll('div[onclick], span[onclick]')].filter(
    (el) => !el.hasAttribute('role') && !el.hasAttribute('tabindex'),
  );
  if (clickableDivs.length > 0) {
    addCapped(
      findings,
      clickableDivs,
      (el) => `<${el.tagName.toLowerCase()}> has onclick but no role or tabindex — not keyboard accessible`,
      'non-semantic interactive elements',
    );
  }

  // 6. Inline color + background-color contrast below 4.5:1
  const allEls = [...doc.body.querySelectorAll('[style]')];
  for (const el of allEls) {
    const styleAttr = el.getAttribute('style') ?? '';
    const fg = parseInlineColor(styleAttr, 'color');
    const bg = parseInlineColor(styleAttr, 'background-color') ?? parseInlineColor(styleAttr, 'background');
    if (fg && bg) {
      const ratio = contrastRatio(fg, bg);
      if (ratio !== null && ratio < 4.5) {
        findings.push(
          `Low contrast inline style on <${el.tagName.toLowerCase()}>: color vs background-color gives ${ratio.toFixed(2)}:1 (WCAG AA minimum: 4.5:1)`,
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

/** Check if a form control has an accessible label via any standard mechanism. */
function hasAccessibleLabel(el, doc) {
  if (el.getAttribute('aria-label')?.trim()) return true;
  if (el.getAttribute('aria-labelledby')) {
    const ids = el.getAttribute('aria-labelledby').split(/\s+/);
    return ids.some((id) => doc.getElementById(id)?.textContent.trim());
  }
  if (el.getAttribute('title')?.trim()) return true;
  if (el.getAttribute('placeholder')?.trim()) return true; // weak but common
  const id = el.getAttribute('id');
  if (id && doc.querySelector(`label[for="${id}"]`)?.textContent.trim()) return true;
  if (el.closest('label')?.textContent.trim()) return true;
  return false;
}

/** Get the accessible name of an element (text content + aria attributes). */
function getAccessibleName(el) {
  return (el.getAttribute('aria-label') ?? el.getAttribute('title') ?? el.textContent ?? '').trim();
}

/**
 * Parse a single color value from an inline style string.
 * Handles hex (#rgb, #rrggbb), rgb(), rgba(), and a small set of named colors.
 * Returns [r, g, b] (0–255) or null if unparseable.
 */
function parseInlineColor(styleAttr, prop) {
  // Match: prop: <value> (up to ; or end)
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
  const m = styleAttr.match(re);
  if (!m) return null;
  return parseColor(m[1].trim());
}

function parseColor(raw) {
  const s = raw.toLowerCase().trim();

  // hex: #rgb or #rrggbb
  const hex3 = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (hex3) {
    return [parseInt(hex3[1] + hex3[1], 16), parseInt(hex3[2] + hex3[2], 16), parseInt(hex3[3] + hex3[3], 16)];
  }
  const hex6 = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (hex6) {
    return [parseInt(hex6[1], 16), parseInt(hex6[2], 16), parseInt(hex6[3], 16)];
  }

  // rgb() / rgba()
  const rgb = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];

  // Common named colors
  const NAMED = {
    white: [255, 255, 255],
    black: [0, 0, 0],
    red: [255, 0, 0],
    green: [0, 128, 0],
    blue: [0, 0, 255],
    yellow: [255, 255, 0],
    orange: [255, 165, 0],
    purple: [128, 0, 128],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
    lightgray: [211, 211, 211],
    lightgrey: [211, 211, 211],
    darkgray: [169, 169, 169],
    darkgrey: [169, 169, 169],
    whitesmoke: [245, 245, 245],
    gainsboro: [220, 220, 220],
    silver: [192, 192, 192],
    transparent: [255, 255, 255],
  };
  return NAMED[s] ?? null;
}

/** WCAG relative luminance for an [r,g,b] triplet. */
function luminance([r, g, b]) {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio between two [r,g,b] colours. Returns null if either is null. */
function contrastRatio(c1, c2) {
  if (!c1 || !c2) return null;
  const l1 = luminance(c1);
  const l2 = luminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const CHECKS = [
  'All <img> elements have an alt attribute',
  'Linked images with alt="" have another accessible name on the <a>',
  'All form controls have an associated label',
  'All buttons and [role="button"] elements have an accessible name',
  'No div/span with onclick is missing role and tabindex',
  'Inline color + background-color combinations meet WCAG AA contrast (4.5:1)',
];

function result(status, findings) {
  return { id: 'accessibility', label: 'Accessibility', status, findings, checks: CHECKS };
}

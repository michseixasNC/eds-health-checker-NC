/**
 * checks/images.js
 *
 * Audits image URL routing and markup quality on the target EDS page.
 *
 * EDS image pipeline conventions:
 *   - Images authored in Google Docs / SharePoint are processed by EDS and served
 *     from the same origin with filenames matching: media_<hash>.<ext>
 *   - EDS auto-generates <picture> + <source> elements with WebP variants and
 *     width descriptors for responsive delivery.
 *   - External image URLs bypass EDS optimisation (no WebP, no resizing, no CDN caching).
 *
 * Findings are capped per category to keep the report actionable.
 */

/** Matches EDS media pipeline filenames: media_<hex-hash>.<ext> */
const MEDIA_PIPELINE_RE = /\/media_[a-f0-9]/i;

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

  const pageOrigin = new URL(url).origin;
  const findings = [];
  let hasExternal = false;

  const imgs = [...doc.querySelectorAll('img')];
  const sources = [...doc.querySelectorAll('source')];

  // --- Classify every <img src> ---
  const external = [];
  const nonPipeline = [];
  const dataUris = [];
  const missingDimensions = [];
  const unwrapped = [];

  for (const img of imgs) {
    const src = img.getAttribute('src') ?? '';
    if (!src || src.startsWith('#')) continue;

    const kind = classifyUrl(src, pageOrigin, url);

    if (kind === 'external') {
      external.push(src);
    } else if (kind === 'data') {
      dataUris.push(src);
    } else if (kind === 'non-pipeline') {
      nonPipeline.push(src);
    }

    if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
      missingDimensions.push(src);
    }

    if (img.closest('picture') === null) {
      unwrapped.push(src);
    }
  }

  // --- Classify every <source srcset> ---
  const externalInSrcset = [];
  for (const source of sources) {
    const srcset = source.getAttribute('srcset') ?? '';
    for (const u of parseSrcset(srcset)) {
      if (classifyUrl(u, pageOrigin, url) === 'external') {
        externalInSrcset.push(u);
      }
    }
  }

  // --- Build findings ---

  if (external.length > 0) {
    hasExternal = true;
    addCapped(
      findings,
      external,
      (src) => `External <img>: "${truncate(src)}" — bypasses EDS WebP conversion and CDN caching.`,
      'external <img> URLs',
    );
  }

  if (externalInSrcset.length > 0) {
    hasExternal = true;
    addCapped(
      findings,
      externalInSrcset,
      (src) => `External <source srcset>: "${truncate(src)}" — bypasses EDS media pipeline.`,
      'external srcset URLs',
    );
  }

  if (nonPipeline.length > 0) {
    addCapped(
      findings,
      nonPipeline,
      (src) =>
        `Same-origin image not through EDS pipeline: "${truncate(src)}" — missing auto-WebP and responsive resizing.`,
      'non-pipeline same-origin images',
    );
  }

  if (dataUris.length > 0) {
    findings.push(
      `${dataUris.length} data: URI image(s) found — inline images bloat HTML and bypass the media pipeline.`,
    );
  }

  if (missingDimensions.length > 0) {
    addCapped(
      findings,
      missingDimensions,
      (src) => `<img> missing width/height attributes (CLS risk): "${truncate(src)}".`,
      'images missing dimensions',
    );
  }

  if (unwrapped.length > 0) {
    addCapped(
      findings,
      unwrapped,
      (src) => `<img> not inside <picture> (no WebP/responsive source variants): "${truncate(src)}".`,
      'unwrapped images',
    );
  }

  if (imgs.length === 0 && sources.length === 0) {
    return result('pass', []);
  }

  const status = hasExternal ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
  return result(status, findings);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHECKS = [
  'All <img> sources route through EDS media pipeline (media_<hash>)',
  'No external <img> URLs bypassing EDS CDN and WebP conversion',
  'No external URLs in <source srcset>',
  'No inline data: URI images',
  'All <img> have width and height attributes (CLS prevention)',
  'All <img> wrapped in <picture> for responsive variants',
];

function result(status, findings) {
  return { id: 'images', label: 'Image Routing', status, findings, checks: CHECKS };
}

/**
 * Classify an image URL relative to the page.
 * @returns {'pipeline'|'non-pipeline'|'external'|'data'}
 */
function classifyUrl(src, pageOrigin, pageUrl) {
  if (src.startsWith('data:')) return 'data';

  let resolved;
  try {
    resolved = new URL(src, pageUrl);
  } catch {
    // Unparseable — treat as non-pipeline
    return 'non-pipeline';
  }

  if (resolved.origin !== pageOrigin) return 'external';
  return MEDIA_PIPELINE_RE.test(resolved.pathname) ? 'pipeline' : 'non-pipeline';
}

/**
 * Parse a srcset attribute value into an array of URLs.
 * Handles both width descriptors (750w) and density descriptors (2x).
 * @param {string} srcset
 * @returns {string[]}
 */
function parseSrcset(srcset) {
  if (!srcset.trim()) return [];
  return srcset
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

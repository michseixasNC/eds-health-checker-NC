/**
 * checks/blocks.js
 *
 * Validates EDS block structure conventions on the target page.
 *
 * Fetches raw (pre-JS) HTML and parses it. In raw EDS HTML, blocks have not yet
 * been decorated by aem.js — there are no data-block-name attributes yet — so
 * blocks are identified structurally: direct <div> children of section divs
 * that carry at least one class.
 *
 * EDS DOM structure (raw):
 *   <main>
 *     <div>                          ← section
 *       <div class="hero">           ← block (first class = block name)
 *         <div>                      ← row
 *           <div>content</div>       ← cell
 *         </div>
 *       </div>
 *     </div>
 *   </main>
 *
 * Checks per block:
 *   FAIL  — block name (first class) is not lowercase-kebab-case
 *   FAIL  — block has no child <div> rows (EDS cannot render it)
 *   WARN  — block wrapper has an inline style attribute (anti-pattern)
 *   WARN  — block wrapper has an id attribute (EDS targets by class, not ID)
 *   WARN  — a row <div> carries an inline style (content should be unstyled in source)
 *
 * Page-level checks:
 *   FAIL  — no <main> element found
 *   WARN  — <main> has no section divs (unexpected for a content page)
 */

import { fetchAndParse } from '../lib/fetch.js';

/** Matches valid EDS block names: lowercase letters, digits, hyphens; must start with a letter */
const BLOCK_NAME_RE = /^[a-z][a-z0-9-]*$/;

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

  const main = doc.querySelector('main');
  if (!main) {
    return result('fail', ['No <main> element found — EDS requires <main> for block rendering.']);
  }

  const sections = [...main.querySelectorAll(':scope > div')];
  if (sections.length === 0) {
    return result('warn', ['<main> contains no section <div> elements.']);
  }

  const findings = [];
  let structuralFailure = false;
  let totalBlocks = 0;

  for (const section of sections) {
    // Blocks are direct <div> children of a section that have at least one class.
    // Classless divs are raw content wrappers, not blocks.
    const blocks = [...section.querySelectorAll(':scope > div')].filter((div) => div.classList.length > 0);

    for (const block of blocks) {
      totalBlocks++;
      const blockName = block.classList[0];
      const tag = `Block "${blockName}"`;

      // 1. Block name must be lowercase-kebab-case
      if (!BLOCK_NAME_RE.test(blockName)) {
        findings.push(`${tag}: name is not lowercase-kebab-case — EDS will fail to load the block JS/CSS.`);
        structuralFailure = true;
      }

      // 2. Must have at least one child row <div>
      const rows = [...block.querySelectorAll(':scope > div')];
      if (rows.length === 0) {
        findings.push(`${tag}: no child row <div> found — block has no renderable content structure.`);
        structuralFailure = true;
      }

      // 3. Inline style on block wrapper
      if (block.hasAttribute('style')) {
        findings.push(`${tag}: block wrapper has an inline style attribute — styles belong in the block's CSS file.`);
      }

      // 4. ID on block wrapper
      if (block.hasAttribute('id')) {
        findings.push(
          `${tag}: block wrapper has id="${block.id}" — EDS decorates and targets blocks by class, not ID.`,
        );
      }

      // 5. Inline styles on row divs
      const styledRows = rows.filter((r) => r.hasAttribute('style'));
      if (styledRows.length > 0) {
        findings.push(
          `${tag}: ${styledRows.length} row div(s) have inline style attributes — row content should be unstyled in source.`,
        );
      }
    }
  }

  if (totalBlocks === 0) {
    // Valid for a content-only page (no blocks, just headings/paragraphs)
    return result('pass', []);
  }

  const status = structuralFailure ? 'fail' : findings.length > 0 ? 'warn' : 'pass';
  return result(status, findings);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHECKS = [
  '<main> element present',
  'Section <div> elements present inside <main>',
  'Block names are lowercase-kebab-case',
  'Each block has at least one child row <div>',
  'No inline style attributes on block wrappers',
  'No id attributes on block wrappers',
  'No inline style attributes on row <div>s',
];

function result(status, findings) {
  return { id: 'blocks', label: 'Block Structure', status, findings, checks: CHECKS };
}

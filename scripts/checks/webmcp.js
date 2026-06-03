/**
 * checks/webmcp.js
 *
 * Audits WebMCP (Web Model Context Protocol) readiness — a new web standard
 * announced at Google I/O 2026 that lets sites expose structured tools to
 * browser-based AI agents (e.g. Gemini in Chrome).
 *
 * Declarative API: annotate <form> elements with toolname + tooldescription,
 * and <input>/<textarea>/<select> with toolparamdescription. The browser
 * generates a JSON Schema from the form structure and registers it as a tool
 * agents can call directly.
 *
 * Lighthouse 13.3.0 added an Agentic Browsing category that includes this check.
 *
 * What we audit:
 *   1. Forms with toolname but missing tooldescription (or vice versa) — tool
 *      will never register with the browser. FAIL.
 *   2. Forms that exist but have no WebMCP annotations at all — missed
 *      opportunity to expose tools to agents. WARN.
 *   3. Inputs inside fully-annotated forms that lack toolparamdescription and
 *      have no associated <label> — agents fall back to label text, but bare
 *      inputs degrade schema quality. WARN.
 */

import { fetchAndParse } from '../lib/fetch.js';

const SKIP_TYPES = new Set(['hidden', 'submit', 'reset', 'button', 'image']);

export async function run(url) {
  const doc = await fetchAndParse(url);
  const findings = [];

  const forms = [...doc.querySelectorAll('form')];

  if (forms.length === 0) {
    return result('pass', []);
  }

  const fullyAnnotated = forms.filter((f) => f.hasAttribute('toolname') && f.hasAttribute('tooldescription'));
  const broken = forms.filter(
    (f) =>
      (f.hasAttribute('toolname') && !f.hasAttribute('tooldescription')) ||
      (!f.hasAttribute('toolname') && f.hasAttribute('tooldescription')),
  );
  const unannotated = forms.filter((f) => !f.hasAttribute('toolname') && !f.hasAttribute('tooldescription'));

  // 1. Broken registrations — tool will silently fail to register
  for (const form of broken) {
    const id = form.getAttribute('toolname') || form.getAttribute('id') || 'unnamed';
    if (form.hasAttribute('toolname')) {
      findings.push(`Form "${id}": has toolname but missing tooldescription — tool will not register`);
    } else {
      findings.push(`Form "${id}": has tooldescription but missing toolname — tool will not register`);
    }
  }

  // 2. Forms with no WebMCP annotations at all
  if (unannotated.length > 0) {
    if (fullyAnnotated.length === 0 && broken.length === 0) {
      findings.push(
        `${forms.length} form${forms.length !== 1 ? 's' : ''} found but none annotated with WebMCP — add toolname + tooldescription to expose them as agent tools`,
      );
    } else {
      findings.push(`${unannotated.length} of ${forms.length} forms lack WebMCP annotations`);
    }
  }

  // 3. Inputs inside fully-annotated forms without toolparamdescription or label
  for (const form of fullyAnnotated) {
    const toolname = form.getAttribute('toolname');
    const inputs = [...form.querySelectorAll('input, textarea, select')].filter(
      (i) => !SKIP_TYPES.has(i.getAttribute('type') ?? ''),
    );
    const noDesc = inputs.filter((i) => {
      if (i.hasAttribute('toolparamdescription')) return false;
      const inputId = i.getAttribute('id');
      if (inputId && form.querySelector(`label[for="${CSS.escape(inputId)}"]`)) return false;
      return true;
    });
    if (noDesc.length > 0) {
      const names = noDesc.map((i) => i.getAttribute('name') || i.getAttribute('id') || 'unnamed');
      findings.push(
        `Form "${toolname}": ${noDesc.length} input${noDesc.length !== 1 ? 's' : ''} lack toolparamdescription and labels (${names.join(', ')})`,
      );
    }
  }

  if (broken.length > 0) return result('fail', findings);
  if (findings.length > 0) return result('warn', findings);
  return result('pass', findings);
}

const CHECKS = [
  'No forms with incomplete WebMCP registration (toolname requires tooldescription)',
  'All forms annotated with toolname + tooldescription for agent discoverability',
  'All annotated form inputs have toolparamdescription or an associated label',
];

function result(status, findings) {
  return { id: 'webmcp', label: 'WebMCP', status, findings, checks: CHECKS };
}

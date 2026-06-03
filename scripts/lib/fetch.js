/**
 * lib/fetch.js
 *
 * Shared fetch helpers used by all check modules.
 * All requests are routed through the local /proxy endpoint to bypass CORS.
 */

/**
 * Fetch a URL via the proxy and parse the response as an HTML Document.
 * Throws if the proxy returns a non-OK status.
 * @param {string} url
 * @returns {Promise<Document>}
 */
export async function fetchAndParse(url) {
  const res = await fetch(`https://eds-hc-proxy.michelle-seixas.workers.dev/proxy?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const html = await res.text();
  return new DOMParser().parseFromString(html, 'text/html');
}

/**
 * Fetch a URL via the proxy and return { ok, body }.
 * Never throws — returns { ok: false, body: '' } on any error.
 * @param {string} url
 * @returns {Promise<{ ok: boolean, body: string }>}
 */
export async function fetchRaw(url) {
  const res = await fetch(`https://eds-hc-proxy.michelle-seixas.workers.dev/proxy?url=${encodeURIComponent(url)}`);
  const body = res.ok ? await res.text() : '';
  return { ok: res.ok, body };
}

/**
 * Truncate a string to max characters, appending … if cut.
 * @param {string} src
 * @param {number} [max=80]
 * @returns {string}
 */
export function truncate(src, max = 80) {
  return src.length <= max ? src : `${src.slice(0, max)}…`;
}

/**
 * Push up to `max` formatted findings, then a summary line for the remainder.
 * @param {string[]} findings
 * @param {any[]} items
 * @param {(item: any) => string} format
 * @param {string} categoryLabel
 * @param {number} [max=5]
 */
export function addCapped(findings, items, format, categoryLabel, max = 5) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  for (const item of shown) findings.push(format(item));
  if (rest > 0) findings.push(`…and ${rest} more ${categoryLabel}.`);
}

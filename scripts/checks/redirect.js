/**
 * redirect.js
 *
 * Checks whether the target URL redirects, and flags common EDS authoring
 * mistakes such as using an aem.page (preview) URL instead of aem.live
 * (production), or serving over plain HTTP.
 *
 * @returns {Promise<import('../main.js').CheckResult>}
 */

export async function run(url) {
  const parsed = new URL(url);

  // aem.page is a preview host — always a fail for production audits
  if (parsed.hostname.endsWith('aem.page')) {
    return result('fail', ['URL points to aem.page (preview), not aem.live (production).']);
  }

  let data;
  try {
    const res = await fetch(`https://eds-hc-proxy.michelle-seixas.workers.dev/redirect-check?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    data = await res.json();
  } catch (err) {
    return result('warn', [`Could not perform redirect check: ${err.message}`]);
  }

  if (data.redirected) {
    const inputParsed = new URL(url);
    const finalParsed = new URL(data.finalUrl);

    if (inputParsed.protocol === 'http:' && finalParsed.protocol === 'https:') {
      return result('warn', [`HTTP input redirected to HTTPS (final URL: ${data.finalUrl}).`]);
    }
    return result('warn', [`URL redirects to a different location (final URL: ${data.finalUrl}).`]);
  }

  return result('pass', []);
}

const CHECKS = [
  'URL is not an aem.page (preview) host',
  'URL does not redirect to a different location',
  'URL is served over HTTPS (not HTTP)',
];

function result(status, findings) {
  return { id: 'redirect', label: 'Redirect Check', status, findings, checks: CHECKS };
}

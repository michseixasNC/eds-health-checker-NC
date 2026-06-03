/**
 * checks/performance.js
 *
 * Audits performance / Core Web Vitals via the PageSpeed Insights API (mobile).
 * No API key required for public URLs.
 *
 * Status thresholds (Lighthouse performance score, 0–100):
 *   >= 90 → pass  |  >= 70 → warn  |  < 70 → fail
 */

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/** CWV and key timing metrics to surface in findings */
const METRICS = {
  'largest-contentful-paint': { label: 'LCP', good: 2500, poor: 4000, unit: 'ms' },
  'cumulative-layout-shift': { label: 'CLS', good: 0.1, poor: 0.25, unit: '' },
  'total-blocking-time': { label: 'TBT', good: 200, poor: 600, unit: 'ms' },
  'first-contentful-paint': { label: 'FCP', good: 1800, poor: 3000, unit: 'ms' },
  'interaction-to-next-paint': { label: 'INP', good: 200, poor: 500, unit: 'ms' },
  'speed-index': { label: 'SI', good: 3400, poor: 5800, unit: 'ms' },
};

/**
 * @param {string} url
 * @returns {Promise<{id: string, label: string, status: 'pass'|'warn'|'fail', findings: string[]}>}
 */
export async function run(url, apiKey = '') {
  let data;
  try {
    const key = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
    const apiUrl = `${PSI_ENDPOINT}?url=${encodeURIComponent(url)}&strategy=mobile${key}`;
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = body?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(message);
    }
    data = await res.json();
  } catch (err) {
    return result('fail', [`PageSpeed Insights API error: ${err.message}`]);
  }

  const lhr = data.lighthouseResult;
  const audits = lhr?.audits ?? {};
  const rawScore = lhr?.categories?.performance?.score ?? null;

  if (rawScore === null) {
    return result('fail', ['PageSpeed Insights returned no performance score for this URL.']);
  }

  const score = Math.round(rawScore * 100);
  const findings = [];

  // Overall score (only surface when not perfect)
  if (score < 100) {
    findings.push(`Lighthouse performance score: ${score}/100 (EDS target: 100)`);
  }

  // Core Web Vitals and key timings
  for (const [auditId, { label, good, poor, unit }] of Object.entries(METRICS)) {
    const audit = audits[auditId];
    if (!audit || audit.numericValue == null) continue;

    const value = audit.numericValue;
    const display = audit.displayValue ?? formatValue(value, unit);

    if (value > poor) {
      findings.push(`${label}: ${display} — poor (good: ≤${good}${unit})`);
    } else if (value > good) {
      findings.push(`${label}: ${display} — needs improvement (good: ≤${good}${unit})`);
    }
  }

  // Top opportunity audits (savings > 100 ms), capped at 5
  const opportunities = Object.values(audits)
    .filter((a) => a.details?.type === 'opportunity' && (a.numericValue ?? 0) > 100 && a.score < 1)
    .sort((a, b) => b.numericValue - a.numericValue)
    .slice(0, 5);

  for (const opp of opportunities) {
    const saving = opp.displayValue ? ` — ${opp.displayValue} potential saving` : '';
    findings.push(`Opportunity: ${opp.title}${saving}`);
  }

  const status = score >= 90 ? 'pass' : score >= 70 ? 'warn' : 'fail';
  return result(status, findings);
}

/** Fallback formatter when displayValue is absent */
function formatValue(value, unit) {
  if (unit === 'ms') return `${Math.round(value)} ms`;
  return String(Math.round(value * 100) / 100);
}

const CHECKS = [
  'Lighthouse performance score ≥ 90/100 (EDS target: 100)',
  'LCP (Largest Contentful Paint) ≤ 2500 ms',
  'CLS (Cumulative Layout Shift) ≤ 0.1',
  'TBT (Total Blocking Time) ≤ 200 ms',
  'FCP (First Contentful Paint) ≤ 1800 ms',
  'INP (Interaction to Next Paint) ≤ 200 ms',
  'Speed Index ≤ 3400 ms',
  'No high-impact render-blocking opportunities',
];

function result(status, findings) {
  return { id: 'performance', label: 'Performance', status, findings, checks: CHECKS };
}

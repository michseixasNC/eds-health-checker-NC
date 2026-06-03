/**
 * report/pdf.js
 *
 * Generates a downloadable PDF using jsPDF (window.jspdf global loaded from
 * lib/jspdf.umd.min.js). Clicking "Export PDF" triggers an immediate download
 * with no browser print dialog.
 *
 * Layout: A4 portrait — cover header, summary stats, one row per check result.
 */

// A4 dimensions in mm
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const MAX_Y = PAGE_H - 20; // bottom margin
const BODY_W = PAGE_W - MARGIN * 2; // 180 mm usable width

const COLOR = {
  pass: [26, 127, 55],
  warn: [154, 103, 0],
  fail: [207, 34, 46],
  primary: [26, 26, 46],
  muted: [87, 96, 106],
  rule: [210, 210, 210],
};

const BADGE = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' };
const STATUS_RANK = { fail: 2, warn: 1, pass: 0 };
const AI_ICON = { pass: '✓', warn: '⚠', fail: '✕' };

// Group definitions (mirrored from seo-summary.js)
const SPEED_GROUP = [
  { id: 'performance' },
  { id: 'lazy-loading' },
  { id: 'script-loading' },
  { id: 'fonts' },
  { id: 'inline-styles' },
];
const SEO_GROUP = [{ id: 'metadata' }, { id: 'sitemap' }, { id: 'structured-data' }, { id: 'headings' }];
const A11Y_GROUP = [
  { id: 'accessibility' },
  { id: 'viewport' },
  { id: 'lang' },
  { id: 'links' },
  { id: 'duplicate-ids' },
];
const EDS_GROUP = [{ id: 'blocks' }, { id: 'images' }, { id: 'redirect' }];
const AI_GROUP = [
  { id: 'ai-readiness', label: 'llms.txt & AI Crawlers' },
  { id: 'webmcp', label: 'WebMCP Agent Tools' },
  { id: 'structured-data', label: 'Structured Data (JSON-LD)' },
  { id: 'metadata', label: 'Open Graph Tags' },
];
const TILE_CATEGORIES = [
  { title: 'Speed', group: SPEED_GROUP },
  { title: 'SEO', group: SEO_GROUP },
  { title: 'Accessibility', group: A11Y_GROUP },
  { title: 'EDS Quality', group: EDS_GROUP },
  { title: 'AI Readiness', group: AI_GROUP },
];

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

function loadJsPdf() {
  if (window.jspdf) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load jsPDF'));
    document.head.appendChild(script);
  });
}

export async function exportPdf(results, url) {
  await loadJsPdf();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const timestamp = new Date().toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  let y = MARGIN;
  y = drawHeader(doc, url, timestamp, y);
  y = drawSummary(doc, results, y);
  y = drawOverview(doc, results, y);
  drawChecks(doc, results, y);

  doc.save(`eds-health-${safeHostname(url)}.pdf`);
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function drawHeader(doc, url, timestamp, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR.primary);
  doc.text('EDS Site Health Report', MARGIN, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.muted);
  doc.text(url, MARGIN, y);
  y += 5;
  doc.text(`Generated: ${timestamp}`, MARGIN, y);
  y += 6;

  return rule(doc, y);
}

function drawSummary(doc, results, y) {
  const counts = tally(results);
  const overall = counts.fail > 0 ? 'fail' : counts.warn > 0 ? 'warn' : 'pass';

  // Pass-rate line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLOR.primary);
  doc.text(`${counts.pass} of ${results.length} checks passed`, MARGIN, y);

  // Overall badge (right-aligned)
  doc.setFontSize(9);
  doc.setTextColor(...COLOR[overall]);
  doc.text(`OVERALL: ${BADGE[overall]}`, MARGIN + BODY_W, y, { align: 'right' });
  y += 6;

  // Per-status breakdown
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.muted);
  doc.text(`Pass: ${counts.pass}   Warn: ${counts.warn}   Fail: ${counts.fail}`, MARGIN, y);
  y += 6;

  return rule(doc, y);
}

function drawOverview(doc, results, y) {
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.muted);
  doc.text('SITE HEALTH OVERVIEW', MARGIN, y);
  y += 6;

  // One row per category tile
  for (const { title, group } of TILE_CATEGORIES) {
    if (y + 7 > MAX_Y) {
      doc.addPage();
      y = MARGIN;
    }

    const status = worstStatus(group, byId);
    const { passing, total } = countPassing(group, byId);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.primary);
    doc.text(title, MARGIN, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR[status]);
    doc.text(BADGE[status], MARGIN + 60, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.muted);
    doc.text(`${passing}/${total} pass`, MARGIN + BODY_W, y, { align: 'right' });

    y += 6;
  }

  y += 2;
  y = rule(doc, y);

  // AI / LLM Readiness detail strip
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.muted);
  doc.text('AI / LLM READINESS', MARGIN, y);
  y += 6;

  for (const { id, label } of AI_GROUP) {
    if (y + 5 > MAX_Y) {
      doc.addPage();
      y = MARGIN;
    }

    const r = byId[id];
    const status = r?.status ?? 'pass';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR[status]);
    doc.text(AI_ICON[status], MARGIN, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.primary);
    doc.text(label, MARGIN + 6, y);

    if (status !== 'pass' && r?.findings?.length) {
      const raw = r.findings[0];
      const hint = raw.length > 55 ? `${raw.slice(0, 52)}…` : raw;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLOR.muted);
      doc.text(hint, MARGIN + BODY_W, y, { align: 'right' });
    }

    y += 5;
  }

  return rule(doc, y);
}

function drawChecks(doc, results, startY) {
  // Section heading
  let y = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.muted);
  doc.text('CHECK RESULTS', MARGIN, y);
  y += 6;

  for (const result of results) {
    y = drawCheck(doc, result, y);
  }
}

function drawCheck(doc, result, y) {
  const color = COLOR[result.status];
  const badge = BADGE[result.status];
  const indent = MARGIN + 5;
  const wrapW = BODY_W - 5;

  // Page break if not enough space for at least the header row
  if (y + 10 > MAX_Y) {
    doc.addPage();
    y = MARGIN;
  }

  // Check name (left) + status badge (right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.primary);
  doc.text(result.label, MARGIN, y);

  doc.setFontSize(8);
  doc.setTextColor(...color);
  doc.text(badge, MARGIN + BODY_W, y, { align: 'right' });
  y += 5;

  // Findings
  if (result.findings.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.muted);

    for (const finding of result.findings) {
      if (y + 5 > MAX_Y) {
        doc.addPage();
        y = MARGIN;
      }
      const lines = doc.splitTextToSize(`• ${finding}`, wrapW);
      doc.text(lines, indent, y);
      y += lines.length * 4;
    }
  } else if (result.status === 'pass' && result.checks?.length) {
    if (y + 5 > MAX_Y) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.muted);
    doc.text(`${result.checks.length} criteria verified`, indent, y);
    y += 4;
  }

  return y + 3; // gap between checks
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function worstStatus(group, byId) {
  return group.reduce((worst, { id }) => {
    const s = byId[id]?.status ?? 'pass';
    return STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst;
  }, 'pass');
}

function countPassing(group, byId) {
  const passing = group.filter(({ id }) => (byId[id]?.status ?? 'pass') === 'pass').length;
  return { passing, total: group.length };
}

function rule(doc, y) {
  doc.setDrawColor(...COLOR.rule);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + BODY_W, y);
  return y + 6;
}

function tally(results) {
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'eds-health-report';
  }
}

const LS_KEY = 'eds-hc-run-history';
const MAX_RUNS = 10;

export function saveRun(url, results) {
  const all = load();
  const key = normalizeKey(url);
  const entry = {
    ts: Date.now(),
    checks: Object.fromEntries(results.map((r) => [r.id, r.status])),
  };
  all[key] = [entry, ...(all[key] ?? [])].slice(0, MAX_RUNS);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch {}
}

export function getHistory(url) {
  return load()[normalizeKey(url)] ?? [];
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function normalizeKey(url) {
  return url.replace(/\/$/, '').toLowerCase();
}

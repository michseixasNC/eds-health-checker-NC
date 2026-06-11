import { fetchRaw } from './fetch.js';

const MAX_CRAWL_URLS = 30;

/**
 * Fetch the sitemap for the given site URL and return up to 30 page URLs.
 * Follows one level of sitemapindex child sitemaps sequentially so we don't
 * hammer the proxy with parallel requests.
 * @param {string} url  Any URL on the target site — only the origin is used.
 * @returns {Promise<string[]>}
 */
export async function getSitemapUrls(url) {
  const origin = new URL(url).origin;
  const res = await fetchRaw(`${origin}/sitemap.xml`);
  if (!res.ok) throw new Error(`No sitemap found at ${origin}/sitemap.xml`);
  return parseUrls(res.body, origin);
}

async function parseUrls(xml, origin) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Sitemap is not valid XML');

  const rootName = doc.documentElement.localName.toLowerCase();
  const locs = [...doc.querySelectorAll('loc')].map((node) => node.textContent.trim());

  if (rootName === 'sitemapindex') {
    const collected = [];
    for (const childUrl of locs) {
      if (collected.length >= MAX_CRAWL_URLS) break;
      // eslint-disable-next-line no-await-in-loop
      const childRes = await fetchRaw(childUrl);
      if (childRes.ok) {
        const childDoc = new DOMParser().parseFromString(childRes.body, 'application/xml');
        const childLocs = [...childDoc.querySelectorAll('loc')].map((n) => n.textContent.trim());
        collected.push(...childLocs);
      }
    }
    return collected.slice(0, MAX_CRAWL_URLS);
  }

  return locs
    .filter((loc) => {
      try {
        return new URL(loc).origin === origin;
      } catch {
        return false;
      }
    })
    .slice(0, MAX_CRAWL_URLS);
}

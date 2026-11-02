/** The journal currently supports linking to the author's original LinkedIn articles. */
export function isLinkedInArticleUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && ['linkedin.com', 'www.linkedin.com', 'fr.linkedin.com'].includes(url.hostname)
      && /^\/pulse\/[^/]+\/?$/.test(url.pathname);
  } catch { return false; }
}

// This entry is compiled separately by scripts/cms-preview-build.mjs.
// Do not import it in an Astro component: doing so hoists editor styles publicly.
import { enableVisualEditing } from '@sanity/visual-editing/enable-visual-editing';
import './preview-client.css';

const marker = document.querySelector<HTMLElement>('[data-calas-preview]');
if (marker) {
  try {
    const disable = enableVisualEditing({
      history: {
        subscribe(navigate) {
          const sync = () => navigate({ type: 'push', title: document.title, url: window.location.pathname + window.location.search + window.location.hash });
          sync();
          window.addEventListener('popstate', sync);
          window.addEventListener('hashchange', sync);
          return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); };
        },
        update(update) {
          if (update.type === 'pop') { window.history.back(); return; }
          const target = new URL(update.url, window.location.origin);
          if (target.origin !== window.location.origin || target.pathname.startsWith('/api/')) return;
          if (target.href !== window.location.href) {
            if (update.type === 'replace') window.location.replace(target.href);
            else window.location.assign(target.href);
          }
        },
      },
      refresh: async () => { window.location.reload(); },
    });
    window.addEventListener('pagehide', disable, { once: true });
  } catch {
    const status = marker.querySelector('[data-preview-status]');
    if (status) status.textContent = 'Prévisualisation privée — rechargez la page pour rétablir l’édition visuelle.';
  }
}

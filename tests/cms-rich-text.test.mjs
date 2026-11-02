import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = await build({ absWorkingDir: root, entryPoints: ['apps/web/src/lib/cms/rich-text.ts'], bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent' });
const { renderRichText } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const document = (...nodes) => ({ type: 'doc', content: nodes });
const paragraph = (...nodes) => ({ type: 'paragraph', content: nodes });

test('le texte et les attributs éditoriaux ne deviennent jamais du HTML exécutable', () => {
  const html = renderRichText(document(paragraph(text('<script>alert("x")</script> & \'citation\''))));
  assert.equal(html, '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;citation&#39;</p>');
  assert.doesNotMatch(html, /<script/i);
});

test('titres, listes imbriquées, citations, emphase et sauts conservent leur structure', () => {
  const html = renderRichText(document(
    { type: 'heading', attrs: { level: 2 }, content: [text('Un titre')] },
    { type: 'heading', attrs: { level: 3 }, content: [text('Un sous-titre')] },
    { type: 'orderedList', attrs: { start: 4 }, content: [{ type: 'listItem', content: [paragraph(text('Un point', [{ type: 'bold' }])), { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('Détail', [{ type: 'italic' }]))] }] }] }] },
    { type: 'blockquote', content: [paragraph(text('Citation'), { type: 'hardBreak' }, text('Suite'))] },
    { type: 'horizontalRule' },
    { type: 'codeBlock', content: [text('<div>exemple</div>')] },
  ));
  assert.equal(html, '<h2>Un titre</h2><h3>Un sous-titre</h3><ol start="4"><li><p><strong>Un point</strong></p><ul><li><p><em>Détail</em></p></li></ul></li></ol><blockquote><p>Citation<br>Suite</p></blockquote><hr><pre><code>&lt;div&gt;exemple&lt;/div&gt;</code></pre>');
});

test('liens actifs refusés et liens externes protégés sans HTML arbitraire', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:alert(1)', '//attacker.example/', '/\\attacker.example/', 'https://example.test/\nmalformed']) {
    assert.equal(renderRichText(document(paragraph(text('Lien', [{ type: 'link', attrs: { href } }])))), '<p>Lien</p>');
  }
  const safe = renderRichText(document(paragraph(text('La source', [{ type: 'link', attrs: { href: 'https://example.test/?q="test"&x=1', target: '_self', onclick: 'alert(1)' } }]))));
  assert.equal(safe, '<p><a href="https://example.test/?q=&quot;test&quot;&amp;x=1" rel="noopener noreferrer">La source</a></p>');
  assert.equal(renderRichText(document(paragraph(text('Contact', [{ type: 'link', attrs: { href: '/contact/?objet=equipes' } }])))), '<p><a href="/contact/?objet=equipes">Contact</a></p>');
});

test('les images utilisent exclusivement une URL média locale et échappent leur alternative', () => {
  const mediaId = 'cbd6963c-6dd7-4456-85f3-27bde1a6c767';
  const html = renderRichText(document({ type: 'image', attrs: { mediaId, alt: '" onerror="alert(1)', src: 'https://attacker.example/track', onerror: 'alert(1)' } }));
  assert.equal(html, `<figure><img src="/media/${mediaId}/?w=960" alt="&quot; onerror=&quot;alert(1)" loading="lazy" decoding="async"></figure>`);
  assert.doesNotMatch(html, /attacker\.example/);
  for (const invalidId of ['../../secrets', 'javascript:alert(1)', '', undefined]) assert.equal(renderRichText(document({ type: 'image', attrs: { mediaId: invalidId, src: '/arbitrary.png' } })), '');
});

test('les nœuds et marques inconnus, y compris les propriétés héritées, sont ignorés', () => {
  for (const type of ['script', 'iframe', 'html', 'constructor', '__proto__', 'toString']) {
    assert.equal(renderRichText(document({ type, attrs: { src: 'https://attacker.example' }, content: [text('Unsafe')] })), '');
    assert.equal(renderRichText(document(paragraph(text('Texte', [{ type }])))), '<p>Texte</p>');
  }
  assert.equal(renderRichText({ type: 'html', content: [text('Invalid root')] }), '');
  assert.equal(renderRichText(undefined), '');
});

test('le renderer borne la profondeur et la taille pour une source corrompue', () => {
  let nested = paragraph(text('Too deep'));
  for (let index = 0; index < 40; index++) nested = { type: 'blockquote', content: [nested] };
  const html = renderRichText(document(nested));
  assert.ok(html.length < 1000);
  assert.doesNotMatch(html, /Too deep/);
  const many = renderRichText(document(paragraph(...Array.from({ length: 50_050 }, () => text('x')))));
  assert.ok(many.length < 50_010);
  assert.ok(many.startsWith('<p>') && many.endsWith('</p>'));
});

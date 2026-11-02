import type { RichDocument, RichNode, ContentImage } from '../../lib/cms/types';

type LegacyObject = Record<string, unknown>;
export interface RichTextConversion { document: RichDocument; warnings: string[] }
const record = (value: unknown): LegacyObject | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as LegacyObject : undefined;

/** Import-only adapter. Unsupported source elements remain visible in the report. */
export function convertPortableText(value: unknown, resolveImage: (reference: string) => ContentImage | undefined = () => undefined): RichTextConversion {
  const warnings: string[] = [];
  const content: RichNode[] = [];
  if (!Array.isArray(value)) return { document: { type: 'doc', content: [] }, warnings: ['Le contenu source n’est pas une liste de blocs.'] };
  const lists: Array<{ level: number; style: string; node: RichNode; lastItem: RichNode }> = [];
  const append = (node: RichNode, block: LegacyObject) => {
    if (!block.listItem) { lists.length = 0; content.push(node); return; }
    const style = block.listItem === 'number' ? 'orderedList' : 'bulletList';
    if (!['number', 'bullet'].includes(String(block.listItem))) warnings.push(`Type de liste « ${block.listItem} » converti en liste à puces.`);
    const requested = Number(block.level || 1);
    const level = Math.min(Math.max(Number.isInteger(requested) ? requested : 1, 1), 8);
    while (lists.length && (lists.at(-1)!.level > level || lists.at(-1)!.level === level && lists.at(-1)!.style !== style)) lists.pop();
    let current = lists.at(-1);
    if (!current || current.level < level) {
      const list: RichNode = { type: style, content: [] };
      if (current) (current.lastItem.content ||= []).push(list); else content.push(list);
      current = { level, style, node: list, lastItem: { type: 'listItem', content: [] } };
      lists.push(current);
    }
    const item: RichNode = { type: 'listItem', content: [node] };
    (current.node.content ||= []).push(item);
    current.lastItem = item;
  };
  value.forEach((raw, index) => {
    const block = record(raw);
    if (!block) { warnings.push(`Bloc ${index + 1} invalide ignoré.`); return; }
    if (block._type === 'image' || block._type === 'contentImage') {
      lists.length = 0;
      const asset = record(block.asset);
      const reference = String(asset?._ref || asset?._id || '');
      const image = resolveImage(reference);
      if (image) content.push({ type: 'image', attrs: { mediaId: image.mediaId, src: `/media/${image.mediaId}/`, alt: String(block.alt || image.alt), title: null } });
      else { warnings.push(`Image du bloc ${index + 1} non importée : la référence doit être raccordée à un média.`); content.push({ type: 'paragraph', content: [{ type: 'text', text: '[Image à réimporter depuis le document source]' }] }); }
      return;
    }
    if (block._type !== 'block') { warnings.push(`Bloc ${index + 1} de type « ${String(block._type)} » non reconnu ; vérification du document source nécessaire.`); return; }
    const definitions = Array.isArray(block.markDefs) ? block.markDefs.map(record).filter((definition): definition is LegacyObject => Boolean(definition)) : [];
    const inline: RichNode[] = [];
    for (const rawSpan of Array.isArray(block.children) ? block.children : []) {
      const span = record(rawSpan);
      if (!span || span._type !== 'span' || typeof span.text !== 'string') { warnings.push(`Élément inline non reconnu dans le bloc ${index + 1}.`); continue; }
      const marks: NonNullable<RichNode['marks']> = [];
      for (const name of Array.isArray(span.marks) ? span.marks : []) {
        const builtin = ({ strong: 'bold', em: 'italic', underline: 'underline', 'strike-through': 'strike', code: 'code' } as const)[String(name) as 'strong' | 'em' | 'underline' | 'strike-through' | 'code'];
        if (builtin) { marks.push({ type: builtin }); continue; }
        const definition = definitions.find(def => def._key === name);
        if (definition?._type === 'link' && typeof definition.href === 'string') marks.push({ type: 'link', attrs: { href: definition.href, target: '_self' } });
        else warnings.push(`Marque « ${String(name)} » non reconnue dans le bloc ${index + 1}.`);
      }
      if (span.text) inline.push({ type: 'text', text: span.text, ...(marks.length ? { marks } : {}) });
    }
    const style = String(block.style || 'normal');
    let node: RichNode;
    if (/^h[1-6]$/.test(style)) {
      const level = Number(style.slice(1));
      if (![2, 3].includes(level)) warnings.push(`Titre ${style.toUpperCase()} du bloc ${index + 1} adapté au niveau ${level < 2 ? 'H2' : 'H3'}.`);
      node = { type: 'heading', attrs: { level: level < 2 ? 2 : Math.min(level, 3) }, content: inline };
    } else if (style === 'blockquote') node = { type: 'blockquote', content: [{ type: 'paragraph', content: inline }] };
    else { if (style !== 'normal') warnings.push(`Style « ${style} » du bloc ${index + 1} converti en paragraphe.`); node = { type: 'paragraph', content: inline }; }
    append(node, block);
  });
  return { document: { type: 'doc', content }, warnings: [...new Set(warnings)] };
}

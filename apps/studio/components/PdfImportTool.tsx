import { useEffect, useRef, useState } from 'react';
import { useClient } from 'sanity';
import { useRouter } from 'sanity/router';
import type { PdfImportResult, PdfImportProgress } from '../lib/pdf-import.types';
import { buildPdfDraft } from '../lib/pdf-draft';

type Phase = 'idle' | 'analyzing' | 'ready' | 'saving' | 'saved';

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'L’opération n’a pas abouti. Vous pouvez réessayer.';
const blockText = (block: PdfImportResult['blocks'][number]) => Array.isArray(block.children)
  ? block.children.map((child: unknown) => child && typeof child === 'object' && 'text' in child && typeof child.text === 'string' ? child.text : '').join('') : '';

export function PdfImportTool() {
  const client = useClient({ apiVersion: '2026-10-25' });
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<File>();
  const [analysis, setAnalysis] = useState<PdfImportResult>();
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [progress, setProgress] = useState<PdfImportProgress>({ message: '' });
  const [error, setError] = useState('');
  const controller = useRef<AbortController | undefined>(undefined);
  const operation = useRef(0);
  const saving = useRef(false);
  const draftId = useRef<string | undefined>(undefined);
  const uploadedAsset = useRef<string | undefined>(undefined);
  const draftSnapshot = useRef<ReturnType<typeof buildPdfDraft> | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const readyHeading = useRef<HTMLHeadingElement>(null);
  const savedHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => { operation.current += 1; controller.current?.abort(); }, []);
  useEffect(() => { if (phase === 'ready') readyHeading.current?.focus(); if (phase === 'saved') savedHeading.current?.focus(); }, [phase]);

  function reset() {
    if (saving.current) return;
    operation.current += 1;
    controller.current?.abort();
    setFile(undefined); setAnalysis(undefined); setTitle(''); setExcerpt(''); setError(''); setProgress({ message: '' }); setPhase('idle');
    draftId.current = undefined; uploadedAsset.current = undefined; draftSnapshot.current = undefined;
    if (fileInput.current) { fileInput.current.value = ''; fileInput.current.focus(); }
  }

  async function selectFile(selected?: File, forceOcr = false) {
    if (!selected || saving.current || (forceOcr && draftSnapshot.current)) return;
    const retainedTitle = forceOcr && analysis && title !== analysis.title ? title : undefined;
    const retainedExcerpt = forceOcr && analysis && excerpt !== analysis.excerpt ? excerpt : undefined;
    controller.current?.abort();
    const current = ++operation.current;
    const abort = new AbortController();
    controller.current = abort;
    setFile(selected); setAnalysis(undefined); setTitle(''); setExcerpt(''); setError('');
    draftId.current = undefined; uploadedAsset.current = undefined; draftSnapshot.current = undefined;
    setPhase('analyzing'); setProgress({ message: 'Lecture du PDF sur votre ordinateur…' });
    try {
      const { analyzePdf: analyze } = await import('../lib/pdf-import');
      if (abort.signal.aborted) return;
      const result = await analyze(selected, { signal: abort.signal, forceOcr, onProgress: next => { if (operation.current === current && !abort.signal.aborted) setProgress(next); } });
      if (operation.current !== current || abort.signal.aborted) return;
      setAnalysis(result); setTitle(retainedTitle ?? result.title); setExcerpt(retainedExcerpt ?? result.excerpt); setPhase('ready');
      setProgress({ message: 'Analyse terminée. Le PDF n’a pas été envoyé à Sanity.' });
    } catch (cause) {
      if (operation.current !== current || abort.signal.aborted) return;
      setError(errorMessage(cause)); setPhase('idle'); setProgress({ message: '' });
    }
  }

  async function createDraft() {
    if (saving.current || !analysis || !file || !title.trim() || title.length > 220 || excerpt.length > 500) return;
    saving.current = true; setPhase('saving'); setError('');
    const id = draftId.current ?? `drafts.${crypto.randomUUID()}`;
    draftId.current = id;
    try {
      setProgress({ message: uploadedAsset.current ? 'Création du brouillon…' : 'Envoi du PDF à Sanity…' });
      if (!uploadedAsset.current) {
        const asset = await client.assets.upload('file', file, { filename: file.name, contentType: 'application/pdf' });
        uploadedAsset.current = asset._id;
      }
      setProgress({ message: 'Création du brouillon…' });
      // A stable UUID is retained across retries. Never patch or replace an existing article.
      draftSnapshot.current ??= buildPdfDraft({ id, assetId: uploadedAsset.current, title, excerpt, analysis });
      await client.createIfNotExists(draftSnapshot.current);
      setPhase('saved'); setProgress({ message: 'Brouillon créé. L’article n’est pas publié.' });
    } catch {
      setPhase('ready');
      setProgress({ message: 'Enregistrement non confirmé.' });
      setError(uploadedAsset.current
        ? 'Le PDF a été envoyé, mais la création du brouillon n’a pas pu être confirmée. Réessayez : le même identifiant sera conservé pour éviter un doublon.'
        : 'L’envoi n’a pas pu être confirmé. Vérifiez votre connexion et vos droits dans le Studio, puis réessayez.');
    } finally { saving.current = false; }
  }

  const valid = title.trim().length > 0 && title.length <= 220 && excerpt.length <= 500;
  return <main className="pdf-import-tool">
    <style>{styles}</style>
    <header><p className="pdf-kicker">Calas Conseil · Réflexions</p><h1>Importer un PDF</h1><p>Transformez votre document en article modifiable, avec son PDF à télécharger. Les pages scannées passent automatiquement par une reconnaissance de caractères.</p></header>
    <section className="pdf-panel" aria-labelledby="pdf-file-label">
      <h2 id="pdf-file-label">1. Choisir le document</h2>
      <label htmlFor="pdf-import-file">Fichier PDF — 20 Mo et 40 pages maximum</label>
      <input ref={fileInput} id="pdf-import-file" type="file" accept="application/pdf,.pdf" disabled={phase === 'saving'} onChange={event => void selectFile(event.currentTarget.files?.[0])} aria-describedby="pdf-local-note" />
      <p id="pdf-local-note" className="pdf-help">L’analyse se fait dans votre navigateur. Aucun document n’est envoyé à Sanity avant le bouton « Créer le brouillon ».</p>
      {file && <p className="pdf-filename">{file.name} · {file.size < 1_000_000 ? `${Math.max(1,Math.round(file.size/1000)).toLocaleString('fr-FR')} ko` : `${(file.size/1_000_000).toLocaleString('fr-FR',{maximumFractionDigits:1})} Mo`}</p>}
      {file && phase === 'idle' && <div className="pdf-actions"><button type="button" onClick={() => void selectFile(file)}>Réessayer l’analyse</button><button type="button" className="pdf-secondary" onClick={reset}>Effacer la sélection</button></div>}
      {phase === 'analyzing' && <div aria-busy="true"><progress max={100} value={progress.percent} aria-label="Progression de l’analyse" /><button type="button" className="pdf-secondary" onClick={reset}>Annuler l’analyse</button></div>}
    </section>
    <p className="pdf-status" role="status" aria-live="polite">{progress.message}</p>
    {error && <p className="pdf-error" role="alert">{error}</p>}
    {analysis && phase !== 'saved' && <section className="pdf-panel" aria-labelledby="pdf-preview-title" aria-busy={phase === 'saving'}>
      <h2 id="pdf-preview-title" ref={readyHeading} tabIndex={-1}>2. Vérifier le résultat</h2>
      <p>{analysis.pageCount} page{analysis.pageCount > 1 ? 's' : ''} analysée{analysis.pageCount > 1 ? 's' : ''} · {analysis.ocrPages} en reconnaissance de caractères</p>
      {!!analysis.warnings.length && <aside className="pdf-warnings" aria-label="Points à relire"><ul>{analysis.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></aside>}
      <p className="pdf-help">Du texte manque dans l’aperçu ? Une page peut mélanger texte et zones scannées. Relancez la reconnaissance sur toutes les pages.</p>
      <button type="button" className="pdf-secondary" onClick={() => void selectFile(file, true)} disabled={phase === 'saving' || !!draftSnapshot.current}>Refaire avec reconnaissance complète</button>
      {draftSnapshot.current && phase === 'ready' && <p className="pdf-help">Une création a déjà été tentée. Le titre et le résumé sont conservés pour la reprise ; vous pourrez les modifier en ouvrant le brouillon.</p>}
      <label htmlFor="pdf-import-title">Titre de l’article</label><input id="pdf-import-title" value={title} onChange={event => setTitle(event.currentTarget.value)} maxLength={220} disabled={phase === 'saving' || !!draftSnapshot.current} />
      <label htmlFor="pdf-import-excerpt">Résumé — extrait du début du document, à ajuster</label><textarea id="pdf-import-excerpt" value={excerpt} onChange={event => setExcerpt(event.currentTarget.value)} maxLength={500} rows={4} disabled={phase === 'saving' || !!draftSnapshot.current} />
      <h3>Aperçu du texte extrait</h3><div className="pdf-text-preview" tabIndex={0} role="region" aria-label="Texte extrait du PDF">{analysis.blocks.map((block, index) => <p key={block._key ?? index}>{blockText(block)}</p>)}</div>
      <p className="pdf-help">Les paragraphes et titres seront modifiables dans l’éditeur. L’auteure et la date restent à renseigner. Une relecture du texte sera nécessaire avant publication.</p>
      <p className="pdf-upload-note"><strong>PDF destiné à la publication uniquement.</strong> Après l’envoi, toute personne ayant son lien Sanity pourra ouvrir le fichier, même si l’article reste en brouillon.</p>
      <div className="pdf-actions"><button type="button" onClick={() => void createDraft()} disabled={!valid || phase === 'saving'}>{phase === 'saving' ? 'Enregistrement…' : uploadedAsset.current ? 'Réessayer la création du brouillon' : 'Créer le brouillon'}</button><button type="button" className="pdf-secondary" onClick={reset} disabled={phase === 'saving'}>Choisir un autre document</button></div>
    </section>}
    {phase === 'saved' && <section className="pdf-panel" aria-labelledby="pdf-saved-title"><h2 id="pdf-saved-title" ref={savedHeading} tabIndex={-1}>Votre article est prêt à relire.</h2><p>Le texte et le PDF ont été enregistrés dans un nouveau brouillon. Ouvrez-le pour corriger la mise en forme, choisir l’auteure, renseigner la date et confirmer la relecture. Rien n’a été publié.</p><div className="pdf-actions"><button type="button" onClick={() => router.navigateIntent('edit', { id: draftId.current!.replace(/^drafts\./, ''), type: 'article' })}>Ouvrir le brouillon</button><button type="button" className="pdf-secondary" onClick={reset}>Importer un autre PDF</button></div></section>}
  </main>;
}

const styles = `.pdf-import-tool{box-sizing:border-box;max-width:960px;margin:auto;padding:36px 24px 80px;color:inherit;font:inherit}.pdf-import-tool *{box-sizing:border-box}.pdf-import-tool header{margin-bottom:30px}.pdf-import-tool h1{font-size:32px;line-height:1.2;margin:12px 0 18px}.pdf-import-tool h2{font-size:22px;line-height:1.35;margin:0 0 20px}.pdf-import-tool h3{font-size:17px;margin:28px 0 12px}.pdf-import-tool p,.pdf-import-tool li{font-size:15px;line-height:1.6}.pdf-kicker{font-size:12px!important;text-transform:uppercase;letter-spacing:.12em}.pdf-panel{padding:26px;border:1px solid #8b8f98;border-radius:8px;margin-top:20px}.pdf-import-tool label{display:block;font-size:14px;font-weight:600;margin:22px 0 8px}.pdf-import-tool input:not([type=file]),.pdf-import-tool textarea{display:block;width:100%;font:inherit;color:inherit;background:transparent;border:1px solid #8b8f98;border-radius:4px;padding:12px}.pdf-import-tool input[type=file]{font:inherit;max-width:100%;padding:8px 0}.pdf-import-tool button{min-height:44px;padding:11px 18px;border:1px solid #4763ba;border-radius:5px;background:#244aab;color:#fff;font:600 14px/1.5 Arial,sans-serif;cursor:pointer}.pdf-import-tool .pdf-secondary{background:transparent;color:inherit;border-color:#8b8f98}.pdf-import-tool button:disabled{opacity:.55;cursor:default}.pdf-import-tool :focus-visible{outline:3px solid #8d9ee0;outline-offset:4px}.pdf-import-tool h2:focus{outline-offset:8px}.pdf-actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:24px}.pdf-import-tool progress{display:block;width:100%;margin:20px 0;height:10px;accent-color:#4763ba}.pdf-help{font-size:13px!important}.pdf-filename{overflow-wrap:anywhere}.pdf-status:empty{display:none}.pdf-error{border-left:4px solid #c74141;padding:12px 16px}.pdf-warnings,.pdf-upload-note{border-left:3px solid #aa8143;padding:12px 18px;margin:20px 0}.pdf-warnings ul{margin:0;padding-left:20px}.pdf-text-preview{max-height:360px;overflow:auto;white-space:pre-wrap;padding:16px 20px;border:1px solid #8b8f98;border-radius:4px;overflow-wrap:anywhere}.pdf-text-preview p:first-child{margin-top:0}.pdf-text-preview p:last-child{margin-bottom:0}@media(max-width:600px){.pdf-import-tool{padding:24px 14px 60px}.pdf-panel{padding:20px 16px}.pdf-actions{display:grid}.pdf-import-tool h1{font-size:28px}}`;

import { useEffect, useState } from 'react';
import { Activity, DatabaseBackup, Mail, RefreshCw } from 'lucide-react';
import type { OperationsStatus as Status } from '../lib/operations-status';
import { request } from './api';
import { Button } from './ui';
import './operations-status.css';

const date = (value: string | null) => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(value)) + ' (Paris)' : 'Aucune confirmation enregistrée';
const backupLabel: Record<Status['backup']['status'], string> = { ok: 'Sauvegarde à jour', late: 'Sauvegarde attendue manquante', error: 'Dernière tentative en échec', unknown: 'État indisponible', unconfigured: 'Suivi à raccorder' };

export function OperationsStatus() {
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    request<Status>('/api/admin/operations/', { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) setData(value);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Le contrôle est momentanément indisponible.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  return <section className="operations-panel" aria-labelledby="operations-heading" aria-busy={loading}>
    <div className="operations-heading">
      <div><h2 id="operations-heading">État du site et des sauvegardes</h2><p>Des contrôles techniques pour suivre l’exploitation au quotidien.</p></div>
      <Button variant="secondary" size="sm" loading={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} /> Vérifier maintenant</Button>
    </div>
    {error && <p className="admin-error" role="alert">{error} {data && 'Les résultats ci-dessous datent du dernier contrôle réussi.'}</p>}
    {!data && loading && <p role="status">Contrôle du site, de la sauvegarde et des envois…</p>}
    {data && <>
      <div className="operations-grid">
        <article data-status={data.site.status}>
          <Activity size={21} aria-hidden /><h3>Site public</h3>
          <strong>{data.site.status === 'ok' ? 'Disponible' : 'Contrôle en échec'}</strong>
          <p>{data.site.status === 'ok' ? 'L’accueil, la base de données et les médias répondent.' : 'L’accueil ou ses services ne répondent pas correctement. Prévenir Paul si le problème persiste.'}</p>
          <small>Vérifié le {date(data.site.checkedAt)}</small>
        </article>
        <article data-status={data.backup.status}>
          <DatabaseBackup size={21} aria-hidden /><h3>Sauvegarde quotidienne</h3>
          <strong>{backupLabel[data.backup.status]}</strong>
          <p>Dernière capture : {date(data.backup.capturedAt)}.</p>
          {data.backup.verifiedAt && <small>Archive vérifiée le {date(data.backup.verifiedAt)}</small>}
          {data.backup.status === 'late' && <small>Une capture du {new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' }).format(new Date(data.backup.expectedDay + 'T12:00:00Z'))} UTC est attendue.</small>}
          {data.backup.status === 'error' && <small>Échec signalé le {date(data.backup.failedAt)}</small>}
          {['unknown', 'unconfigured'].includes(data.backup.status) && <small>La lecture du suivi n’a pas confirmé l’état de la sauvegarde.</small>}
        </article>
        <article data-status={data.mail.failed24h || data.mail.uncertain ? 'error' : 'neutral'}>
          <Mail size={21} aria-hidden /><h3>Envois de campagnes</h3>
          <strong>{data.mail.mode === 'smtp' ? data.mail.configured ? 'Envoi réel configuré' : 'Configuration incomplète' : data.mail.mode === 'simulation' ? 'Simulation, aucun mail envoyé' : data.mail.mode === 'local' ? 'Messagerie de recette locale' : 'Mode indisponible'}</strong>
          <p>Dernier mail accepté par le serveur : {date(data.mail.lastAcceptedAt)}.</p>
          <small>{data.mail.failed24h === null ? 'Historique momentanément indisponible.' : `${data.mail.failed24h} échec(s) sur 24 h · ${data.mail.uncertain} envoi(s) à vérifier.`}</small>
          <a href="/admin/outreach/?tab=history">Consulter les envois</a>
        </article>
      </div>
      <div className="operations-note">
        <p>Traitement des campagnes : <strong>{data.mail.workerEnabled ? 'activé' : 'désactivé'}</strong>{data.mail.waiting === null ? '' : ` · ${data.mail.waiting} envoi(s) en attente ou en cours.`}</p>
        <p>Une acceptation par le serveur mail ne confirme pas l’arrivée en boîte principale. Les contrôles et sauvegardes sont hébergés sur Railway ; une panne complète du fournisseur peut aussi interrompre les alertes.</p>
        <small>Dernière lecture : {date(data.checkedAt)}. Ce contrôle ne déclenche aucun envoi ni sauvegarde.</small>
      </div>
    </>}
  </section>;
}

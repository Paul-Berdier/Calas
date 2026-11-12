const parisParts = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Resolve a Paris wall-clock time, independently of the operator's browser timezone. */
export function parisScheduleCandidates(value: string): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return [];
  const [, year, month, day, hour, minute] = match.map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  if (!Number.isFinite(wallClock) || new Date(wallClock).toISOString().slice(0, 16) !== value) return [];
  return [2, 1].map(offset => new Date(wallClock - offset * 3_600_000))
    .filter(date => parisParts.format(date).replace(' ', 'T') === value)
    .map(date => date.toISOString());
}

export function validateScheduledAt(iso: string, now = Date.now()): string {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at) || at <= now) return 'Choisissez une date et une heure futures.';
  if (at > now + 366 * 86_400_000) return 'La programmation est limitée aux 366 prochains jours.';
  return '';
}

export function formatParisSchedule(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short',
  }).format(new Date(iso)) + ' (Paris)';
}

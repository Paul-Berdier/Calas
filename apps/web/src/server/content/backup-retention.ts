export const dailyName = /^calas-daily-(\d{4}-\d{2}-\d{2})\.calas-backup$/;

export function parisDay(date: Date) {
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Keep the newest capture in each of the most recent distinct weeks and months, in addition to daily copies. */
export function expiredDailyArchives(files: string[]): string[] {
  const entries = files.flatMap(name => {
    const day = dailyName.exec(name)?.[1];
    if (!day) return [];
    const date = new Date(day + 'T00:00:00Z');
    if (Number.isNaN(+date) || date.toISOString().slice(0, 10) !== day) return [];
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    return [{ name, week: date.toISOString().slice(0, 10), month: day.slice(0, 7) }];
  }).sort((a, b) => b.name.localeCompare(a.name));
  const keep = new Set(entries.slice(0, 30).map(entry => entry.name));
  for (const key of ['week', 'month'] as const) {
    const seen = new Set<string>();
    for (const entry of entries) {
      if (seen.has(entry[key])) continue;
      seen.add(entry[key]);
      keep.add(entry.name);
      if (seen.size === 12) break;
    }
  }
  return entries.filter(entry => !keep.has(entry.name)).map(entry => entry.name);
}

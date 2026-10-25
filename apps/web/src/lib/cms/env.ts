/** Server-only configuration. Never import this module from a client script. */
export function serverEnv(name: string): string {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined> | undefined)?.[name] ?? '';
}
export function contentMode(): 'demo' | 'sanity' {
  const mode = serverEnv('CONTENT_MODE');
  if (mode !== 'demo' && mode !== 'sanity') throw new Error('CONTENT_MODE must explicitly be demo or sanity.');
  return mode;
}

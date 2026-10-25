export function env(name: string, fallback = ''): string {
  return process.env[name] ?? (import.meta.env?.[name] as string | undefined) ?? fallback;
}
export const isProductionSite = () => env('SITE_ENV','development') === 'production';
export const isDemoSite = () => env('CONTENT_MODE') === 'demo';

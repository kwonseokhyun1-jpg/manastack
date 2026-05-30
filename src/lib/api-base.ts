/** API origin; empty string = same origin (Vite proxy in dev, Worker in production). */
export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
  if (!base) return path
  return `${base.replace(/\/$/, '')}${path}`
}

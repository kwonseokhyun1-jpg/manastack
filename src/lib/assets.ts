/** Resolve a public asset path against Vite base. */
export function assetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL
  const path = relativePath.replace(/^\//, '')
  return `${base}${path}`
}

export async function fetchJsonAsset<T>(relativePath: string, label: string): Promise<T> {
  const url = assetUrl(relativePath)

  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(
        `${label} not found (${res.status}). Link card data with npm run ensure-data.`,
      )
    }
    return (await res.json()) as T
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) throw err
    if (err instanceof TypeError || (err instanceof Error && /failed to fetch/i.test(err.message))) {
      throw new Error(
        `Network error loading ${label}. Check your connection and refresh the page.`,
      )
    }
    throw err
  }
}

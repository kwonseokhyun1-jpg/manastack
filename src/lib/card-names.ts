export function canonicalCardName(name: string): string {
  const trimmed = name.trim()
  const parts = trimmed.split(/\s*\/\/\s*/)
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0].trim()
  }
  return trimmed
}

export function canonicalNameKey(name: string): string {
  return canonicalCardName(name).toLowerCase()
}

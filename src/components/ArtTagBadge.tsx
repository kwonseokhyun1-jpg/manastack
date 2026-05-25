function textColorForAccent(accent: string): string {
  const hex = accent.replace('#', '')
  if (hex.length !== 6) return '#fff'

  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return luminance > 0.62 ? '#0d1117' : '#f8fafc'
}

export function ArtTagBadge({ accent, tag }: { accent: string; tag: string }) {
  const text = textColorForAccent(accent)

  return (
    <span
      className="absolute left-3 top-3 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-[2px]"
      style={{
        borderColor: `${accent}dd`,
        backgroundColor: accent,
        color: text,
        boxShadow: `0 4px 14px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
      }}
    >
      {tag}
    </span>
  )
}

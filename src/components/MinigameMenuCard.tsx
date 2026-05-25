import { MINIGAME_ART, type MinigameArtId } from '../lib/minigame-art'

type GameEntry = {
  id: MinigameArtId
  title: string
  description: string
}

export function MinigameMenuCard({
  game,
  onSelect,
}: {
  game: GameEntry
  onSelect: () => void
}) {
  const art = MINIGAME_ART[game.id]

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative overflow-hidden rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] text-left transition hover:border-[var(--color-mtg-gold-dim)] hover:shadow-[0_0_24px_-4px_var(--glow-color)]"
      style={{ ['--glow-color' as string]: `${art.accent}66` }}
    >
      <div className="relative h-36 overflow-hidden">
        <img
          src={art.image}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          style={{ objectPosition: art.focal }}
        />
        <div
          className="absolute inset-0 opacity-40 mix-blend-color"
          style={{
            background: `linear-gradient(135deg, ${art.accent}88 0%, transparent 60%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-mtg-panel)] via-[var(--color-mtg-panel)]/40 to-black/20" />
        <span
          className="absolute left-3 top-3 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm"
          style={{
            borderColor: `${art.accent}99`,
            backgroundColor: `${art.accent}22`,
            color: art.accent,
          }}
        >
          {art.tag}
        </span>
      </div>

      <div className="relative p-4 pt-3">
        <div
          className="absolute left-4 top-0 h-0.5 w-10 rounded-full transition-all duration-300 group-hover:w-16"
          style={{ backgroundColor: art.accent }}
        />
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
          {game.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-mtg-muted)]">
          {game.description}
        </p>
      </div>
    </button>
  )
}

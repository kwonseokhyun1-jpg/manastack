import { useState } from 'react'
import { MinigameMenuCard } from '../components/MinigameMenuCard'
import type { MinigameArtId } from '../lib/minigame-art'
import { ArtGuessGame } from './ArtGuessGame'
import { DescriptionMatchGame } from './DescriptionMatchGame'
import { EdhrecRankGame } from './EdhrecRankGame'
import { RuleTriviaGame } from './RuleTriviaGame'
import { SpellifyGame } from './SpellifyGame'
import { UnscrambleGame } from './UnscrambleGame'
import {
  BOOSTER_COST,
  GUESS_MANA_REWARD_LABEL,
  MINIGAME_DAILY_MANA_CAP,
  RANK_GUESS_MANA_PER_CORRECT,
  SPELLIFY_MANA_REWARD_LABEL,
  TRIVIA_MANA_PER_CORRECT,
} from '../types/game'
import {
  DESCRIPTION_MATCH_MANA_MAX,
  DESCRIPTION_MATCH_TIME_SEC,
} from '../lib/description-match'

type MinigameId = 'menu' | MinigameArtId

const GAMES: { id: MinigameArtId; title: string; description: string }[] = [
  {
    id: 'art-guess' as const,
    title: 'Art Guess',
    description: 'Name the card from a zoomed-in art crop.',
  },
  {
    id: 'unscramble' as const,
    title: 'Unscramble',
    description: 'Unscramble the letters of a card name.',
  },
  {
    id: 'spellify' as const,
    title: 'Spellify',
    description: 'Hangman-style guessing — reveal letters until you can name the card.',
  },
  {
    id: 'description-match' as const,
    title: 'Match the Description',
    description: `Name cards that fit a mission before the ${DESCRIPTION_MATCH_TIME_SEC}-second timer runs out.`,
  },
  {
    id: 'rule-trivia' as const,
    title: 'MTG Rule Trivia',
    description: 'Multiple-choice rules scenarios — test your judge knowledge.',
  },
  {
    id: 'edhrec-rank' as const,
    title: 'Higher/Lower',
    description: 'Compare EDHREC ranks — commanders or staple cards.',
  },
]

const REWARD_SECTIONS = [
  {
    title: 'All minigames',
    lines: [
      `${MINIGAME_DAILY_MANA_CAP} mana per day per minigame (resets daily).`,
      'Keep playing after a game’s cap for practice — no extra mana from that game until tomorrow.',
    ],
  },
  {
    title: 'Art Guess · Unscramble',
    lines: [
      GUESS_MANA_REWARD_LABEL,
      '1st try = 5 mana · 2nd = 4 · 3rd = 3 · 4th = 2 · 5th = 1',
    ],
  },
  {
    title: 'Spellify',
    lines: [
      SPELLIFY_MANA_REWARD_LABEL,
      'Only wins count — you must guess the card name before using all 13 tries.',
    ],
  },
  {
    title: 'Match the Description',
    lines: [
      `Up to ${DESCRIPTION_MATCH_MANA_MAX} mana per win — faster wins pay more.`,
      `${DESCRIPTION_MATCH_TIME_SEC}-second timer · name 3 matching cards to win.`,
      '1 mana if you finish with little time left · 3 mana if you finish quickly.',
    ],
  },
  {
    title: 'MTG Rule Trivia',
    lines: [`+${TRIVIA_MANA_PER_CORRECT} mana per correct answer.`],
  },
  {
    title: 'Higher/Lower',
    lines: [`+${RANK_GUESS_MANA_PER_CORRECT} mana per correct answer.`],
  },
]

function MinigameRewardsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-mtg-gold)]">
              Minigame rewards
            </h2>
            <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
              How much mana each game pays out.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-mtg-muted)] hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {REWARD_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] p-4"
            >
              <h3 className="text-sm font-semibold text-white">{section.title}</h3>
              <ul className="mt-2 space-y-1 text-sm text-[var(--color-mtg-muted)]">
                {section.lines.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-[var(--color-mana-u)]">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-[var(--color-mtg-gold)] py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
        >
          Got it
        </button>
      </div>
    </div>
  )
}

export function MinigamesTab() {
  const [active, setActive] = useState<MinigameId>('menu')
  const [rewardsOpen, setRewardsOpen] = useState(false)

  if (active === 'art-guess') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setActive('menu')}
          className="mb-4 text-sm text-[var(--color-mtg-muted)] transition hover:text-[var(--color-mtg-gold)]"
        >
          ← Back to minigames
        </button>
        <ArtGuessGame />
      </div>
    )
  }

  if (active === 'unscramble') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setActive('menu')}
          className="mb-4 text-sm text-[var(--color-mtg-muted)] transition hover:text-[var(--color-mtg-gold)]"
        >
          ← Back to minigames
        </button>
        <UnscrambleGame />
      </div>
    )
  }

  if (active === 'spellify') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setActive('menu')}
          className="mb-4 text-sm text-[var(--color-mtg-muted)] transition hover:text-[var(--color-mtg-gold)]"
        >
          ← Back to minigames
        </button>
        <SpellifyGame />
      </div>
    )
  }

  if (active === 'description-match') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setActive('menu')}
          className="mb-4 text-sm text-[var(--color-mtg-muted)] transition hover:text-[var(--color-mtg-gold)]"
        >
          ← Back to minigames
        </button>
        <DescriptionMatchGame />
      </div>
    )
  }

  if (active === 'rule-trivia') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setActive('menu')}
          className="mb-4 text-sm text-[var(--color-mtg-muted)] transition hover:text-[var(--color-mtg-gold)]"
        >
          ← Back to minigames
        </button>
        <RuleTriviaGame />
      </div>
    )
  }

  if (active === 'edhrec-rank') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setActive('menu')}
          className="mb-4 text-sm text-[var(--color-mtg-muted)] transition hover:text-[var(--color-mtg-gold)]"
        >
          ← Back to minigames
        </button>
        <EdhrecRankGame />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
          Minigames
        </h2>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
          Win minigames to earn mana. Collect {BOOSTER_COST} mana to open a booster pack in the
          shop. {MINIGAME_DAILY_MANA_CAP} mana/day cap per minigame.
        </p>
        <button
          type="button"
          onClick={() => setRewardsOpen(true)}
          className="mt-3 rounded-lg border border-[var(--color-mana-u)]/40 px-4 py-1.5 text-sm font-medium text-[var(--color-mana-u)] transition hover:bg-[var(--color-mana-u)]/10"
        >
          Rewards
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {GAMES.map((game) => (
          <MinigameMenuCard
            key={game.id}
            game={game}
            onSelect={() => setActive(game.id)}
          />
        ))}
      </div>

      {rewardsOpen && <MinigameRewardsModal onClose={() => setRewardsOpen(false)} />}
    </div>
  )
}

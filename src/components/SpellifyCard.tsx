import type { ReactNode } from 'react'
import {
  getSpellifyDisplay,
  isCreatureOrPW,
  maskText,
  scryfallSymbolUrl,
  spellifyPanelBackground,
  splitMaskedDisplay,
  type GuessEntry,
} from '../lib/spellify-engine'
import { getCardImage } from '../lib/card-utils'
import type { CardRecord } from '../types/card'

type SpellifyCardProps = {
  card: CardRecord
  successfulGuesses: Set<string>
  hardMode: boolean
  revealed: boolean
}

function renderWordChars(text: string, mutedClass: string) {
  const nodes: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < text.length) {
    if (text[i] === '{') {
      const end = text.indexOf('}', i)
      if (end !== -1) {
        const inner = text.slice(i + 1, end)
        nodes.push(
          <img
            key={key++}
            src={scryfallSymbolUrl(inner)}
            alt={`{${inner}}`}
            className="mx-px inline-block h-[14px] w-[14px] align-[-2px]"
          />,
        )
        i = end + 1
        continue
      }
    }

    const ch = text[i]
    nodes.push(
      <span key={key++} className={ch === '_' ? mutedClass : undefined}>
        {ch}
      </span>,
    )
    i++
  }

  return nodes
}

function MaskedText({
  text,
  mutedClass = 'text-neutral-600',
  className,
}: {
  text: string
  mutedClass?: string
  className?: string
}) {
  const segments = splitMaskedDisplay(text)

  return (
    <span className={`inline leading-snug ${className ?? ''}`}>
      {segments.map((seg, i) => {
        if (seg.kind === 'break') return <br key={i} />
        if (seg.kind === 'space') return <span key={i} className="inline-block w-[0.35em]" />
        return (
          <span
            key={i}
            className="mr-[0.45em] inline-block whitespace-nowrap tracking-[0.12em] last:mr-0"
          >
            {renderWordChars(seg.text, mutedClass)}
          </span>
        )
      })}
    </span>
  )
}

function parseManaTokens(manaCost: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < manaCost.length) {
    if (manaCost[i] === '{') {
      const end = manaCost.indexOf('}', i)
      if (end !== -1) {
        tokens.push(manaCost.slice(i, end + 1))
        i = end + 1
        continue
      }
    }
    i++
  }
  return tokens
}

function ManaCostLine({
  manaCost,
  successfulGuesses,
  revealed,
}: {
  manaCost: string
  successfulGuesses: Set<string>
  revealed: boolean
}) {
  if (!manaCost) return null

  if (revealed) {
    const nodes: ReactNode[] = []
    let i = 0
    let key = 0
    while (i < manaCost.length) {
      if (manaCost[i] === '{') {
        const end = manaCost.indexOf('}', i)
        if (end !== -1) {
          const inner = manaCost.slice(i + 1, end)
          nodes.push(
            <img
              key={key++}
              src={scryfallSymbolUrl(inner)}
              alt={`{${inner}}`}
              className="mx-0.5 inline-block h-[18px] w-[18px] align-[-3px]"
            />,
          )
          i = end + 1
          continue
        }
      }
      i++
    }
    return <span className="inline-flex items-center justify-end gap-0.5">{nodes}</span>
  }

  const tokens = parseManaTokens(manaCost)
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-0.5 text-neutral-600">
      {tokens.map((token, i) => {
        const inner = token.slice(1, -1)
        const tokenMasked = maskText(token, successfulGuesses)
        const isRevealed = tokenMasked === token
        if (isRevealed) {
          return (
            <img
              key={i}
              src={scryfallSymbolUrl(inner)}
              alt={token}
              className="inline-block h-[18px] w-[18px]"
            />
          )
        }
        return (
          <span
            key={i}
            className="inline-block h-[18px] w-[18px] rounded-full border border-neutral-500 bg-neutral-300 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.75),inset_-1px_-1px_2px_rgba(0,0,0,0.2)]"
            aria-label={`Hidden mana symbol ${i + 1}`}
          />
        )
      })}
      {tokens.length === 0 && (
        <span className="inline-block h-[18px] w-[18px] rounded-full border border-neutral-500 bg-neutral-300 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.75),inset_-1px_-1px_2px_rgba(0,0,0,0.2)]" />
      )}
    </span>
  )
}

export function SpellifyCardFace({
  card,
  successfulGuesses,
  hardMode,
  revealed,
}: SpellifyCardProps) {
  const display = getSpellifyDisplay(card)
  const image = getCardImage(card)

  const nameText = revealed ? display.name : maskText(display.name, successfulGuesses)
  const typeText = hardMode
    ? maskText(display.typeLine, successfulGuesses)
    : display.typeLine
  const oracleText = revealed
    ? display.oracleText
    : maskText(display.oracleText, successfulGuesses)

  const showPt = isCreatureOrPW(display.typeLine)
  const oracleLines = (revealed ? display.oracleText : oracleText).split('\n')
  const panelStyle = spellifyPanelBackground(display.colors, hardMode)

  return (
    <div
      className="mx-auto w-full max-w-lg rounded-md border border-neutral-300 px-5 py-7 text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-8 sm:py-8"
      style={{ background: panelStyle }}
    >
      <p className="text-center font-[family-name:var(--font-display)] text-xl font-bold leading-tight tracking-wide text-neutral-900 sm:text-2xl">
        {revealed ? (
          display.name
        ) : (
          <MaskedText text={nameText} mutedClass="text-neutral-600" />
        )}
      </p>

      <p className="mt-4 text-center text-[15px] font-medium text-neutral-900">
        {hardMode ? (
          <MaskedText text={typeText} mutedClass="text-neutral-600" />
        ) : (
          typeText
        )}
      </p>

      {!hardMode && display.manaCost && (
        <div className="mt-1.5 text-center text-[15px]">
          <ManaCostLine
            manaCost={display.manaCost}
            successfulGuesses={successfulGuesses}
            revealed={revealed}
          />
        </div>
      )}

      <div className="mt-6 space-y-3 text-left text-[14px] leading-relaxed text-neutral-900">
        {oracleLines.map((line, i) => (
          <p key={i}>
            {revealed ? (
              line
            ) : (
              <MaskedText text={line} mutedClass="text-neutral-600" />
            )}
          </p>
        ))}
      </div>

      {showPt && (
        <p className="mt-5 text-center text-lg font-medium">
          {revealed ? (
            <span className="text-neutral-800">* / *</span>
          ) : (
            <>
              <span className="text-neutral-600">_</span>
              <span className="mx-2 text-neutral-700">/</span>
              <span className="text-neutral-600">_</span>
            </>
          )}
        </p>
      )}

      {revealed && image && (
        <div className="mt-6 flex justify-center">
          <img
            src={image}
            alt={display.name}
            className="max-h-56 rounded-md shadow-md"
          />
        </div>
      )}
    </div>
  )
}

export function SpellifyGuessTable({ guesses }: { guesses: GuessEntry[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Number</th>
            <th className="px-4 py-2.5 font-medium">Guess</th>
            <th className="px-4 py-2.5 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {guesses.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">
                No guesses yet
              </td>
            </tr>
          ) : (
            guesses.map((entry, i) => (
              <tr key={i} className="border-t border-neutral-100">
                <td className="px-4 py-2.5 text-neutral-500">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-neutral-900">{entry.guess}</td>
                <td className="px-4 py-2.5">
                  {entry.hit ? (
                    <span className="font-semibold text-emerald-600">✓</span>
                  ) : (
                    <span className="font-semibold text-red-500">✗</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

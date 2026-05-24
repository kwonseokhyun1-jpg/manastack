import { useState } from 'react'
import { scryfallSymbolUrl, SYMBOL_KEYS, symbolLabel } from '../lib/spellify-engine'

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const

const KEY_BASE =
  'rounded-md border border-neutral-300 bg-neutral-100 py-2.5 text-sm font-semibold text-neutral-800 shadow-[0_1px_0_rgba(0,0,0,0.06)] transition hover:bg-white hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-neutral-100'

type SpellifyKeyboardProps = {
  usedGuesses: Set<string>
  disabled: boolean
  onGuess: (guess: string) => void
}

function isKeyUsed(key: string, usedGuesses: Set<string>): boolean {
  const lower = key.toLowerCase()
  if (usedGuesses.has(lower)) return true
  if (usedGuesses.has(key.toUpperCase())) return true
  if (usedGuesses.has(key)) return true
  return false
}

export function SpellifyKeyboard({ usedGuesses, disabled, onGuess }: SpellifyKeyboardProps) {
  const [symbolsMode, setSymbolsMode] = useState(false)

  if (symbolsMode) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
          {SYMBOL_KEYS.map((key) => {
            const used = isKeyUsed(key, usedGuesses)
            const inner = symbolLabel(key)
            return (
              <button
                key={key}
                type="button"
                disabled={disabled || used}
                onClick={() => onGuess(key)}
                className={`flex h-10 items-center justify-center ${KEY_BASE}`}
                title={key}
              >
                <img
                  src={scryfallSymbolUrl(inner)}
                  alt={key}
                  className="h-6 w-6"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                    ;(e.target as HTMLImageElement).parentElement!.textContent = inner
                  }}
                />
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setSymbolsMode(false)}
          className={`w-full ${KEY_BASE}`}
        >
          ABC
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {ROWS.map((row, rowIndex) => (
        <div
          key={row}
          className={`flex justify-center gap-1 ${rowIndex === 1 ? 'px-4' : rowIndex === 2 ? 'px-8' : ''}`}
        >
          {rowIndex === 2 && (
            <button
              type="button"
              onClick={() => setSymbolsMode(true)}
              disabled={disabled}
              className={`min-w-[2.5rem] px-2 text-xs ${KEY_BASE}`}
            >
              123
            </button>
          )}
          {[...row].map((key) => {
            const used = isKeyUsed(key, usedGuesses)
            return (
              <button
                key={key}
                type="button"
                disabled={disabled || used}
                onClick={() => onGuess(key)}
                className={`min-w-[2rem] flex-1 sm:min-w-[2.25rem] ${KEY_BASE}`}
              >
                {key}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

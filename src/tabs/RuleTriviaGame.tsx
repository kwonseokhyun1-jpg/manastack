import { useCallback, useRef, useState } from 'react'
import { useGame } from '../context/GameContext'
import {
  RULE_TRIVIA_QUESTIONS,
  shuffleQuestions,
  type TriviaQuestion,
} from '../lib/rule-trivia-questions'
import {
  MINIGAME_DAILY_MANA_CAP,
  TRIVIA_MANA_PER_CORRECT,
} from '../types/game'

type Phase = 'question' | 'revealed'

function pickNextQuestion(deck: TriviaQuestion[], used: Set<string>): TriviaQuestion {
  const remaining = deck.filter((q) => !used.has(q.id))
  const pool = remaining.length > 0 ? remaining : deck
  if (remaining.length === 0) used.clear()
  const next = pool[Math.floor(Math.random() * pool.length)]
  used.add(next.id)
  return next
}

export function RuleTriviaGame() {
  const { awardMinigameMana, minigameManaRemainingToday } = useGame()
  const manaRemaining = minigameManaRemainingToday('rule-trivia')
  const [deck] = useState(() => shuffleQuestions(RULE_TRIVIA_QUESTIONS))
  const usedIdsRef = useRef<Set<string>>(new Set())
  const [question, setQuestion] = useState(() => pickNextQuestion(deck, usedIdsRef.current))
  const [phase, setPhase] = useState<Phase>('question')
  const [selected, setSelected] = useState<number | null>(null)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionWrong, setSessionWrong] = useState(0)
  const [justEarnedMana, setJustEarnedMana] = useState(false)
  const [atDailyCap, setAtDailyCap] = useState(false)

  const advanceQuestion = useCallback(() => {
    const next = pickNextQuestion(deck, usedIdsRef.current)
    setQuestion(next)
    setPhase('question')
    setSelected(null)
    setJustEarnedMana(false)
    setAtDailyCap(false)
  }, [deck])

  const handleAnswer = useCallback(
    (index: number) => {
      if (phase !== 'question') return

      setSelected(index)
      setPhase('revealed')

      const correct = index === question.correctIndex
      if (!correct) {
        setSessionWrong((w) => w + 1)
        return
      }

      setSessionCorrect((c) => c + 1)

      if (manaRemaining <= 0) {
        setAtDailyCap(true)
        return
      }

      const awarded = awardMinigameMana('rule-trivia', TRIVIA_MANA_PER_CORRECT)
      if (awarded > 0) {
        setJustEarnedMana(true)
      } else {
        setAtDailyCap(true)
      }
    },
    [phase, question.correctIndex, manaRemaining, awardMinigameMana],
  )

  const isCorrect = selected === question.correctIndex
  const manaEarnedToday = MINIGAME_DAILY_MANA_CAP - manaRemaining

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
          MTG Rule Trivia
        </h2>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
          +{TRIVIA_MANA_PER_CORRECT} mana per correct answer, up to {MINIGAME_DAILY_MANA_CAP} mana
          per day for this game.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-3">
          <p className="text-xs uppercase tracking-wide text-[var(--color-mtg-muted)]">Correct</p>
          <p className="text-xl font-bold text-green-400">{sessionCorrect}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-3">
          <p className="text-xs uppercase tracking-wide text-[var(--color-mtg-muted)]">Wrong</p>
          <p className="text-xl font-bold text-red-400">{sessionWrong}</p>
        </div>
        <div
          className={`rounded-lg border bg-[var(--color-mtg-panel)] p-3 transition ${
            manaRemaining <= 0
              ? 'border-[var(--color-mtg-border)] opacity-80'
              : 'border-[var(--color-mana-u)]/40'
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-[var(--color-mtg-muted)]">
            Mana today
          </p>
          <p className="text-xl font-bold text-[var(--color-mana-u)]">
            {manaEarnedToday}/{MINIGAME_DAILY_MANA_CAP}
          </p>
        </div>
      </div>

      {manaRemaining <= 0 && (
        <p className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] px-4 py-3 text-center text-sm text-[var(--color-mtg-muted)]">
          Daily mana cap reached — keep playing for practice. Resets tomorrow.
        </p>
      )}

      <div className="rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-mtg-gold)]">
          Scenario
        </p>
        <p className="text-sm leading-relaxed text-white">{question.scenario}</p>
      </div>

      <div className="grid gap-2">
        {question.choices.map((choice, index) => {
          let style =
            'border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] hover:border-[var(--color-mtg-gold-dim)]'
          if (phase === 'revealed') {
            if (index === question.correctIndex) {
              style = 'border-green-500/60 bg-green-500/10'
            } else if (index === selected) {
              style = 'border-red-500/60 bg-red-500/10'
            } else {
              style = 'border-[var(--color-mtg-border)] opacity-50'
            }
          }

          return (
            <button
              key={index}
              type="button"
              disabled={phase === 'revealed'}
              onClick={() => handleAnswer(index)}
              className={`rounded-lg border px-4 py-3 text-left text-sm text-white transition disabled:cursor-default ${style}`}
            >
              <span className="mr-2 font-semibold text-[var(--color-mtg-gold)]">
                {String.fromCharCode(65 + index)}.
              </span>
              {choice}
            </button>
          )
        })}
      </div>

      {phase === 'revealed' && (
        <div
          className={`rounded-lg border p-4 ${
            isCorrect
              ? 'border-green-500/40 bg-green-500/10'
              : 'border-red-500/40 bg-red-500/10'
          }`}
        >
          <p
            className={`font-semibold ${isCorrect ? 'text-green-300' : 'text-red-300'}`}
          >
            {isCorrect ? 'Correct!' : 'Incorrect'}
            {isCorrect && justEarnedMana && ` — +${TRIVIA_MANA_PER_CORRECT} mana!`}
            {isCorrect && atDailyCap && ' — daily cap reached, no mana earned.'}
          </p>
          <p className="mt-2 text-sm text-[var(--color-mtg-muted)]">{question.explanation}</p>
          <button
            type="button"
            onClick={advanceQuestion}
            className="mt-4 w-full rounded-lg bg-[var(--color-mtg-gold)] py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Next question
          </button>
        </div>
      )}
    </div>
  )
}

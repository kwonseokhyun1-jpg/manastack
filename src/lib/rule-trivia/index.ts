import type { TriviaQuestion } from './types'
import bulkData from '../../data/rule-trivia-bulk.json'
import { CORE_TRIVIA_QUESTIONS } from './core-questions'

type BulkFile = {
  count: number
  questions: Array<{
    id: string
    scenario: string
    choices: string[]
    correctIndex: number
    explanation: string
  }>
}

function normalizeBulk(entry: BulkFile['questions'][number]): TriviaQuestion | null {
  if (entry.choices.length !== 4) return null
  if (entry.correctIndex < 0 || entry.correctIndex > 3) return null
  return {
    id: entry.id,
    scenario: entry.scenario,
    choices: entry.choices as [string, string, string, string],
    correctIndex: entry.correctIndex as 0 | 1 | 2 | 3,
    explanation: entry.explanation,
  }
}

function mergeQuestions(): TriviaQuestion[] {
  const byId = new Map<string, TriviaQuestion>()
  for (const question of CORE_TRIVIA_QUESTIONS) {
    byId.set(question.id, question)
  }
  for (const raw of (bulkData as BulkFile).questions) {
    const question = normalizeBulk(raw)
    if (question && !byId.has(question.id)) {
      byId.set(question.id, question)
    }
  }
  return [...byId.values()]
}

export type { TriviaQuestion } from './types'

export const RULE_TRIVIA_QUESTIONS: TriviaQuestion[] = mergeQuestions()

export function shuffleQuestions(questions: TriviaQuestion[]): TriviaQuestion[] {
  const copy = [...questions]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

import { BULK_TRIVIA_QUESTIONS } from './bulk-questions'
import { CORE_TRIVIA_QUESTIONS } from './core-questions'
import { EXTRA_TRIVIA_QUESTIONS } from './extra-questions'
import type { TriviaQuestion } from './types'

function mergeQuestions(): TriviaQuestion[] {
  const byId = new Map<string, TriviaQuestion>()
  for (const question of CORE_TRIVIA_QUESTIONS) {
    byId.set(question.id, question)
  }
  for (const question of BULK_TRIVIA_QUESTIONS) {
    if (!byId.has(question.id)) {
      byId.set(question.id, question)
    }
  }
  for (const question of EXTRA_TRIVIA_QUESTIONS) {
    if (!byId.has(question.id)) {
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

import { TRIVIA_QUESTIONS } from './questions'
import type { TriviaQuestion } from './types'

export type { TriviaQuestion } from './types'

export const RULE_TRIVIA_QUESTIONS: TriviaQuestion[] = TRIVIA_QUESTIONS

export function shuffleQuestions(questions: TriviaQuestion[]): TriviaQuestion[] {
  const copy = [...questions]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

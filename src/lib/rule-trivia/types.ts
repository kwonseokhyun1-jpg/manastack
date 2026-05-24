export type TriviaQuestion = {
  id: string
  scenario: string
  choices: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
}

export function q(
  id: string,
  scenario: string,
  choices: [string, string, string, string],
  correctIndex: 0 | 1 | 2 | 3,
  explanation: string,
): TriviaQuestion {
  return { id, scenario, choices, correctIndex, explanation }
}

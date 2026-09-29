export type AnswerIndex = 0 | 1 | 2 | 3
export type Bet = 1 | 2 | 3

export interface Question {
  readonly id: string
  readonly text: string
  readonly options: readonly [string, string, string, string]
  readonly correctAnswer: AnswerIndex
}

export type Action =
  | { readonly type: 'answer'; readonly answer: AnswerIndex; readonly bet: Bet }
  | { readonly type: 'rest' }
  | { readonly type: 'timeout' }

export type Winner = 'player' | 'bot' | 'draw'

export interface ActionResult {
  readonly action: Action
  readonly force: number
  readonly energy: number
}

export interface RoundResult {
  readonly questionId: string
  readonly player: ActionResult
  readonly bot: ActionResult
  readonly delta: number
}

export interface GameState {
  readonly questions: readonly Question[]
  readonly roundsPlayed: number
  readonly position: number
  readonly playerEnergy: number
  readonly botEnergy: number
  readonly winner: Winner | null
  readonly lastRound: RoundResult | null
}

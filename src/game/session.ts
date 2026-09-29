import { calculateRound, createGame } from './engine'
import type { Action, GameState, Question } from './types'

export type Phase = 'start' | 'countdown' | 'question' | 'review' | 'result'
export interface Session {
  readonly game: GameState
  readonly phase: Phase
  readonly matchId: number
}
export type SessionEvent =
  | { type: 'start' }
  | { type: 'ready'; matchId: number }
  | { type: 'submit'; matchId: number; round: number; player: Action; bot: Action }
  | { type: 'next'; matchId: number; round: number }
  | { type: 'rematch' }

export function createSession(questions: readonly Question[]): Session {
  return { game: createGame(questions), phase: 'start', matchId: 0 }
}

// Этап, номер матча и номер раунда защищают от повторных и запоздалых событий.
export function sessionReducer(state: Session, event: SessionEvent): Session {
  switch (event.type) {
    case 'start':
      return state.phase === 'start' ? { ...state, phase: 'countdown' } : state
    case 'ready':
      return state.phase === 'countdown' && event.matchId === state.matchId
        ? { ...state, phase: 'question' } : state
    case 'submit':
      if (state.phase !== 'question' || event.matchId !== state.matchId
        || event.round !== state.game.roundsPlayed || state.game.winner !== null) return state
      return { ...state, phase: 'review', game: calculateRound(state.game, event.player, event.bot) }
    case 'next':
      if (state.phase !== 'review' || event.matchId !== state.matchId
        || event.round !== state.game.roundsPlayed) return state
      return { ...state, phase: state.game.winner === null ? 'question' : 'result' }
    case 'rematch':
      return state.phase === 'result'
        ? { game: createGame(state.game.questions), phase: 'countdown', matchId: state.matchId + 1 }
        : state
  }
}

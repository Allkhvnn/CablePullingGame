import type { Action, AnswerIndex, Question, RoundResult } from '../src/game/types'

export type Seat = 'one' | 'two'
export type PublicQuestion = Omit<Question, 'correctAnswer'>
export type PlayerAction = Exclude<Action, { type: 'timeout' }>
export type ClientMessage =
  | { type: 'create' }
  | { type: 'join'; roomId: string }
  | { type: 'resume'; roomId: string; token: string }
  | { type: 'action'; matchId: number; round: number; action: PlayerAction }
  | { type: 'rematch'; matchId: number }

export interface RoomState {
  roomId: string
  matchId: number
  phase: 'waiting' | 'countdown' | 'question' | 'reveal' | 'result'
  serverTime: number
  deadline: number | null
  paused: boolean
  remainingMs: number | null
  reconnectDeadline: number | null
  players: Record<Seat, { occupied: boolean; connected: boolean; energy: number; submitted: boolean; rematch: boolean }>
  roundsPlayed: number
  round: number
  position: number
  question: PublicQuestion | null
  reveal: { question: PublicQuestion; correctAnswer: AnswerIndex; result: RoundResult } | null
  winner: Seat | 'draw' | null
  reason: 'normal' | 'disconnect' | 'abandoned' | null
}

export type ServerMessage =
  | { type: 'joined'; roomId: string; seat: Seat; token: string }
  | { type: 'state'; state: RoomState }
  | { type: 'error'; code: string; message: string }

// WebSocket принимает недоверенный JSON: TypeScript сам по себе его не проверяет.
export function parseClientMessage(value: unknown): ClientMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  const id = (x: unknown): x is string => typeof x === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(x)
  const number = (x: unknown): x is number => Number.isSafeInteger(x) && (x as number) >= 0
  if (v.type === 'create') return { type: 'create' }
  if (v.type === 'join' && id(v.roomId)) return { type: 'join', roomId: v.roomId }
  if (v.type === 'resume' && id(v.roomId) && typeof v.token === 'string' && /^[a-f0-9]{64}$/.test(v.token)) {
    return { type: 'resume', roomId: v.roomId, token: v.token }
  }
  if (v.type === 'rematch' && number(v.matchId)) return { type: 'rematch', matchId: v.matchId }
  if (v.type !== 'action' || !number(v.matchId) || !number(v.round) || !v.action || typeof v.action !== 'object') return null
  const a = v.action as Record<string, unknown>
  if (a.type === 'rest') return { type: 'action', matchId: v.matchId, round: v.round, action: { type: 'rest' } }
  if (a.type === 'answer' && [1, 2, 3].includes(a.bet as number) && [0, 1, 2, 3].includes(a.answer as number)) {
    return { type: 'action', matchId: v.matchId, round: v.round,
      action: { type: 'answer', bet: a.bet as 1 | 2 | 3, answer: a.answer as AnswerIndex } }
  }
  return null
}

import { describe, expect, it } from 'vitest'
import { questions } from '../data/questions'
import { createSession, sessionReducer } from './session'
import type { SessionEvent } from './session'

describe('Этапы матча', () => {
  const submit: SessionEvent = { type: 'submit', matchId: 0, round: 0, player: { type: 'rest' }, bot: { type: 'rest' } }
  it('не принимает действия до начала и во время отсчёта', () => {
    const start = createSession(questions)
    expect(sessionReducer(start, submit)).toBe(start)
    const countdown = sessionReducer(start, { type: 'start' })
    expect(sessionReducer(countdown, submit)).toBe(countdown)
    expect(sessionReducer(countdown, { type: 'start' })).toBe(countdown)
  })
  it('игнорирует двойную отправку и запоздалый ответ прошлого раунда', () => {
    const active = sessionReducer(sessionReducer(createSession(questions), { type: 'start' }), { type: 'ready', matchId: 0 })
    const review = sessionReducer(active, submit)
    expect(sessionReducer(review, submit)).toBe(review)
    const next = sessionReducer(review, { type: 'next', matchId: 0, round: 1 })
    expect(sessionReducer(next, submit)).toBe(next)
    expect(next.game.roundsPlayed).toBe(1)
  })
  it('события предыдущего матча не попадают в реванш', () => {
    const finished = { ...createSession(questions), phase: 'result' as const }
    const rematch = sessionReducer(finished, { type: 'rematch' })
    expect(sessionReducer(rematch, { type: 'ready', matchId: 0 })).toBe(rematch)
    const active = sessionReducer(rematch, { type: 'ready', matchId: 1 })
    expect(sessionReducer(active, submit)).toBe(active)
    expect(active.game).toEqual(createSession(questions).game)
  })
  it('не принимает ответы на экране результата', () => {
    const result = { ...createSession(questions), phase: 'result' as const }
    expect(sessionReducer(result, submit)).toBe(result)
  })
})

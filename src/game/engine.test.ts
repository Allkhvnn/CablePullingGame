import { describe, expect, it } from 'vitest'
import { questions } from '../data/questions'
import { calculateRound, checkWinner, createGame, resolveAction } from './engine'
import { chooseBotAction } from './bot'
import type { Action, Bet, GameState, Question } from './types'

const question: Question = { id: 'test', text: '2 + 2?', options: ['4', '3', '2', '1'], correctAnswer: 0 }
const bank = Array.from({ length: 12 }, (_, i) => ({ ...question, id: String(i) }))
const rest: Action = { type: 'rest' }
const correct = (bet: Bet): Action => ({ type: 'answer', answer: 0, bet })
const wrong = (bet: Bet): Action => ({ type: 'answer', answer: 1, bet })

describe('Энергия и сила', () => {
  it.each([1, 2, 3] as const)('правильный ответ со ставкой %s', bet => {
    expect(resolveAction(5, correct(bet), question)).toMatchObject({ force: bet, energy: 5 - bet + 1 })
  })
  it.each([1, 2, 3] as const)('неправильный ответ со ставкой %s', bet => {
    expect(resolveAction(5, wrong(bet), question)).toMatchObject({ force: -bet, energy: 5 - bet + 1 })
  })
  it('отдых даёт 3 энергии без силы', () => {
    expect(resolveAction(1, rest, question)).toMatchObject({ force: 0, energy: 4 })
  })
  it('энергия не превышает 5', () => {
    expect(resolveAction(4, rest, question).energy).toBe(5)
    expect(resolveAction(5, { type: 'timeout' }, question).energy).toBe(5)
  })
  it('тайм-аут восстанавливает только 1 энергию и не тянет канат', () => {
    expect(resolveAction(1, { type: 'timeout' }, question)).toMatchObject({ force: 0, energy: 2 })
  })
  it('можно потратить всю оставшуюся энергию', () => {
    expect(resolveAction(2, correct(2), question).energy).toBe(1)
  })
  it('недостаточная энергия отклоняется без изменения состояния', () => {
    const state = { ...createGame(bank), playerEnergy: 1 }
    const before = structuredClone(state)
    expect(() => calculateRound(state, correct(2), rest)).toThrow('Недостаточно энергии')
    expect(state).toEqual(before)
  })
  it('недопустимая ставка отклоняется и на границе внешнего ввода', () => {
    expect(() => resolveAction(5, correct(0 as Bet), question)).toThrow('Некорректный')
  })
})

describe('Раунд и завершение игры', () => {
  it('вычитает силу бота из силы игрока и не меняет исходное состояние', () => {
    const state = createGame(bank)
    const before = structuredClone(state)
    const next = calculateRound(state, correct(3), wrong(2))
    expect(next).toMatchObject({ position: 5, roundsPlayed: 1, playerEnergy: 3, botEnergy: 4, winner: null })
    expect(state).toEqual(before)
  })
  it('оба отвечают на текущий вопрос', () => {
    const state = createGame(questions)
    const action: Action = { type: 'answer', answer: questions[0]!.correctAnswer, bet: 2 }
    expect(calculateRound(state, action, action).position).toBe(0)
  })
  it('тайм-аут игрока не отменяет ход бота', () => {
    expect(calculateRound(createGame(bank), { type: 'timeout' }, correct(3)).position).toBe(-3)
  })
  it('ошибка игрока тянет канат к боту', () => {
    expect(calculateRound(createGame(bank), wrong(2), rest).position).toBe(-2)
  })
  it.each([
    [7, correct(3), rest, 'player', 10],
    [8, correct(3), rest, 'player', 11],
    [-7, rest, correct(3), 'bot', -10],
    [-8, rest, correct(3), 'bot', -11],
  ] as const)('победа от позиции %s', (position, player, bot, winner, expectedPosition) => {
    const next = calculateRound({ ...createGame(bank), position }, player, bot)
    expect(next.winner).toBe(winner)
    expect(next.position).toBe(expectedPosition)
  })
  it.each([[2, 'player'], [-2, 'bot'], [0, 'draw']] as const)('после 12 вопросов, позиция %s', (position, winner) => {
    const state = { ...createGame(bank), roundsPlayed: 11, position }
    expect(checkWinner(position, 11)).toBeNull()
    expect(calculateRound(state, rest, rest).winner).toBe(winner)
  })
  it.each(['player', 'bot', 'draw'] as const)('после результата %s любые действия игнорируются', winner => {
    const state: GameState = { ...createGame(bank), winner, playerEnergy: 0 }
    expect(calculateRound(state, correct(3), wrong(3))).toBe(state)
  })
  it('полная партия завершается после 12-го вопроса', () => {
    let state = createGame(bank)
    for (let i = 0; i < 12; i++) state = calculateRound(state, rest, rest)
    expect(state).toMatchObject({ roundsPlayed: 12, position: 0, winner: 'draw' })
    expect(calculateRound(state, rest, rest)).toBe(state)
  })
  it('реванш полностью сбрасывает состояние завершённой партии', () => {
    const finished = calculateRound({ ...createGame(bank), position: 9 }, correct(2), rest)
    const rematch = createGame(finished.questions)
    expect(rematch).toEqual(createGame(bank))
    expect(rematch.questions).not.toBe(finished.questions)
    expect(calculateRound(rematch, correct(1), rest).roundsPlayed).toBe(1)
    expect(finished.winner).toBe('player')
  })
  it('короткий набор вопросов отклоняется', () => {
    expect(() => createGame(bank.slice(0, 11))).toThrow('12 вопросов')
  })
})

describe('Бот', () => {
  it('отдыхает при низкой энергии', () => {
    expect(chooseBotAction(1, 0, 0)).toEqual(rest)
  })
  it('выбирает доступную ставку и один из четырёх ответов', () => {
    expect(chooseBotAction(2, 0.99, 0.99)).toEqual({ type: 'answer', answer: 3, bet: 2 })
    expect(chooseBotAction(5, 0, 0)).toEqual(correct(1))
  })
})

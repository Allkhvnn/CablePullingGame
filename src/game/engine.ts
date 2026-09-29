import type { Action, ActionResult, GameState, Question, Winner } from './types'

export const MAX_ENERGY = 5
export const WIN_POSITION = 10
export const QUESTION_LIMIT = 12
export const ROUND_DURATION_MS = 12_000

export function createGame(questions: readonly Question[]): GameState {
  if (questions.length < QUESTION_LIMIT) {
    throw new Error('Для игры нужно минимум 12 вопросов.')
  }
  const selected = questions.slice(0, QUESTION_LIMIT)
  if (new Set(selected.map(q => q.id)).size !== QUESTION_LIMIT) {
    throw new Error('Идентификаторы вопросов должны быть уникальными.')
  }
  for (const question of selected) {
    if (question.options.length !== 4 || !Number.isInteger(question.correctAnswer)
      || question.correctAnswer < 0 || question.correctAnswer > 3) {
      throw new Error('У вопроса должно быть 4 варианта и корректный индекс ответа.')
    }
  }
  return {
    questions: selected.map(q => ({ ...q, options: [...q.options] })),
    roundsPlayed: 0,
    position: 0,
    playerEnergy: MAX_ENERGY,
    botEnergy: MAX_ENERGY,
    winner: null,
    lastRound: null,
  }
}

export function checkWinner(position: number, roundsPlayed: number): Winner | null {
  if (position >= WIN_POSITION) return 'player'
  if (position <= -WIN_POSITION) return 'bot'
  if (roundsPlayed < QUESTION_LIMIT) return null
  return position > 0 ? 'player' : position < 0 ? 'bot' : 'draw'
}

export function resolveAction(energy: number, action: Action, question: Question): ActionResult {
  if (!Number.isInteger(energy) || energy < 0 || energy > MAX_ENERGY) {
    throw new Error('Энергия должна быть целым числом от 0 до 5.')
  }
  if (action.type === 'rest' || action.type === 'timeout') {
    return {
      action: { ...action }, force: 0,
      energy: Math.min(MAX_ENERGY, energy + (action.type === 'rest' ? 3 : 1)),
    }
  }
  if (action.type !== 'answer' || ![1, 2, 3].includes(action.bet)
    || ![0, 1, 2, 3].includes(action.answer)) {
    throw new Error('Некорректный ответ или ставка.')
  }
  if (action.bet > energy) throw new Error('Недостаточно энергии для ставки.')
  return {
    action: { ...action },
    force: action.answer === question.correctAnswer ? action.bet : -action.bet,
    energy: Math.min(MAX_ENERGY, energy - action.bet + 1),
  }
}

// Чистая функция: оба действия проверяются до создания нового состояния.
export function calculateRound(state: GameState, playerAction: Action, botAction: Action): GameState {
  if (state.winner !== null) return state
  const question = state.questions[state.roundsPlayed]
  if (!question) throw new Error('Вопрос для раунда отсутствует.')
  const player = resolveAction(state.playerEnergy, playerAction, question)
  const bot = resolveAction(state.botEnergy, botAction, question)
  const delta = player.force - bot.force
  const position = state.position + delta
  const roundsPlayed = state.roundsPlayed + 1
  return {
    ...state, position, roundsPlayed,
    playerEnergy: player.energy,
    botEnergy: bot.energy,
    winner: checkWinner(position, roundsPlayed),
    lastRound: { questionId: question.id, player, bot, delta },
  }
}

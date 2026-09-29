import type { Action, AnswerIndex, Bet } from './types'

// Случайные числа передаются снаружи: функцию легко повторить и проверить.
// Бот не получает правильный ответ или действие игрока.
export function chooseBotAction(energy: number, answerRoll: number, betRoll: number): Action {
  if (energy <= 1) return { type: 'rest' }
  if (![answerRoll, betRoll].every(n => Number.isFinite(n) && n >= 0 && n < 1)) {
    throw new Error('Случайные числа должны быть от 0 включительно до 1 исключительно.')
  }
  return {
    type: 'answer',
    answer: Math.floor(answerRoll * 4) as AnswerIndex,
    bet: (1 + Math.floor(betRoll * Math.min(3, energy))) as Bet,
  }
}

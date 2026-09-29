import type { ActionResult, Question, RoundResult } from '../game/types'

function describe(result: ActionResult, question: Question) {
  const action = result.action
  if (action.type === 'rest') return 'Отдых'
  if (action.type === 'timeout') return 'Время истекло — ответ не подтверждён'
  return `${question.options[action.answer]} — ${action.answer === question.correctAnswer ? 'верно' : 'неверно'}, ставка ${action.bet}`
}
export function RoundReview({ question, result, finished, onNext }: {
  question: Question; result: RoundResult; finished: boolean; onNext: () => void
}) {
  return <section className="panel" aria-labelledby="review-title">
    <h2 id="review-title">Раунд завершён</h2>
    <p>{question.text}</p>
    <p className="correct">Правильный ответ: <strong>{question.options[question.correctAnswer]}</strong></p>
    <p>Вы: {describe(result.player, question)}. Сила: {result.player.force}.</p>
    <p>Бот: {describe(result.bot, question)}. Сила: {result.bot.force}.</p>
    <p>Сдвиг каната: {result.delta > 0 ? '+' : ''}{result.delta}.</p>
    <p className="hint">Таймер остановлен. Продолжите, когда будете готовы.</p>
    <button onClick={onNext}>{finished ? 'Показать результат' : 'Следующий вопрос'}</button>
  </section>
}

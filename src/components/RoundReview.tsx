import type { ActionResult, Question, RoundResult } from '../game/types'

function describe(result: ActionResult, question: Question) {
  const action = result.action
  if (action.type === 'rest') return 'Отдых'
  if (action.type === 'timeout') return 'Время истекло — ответ не подтверждён'
  return `${question.options[action.answer]} — ${action.answer === question.correctAnswer ? 'верно' : 'неверно'}, ставка ${action.bet}`
}
export function RoundReview({ question, result, finished, onNext, step = 3 }: {
  question: Question; result: RoundResult; finished: boolean; onNext: () => void; step?: number
}) {
  return <section className="panel reveal-card training-review" aria-labelledby="review-title" aria-live="polite">
    <span className="section-kicker">РАУНД ЗАВЕРШЁН</span>
    <h2 id="review-title">{step === 0 ? 'Сверяем ответы…' : step === 1 ? 'Силы определены'
      : result.delta === 0 ? 'Канат остался на месте' : 'Рывок завершён!'}</h2>
    <div className="reveal-progress" aria-label={`Этап раскрытия ${Math.min(step + 1, 3)} из 3`}>
      {[0, 1, 2].map(index => <span key={index} className={index <= step ? 'is-active' : ''} />)}
    </div>
    <p className="review-question">{question.text}</p>
    {step >= 1 ? <>
      <p className="correct-answer">Верный ответ: {question.options[question.correctAnswer]}</p>
      <div className="review-grid">
        <div className={result.bot.force > 0 ? 'force-positive' : result.bot.force < 0 ? 'force-negative' : 'force-neutral'}>
          <span>БОТ · СЛЕВА</span><p>{describe(result.bot, question)}.</p>
          <strong>Сила {result.bot.force > 0 ? '+' : ''}{result.bot.force}</strong></div>
        <div className={result.player.force > 0 ? 'force-positive' : result.player.force < 0 ? 'force-negative' : 'force-neutral'}>
          <span>ВЫ · СПРАВА</span><p>{describe(result.player, question)}.</p>
          <strong>Сила {result.player.force > 0 ? '+' : ''}{result.player.force}</strong></div>
      </div>
    </> : <p className="reveal-pending">Раунд завершён. Узнаём, кто перетянул канат.</p>}
    {step >= 2 && <p className="reveal-footnote">Сдвиг каната: {result.delta > 0 ? '+' : ''}{result.delta}.</p>}
    {step >= 3 && <>
      <p className="hint">Таймер остановлен. Продолжите, когда будете готовы.</p>
      <button className="button button--primary" onClick={onNext}>{finished ? 'Показать результат' : 'Следующий вопрос'}</button>
    </>}
  </section>
}

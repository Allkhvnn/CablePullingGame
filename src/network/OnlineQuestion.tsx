import { useRef, useState } from 'react'
import { ROUND_DURATION_MS } from '../game/engine'
import type { AnswerIndex, Bet } from '../game/types'
import type { PlayerAction, PublicQuestion } from '../../shared/protocol'

export function OnlineQuestion({ question, energy, disabled, submitted, onAction }: {
  question: PublicQuestion; energy: number; disabled: boolean; submitted: boolean
  onAction: (action: PlayerAction) => boolean
}) {
  const [answer, setAnswer] = useState<AnswerIndex | null>(null)
  const [bet, setBet] = useState<Bet | null>(null)
  const [pending, setPending] = useState(false)
  const lock = useRef(false)
  function submit(action: PlayerAction) {
    if (disabled || submitted || lock.current) return
    lock.current = true
    if (onAction(action)) setPending(true)
    else lock.current = false
  }
  const locked = disabled || submitted || pending
  return <section className="panel question-card">
    <div className="question-card__heading">
      <span className="section-kicker">ВАШ ХОД</span>
      <h2>{question.text}</h2>
      <p>Сначала выберите ставку и ответ, затем подтвердите ход.</p>
    </div>
    <fieldset className="choice-fieldset" disabled={locked}>
      <legend><span className="step-number">1</span> Сколько энергии поставить?</legend>
      <div className="bets">{([1, 2, 3] as const).map(value => <label key={value}
        className={'bet-choice' + (bet === value ? ' is-selected' : '')}>
        <input type="radio" name="online-bet" aria-label={String(value)} checked={bet === value} disabled={value > energy}
          onChange={() => setBet(value)} /><span>{value}</span><small>энергии</small>
      </label>)}</div>
      <p className="field-hint">Доступно: {energy}. Ставка списывается и при ошибке.</p>
    </fieldset>
    <fieldset className="choice-fieldset" disabled={locked}>
      <legend><span className="step-number">2</span> Ваш ответ</legend>
      <div className="answer-grid">{question.options.map((option, i) => <label key={i}
        className={'answer-choice' + (answer === i ? ' is-selected' : '')}>
        <input type="radio" name="online-answer" checked={answer === i}
          onChange={() => setAnswer(i as AnswerIndex)} />
        <span className="answer-letter" aria-hidden="true">{['А', 'Б', 'В', 'Г'][i]}</span>
        <span>{option}</span>
      </label>)}</div>
    </fieldset>
    <p className="move-preview" aria-live="polite">
      {submitted || pending ? 'Ход принят. Ждём завершения раунда.' : disabled ? 'Ход сейчас недоступен.' : bet === null || answer === null
        ? 'Выберите ставку и ответ, чтобы подготовить ход.'
        : `Ваш ход: ставка ${bet} · возможная сила +${bet} или −${bet}. Нажмите «Подтвердить».`}
    </p>
    <div className="question-actions">
      <button className="button button--primary button--large"
        disabled={locked || answer === null || bet === null || bet > energy}
        onClick={() => answer !== null && bet !== null && submit({ type: 'answer', answer, bet })}>Подтвердить</button>
      <button className="button button--secondary" disabled={locked}
        onClick={() => submit({ type: 'rest' })}>Отдохнуть <span aria-hidden="true">+3 ⚡</span></button>
    </div>
    <p className="question-tip">Отдых не тянет канат, зато возвращает 3 энергии. Без ответа за {ROUND_DURATION_MS / 1000} секунд вернётся только 1.</p>
    {(submitted || pending) && <p className="notice notice--success" role="status">
      {submitted ? 'Ход принят. Ждём соперника.' : 'Отправляем ход…'}
    </p>}
  </section>
}

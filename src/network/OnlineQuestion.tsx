import { useRef, useState } from 'react'
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
  return <section className="panel">
    <h2>{question.text}</h2>
    <fieldset disabled={locked}>
      <legend>Ставка</legend>
      <div className="bets">{([1, 2, 3] as const).map(value => <label key={value}>
        <input type="radio" name="online-bet" checked={bet === value} disabled={value > energy}
          onChange={() => setBet(value)} /> {value}
      </label>)}</div>
    </fieldset>
    <fieldset disabled={locked}>
      <legend>Ответ</legend>
      {question.options.map((option, i) => <label key={i}>
        <input type="radio" name="online-answer" checked={answer === i}
          onChange={() => setAnswer(i as AnswerIndex)} /> {option}
      </label>)}
    </fieldset>
    <button disabled={locked || answer === null || bet === null || bet > energy}
      onClick={() => answer !== null && bet !== null && submit({ type: 'answer', answer, bet })}>Подтвердить</button>
    <button disabled={locked} onClick={() => submit({ type: 'rest' })}>Отдохнуть</button>
    {(submitted || pending) && <p role="status">{submitted ? 'Ход принят. Ждём соперника.' : 'Отправляем ход…'}</p>}
  </section>
}

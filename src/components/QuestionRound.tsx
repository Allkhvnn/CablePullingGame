import { useCallback, useEffect, useRef, useState } from 'react'
import { ROUND_DURATION_MS } from '../game/engine'
import type { Action, AnswerIndex, Bet, Question } from '../game/types'

export function QuestionRound({ question, energy, onAction }: {
  question: Question; energy: number; onAction: (action: Action) => void
}) {
  const [answer, setAnswer] = useState<AnswerIndex | null>(null)
  const [bet, setBet] = useState<Bet | null>(null)
  const [seconds, setSeconds] = useState(Math.ceil(ROUND_DURATION_MS / 1000))
  const [locked, setLocked] = useState(false)
  const deadline = useRef<number | null>(null)
  const submitted = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  const submit = useCallback((action: Action) => {
    if (deadline.current === null || submitted.current) return
    submitted.current = true
    setLocked(true)
    window.clearInterval(timer.current)
    // Проверяем срок и при клике: задержанный браузером таймер не даёт лишнее время.
    onAction(performance.now() >= deadline.current ? { type: 'timeout' } : action)
  }, [onAction])

  useEffect(() => {
    deadline.current = performance.now() + ROUND_DURATION_MS
    timer.current = window.setInterval(() => {
      const remaining = Math.max(0, deadline.current! - performance.now())
      setSeconds(Math.ceil(remaining / 1000))
      if (remaining === 0) submit({ type: 'timeout' })
    }, 50)
    return () => {
      window.clearInterval(timer.current)
      deadline.current = null
    }
  }, [submit])

  return <section className="panel training-question">
    <p className={'timer-pill' + (seconds <= 4 ? ' timer-pill--urgent' : '')}
      role="timer" aria-label="Осталось времени">⏱ Осталось: <strong>{seconds}</strong> сек.</p>
    <h2>{question.text}</h2>
    <fieldset disabled={locked}>
      <legend>1. Выберите ставку</legend>
      <div className="bets">{([1, 2, 3] as const).map(value => <label key={value}>
        <input type="radio" name="bet" checked={bet === value} disabled={value > energy}
          onChange={() => setBet(value)} /> {value}
      </label>)}</div>
    </fieldset>
    <fieldset disabled={locked}>
      <legend>2. Выберите ответ</legend>
      {question.options.map((option, index) => <label key={index} className="option">
        <input type="radio" name="answer" checked={answer === index}
          onChange={() => setAnswer(index as AnswerIndex)} /> {option}
      </label>)}
    </fieldset>
    <p className="move-preview" aria-live="polite">
      {bet === null || answer === null
        ? 'Выберите ставку и ответ, чтобы подготовить ход.'
        : `Ваш ход: ставка ${bet} · возможная сила +${bet} или −${bet}. Нажмите «Подтвердить».`}
    </p>
    <div className="actions">
      <button className="button button--primary" disabled={locked || answer === null || bet === null || bet > energy}
        onClick={() => answer !== null && bet !== null && submit({ type: 'answer', answer, bet })}>
        Подтвердить
      </button>
      <button className="button button--secondary" disabled={locked} onClick={() => submit({ type: 'rest' })}>Отдохнуть</button>
    </div>
    <p className="hint">Ставка списывается при любом ответе. Отдых: +3 энергии. Время истекло: +1 энергия.</p>
  </section>
}

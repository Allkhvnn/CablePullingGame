import { useCallback, useEffect, useRef, useState } from 'react'
import { questions } from './data/questions'
import { chooseBotAction } from './game/bot'
import { calculateRound, createGame, ROUND_DURATION_MS } from './game/engine'
import type { Action, AnswerIndex, Bet, Question } from './game/types'

function Round({ question, energy, onAction }: {
  question: Question; energy: number; onAction: (action: Action) => void
}) {
  const [answer, setAnswer] = useState<AnswerIndex | null>(null)
  const [bet, setBet] = useState<Bet>(1)
  const [deadline] = useState(() => performance.now() + ROUND_DURATION_MS)
  const [seconds, setSeconds] = useState(12)
  const submitted = useRef(false)

  const submit = useCallback((action: Action) => {
    if (submitted.current) return
    submitted.current = true
    // Проверка при клике не позволяет задержке таймера дать лишнее время.
    onAction(performance.now() >= deadline ? { type: 'timeout' } : action)
  }, [deadline, onAction])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, deadline - performance.now())
      setSeconds(Math.ceil(remaining / 1000))
      if (remaining === 0) submit({ type: 'timeout' })
    }, 100)
    return () => window.clearInterval(timer)
  }, [deadline, submit])

  return <section>
    <p role="timer">Осталось: {seconds} сек.</p>
    <h2>{question.text}</h2>
    <fieldset>
      <legend>Выберите ответ</legend>
      {question.options.map((option, index) => <label key={index}>
        <input type="radio" name="answer" checked={answer === index}
          onChange={() => setAnswer(index as AnswerIndex)} /> {option}
      </label>)}
    </fieldset>
    <fieldset>
      <legend>Ставка энергии</legend>
      {([1, 2, 3] as const).map(value => <label key={value}>
        <input type="radio" name="bet" checked={bet === value} disabled={value > energy}
          onChange={() => setBet(value)} /> {value}
      </label>)}
    </fieldset>
    <button disabled={answer === null || bet > energy}
      onClick={() => answer !== null && submit({ type: 'answer', answer, bet })}>Подтвердить ответ</button>
    <button onClick={() => submit({ type: 'rest' })}>Отдохнуть (+3 энергии)</button>
  </section>
}

const actionNames = { answer: 'ответ', rest: 'отдых', timeout: 'время истекло' }

export default function App() {
  const [game, setGame] = useState(() => createGame(questions))
  const [started, setStarted] = useState(false)
  const [match, setMatch] = useState(0)
  const play = useCallback((action: Action) => {
    const botAction = chooseBotAction(game.botEnergy, Math.random(), Math.random())
    // Защита от повторного события одного раунда; updater остаётся чистым.
    setGame(current => current === game ? calculateRound(current, action, botAction) : current)
  }, [game])

  function restart() {
    setGame(createGame(questions))
    setMatch(current => current + 1)
    setStarted(true)
  }

  return <main>
    <h1>Перетягивание каната: Битва знаний</h1>
    <p>Правильный ответ: +ставка силы, ошибка: −ставка. Ставка списывается в обоих случаях.
      После ответа: +1 энергии, отдых: +3, пропуск по времени: +1. Максимум — 5.</p>
    <p>Победа на +10 (вы) или −10 (бот). После 12 вопросов решает положение каната.</p>
    <p>Энергия: вы — {game.playerEnergy}/5; бот — {game.botEnergy}/5.</p>
    <p>Канат: <strong>{game.position > 0 ? '+' : ''}{game.position}</strong> (плюс — к вам).</p>
    <p>Завершено вопросов: {game.roundsPlayed}/12.</p>
    {game.lastRound && <p role="status">
      Прошлый раунд: вы — {actionNames[game.lastRound.player.action.type]}, сила {game.lastRound.player.force};
      бот — {actionNames[game.lastRound.bot.action.type]}, сила {game.lastRound.bot.force}.
      Сдвиг: {game.lastRound.delta}.
    </p>}
    {!started ? <button onClick={() => setStarted(true)}>Начать игру</button>
      : game.winner !== null ? <h2 role="status">{game.winner === 'draw' ? 'Ничья!' : game.winner === 'player' ? 'Вы победили!' : 'Победил бот!'}</h2>
        : <Round key={`${match}-${game.roundsPlayed}`} question={game.questions[game.roundsPlayed]!}
          energy={game.playerEnergy} onAction={play} />}
    {started && <button onClick={restart}>{game.winner !== null ? 'Реванш' : 'Новая игра'}</button>}
  </main>
}

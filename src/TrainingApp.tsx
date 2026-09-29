import { useCallback, useReducer } from 'react'
import { questions } from './data/questions'
import { chooseBotAction } from './game/bot'
import { MAX_ENERGY, QUESTION_LIMIT, ROUND_DURATION_MS, WIN_POSITION } from './game/engine'
import { createSession, sessionReducer } from './game/session'
import type { Action } from './game/types'
import { Countdown } from './components/Countdown'
import { QuestionRound } from './components/QuestionRound'
import { Rope } from './components/Rope'
import { RoundReview } from './components/RoundReview'

export default function App() {
  const [session, dispatch] = useReducer(sessionReducer, questions, createSession)
  const { game, phase, matchId } = session
  const ready = useCallback(() => dispatch({ type: 'ready', matchId }), [matchId])
  const play = useCallback((player: Action) => {
    dispatch({
      type: 'submit', matchId, round: game.roundsPlayed, player,
      bot: chooseBotAction(game.botEnergy, Math.random(), Math.random()),
    })
  }, [matchId, game.roundsPlayed, game.botEnergy])
  const next = () => dispatch({ type: 'next', matchId, round: game.roundsPlayed })

  return <main>
    <h1>Перетягивание каната: Битва знаний</h1>
    {phase === 'start' ? <section className="panel">
      <h2>Правила</h2>
      <ul>
        <li>Вы и бот отвечаете на один вопрос с четырьмя вариантами.</li>
        <li>В начале у каждого {MAX_ENERGY} энергии. Это же максимум.</li>
        <li>Выберите ставку 1–3 и ответ, затем нажмите «Подтвердить».</li>
        <li>Верный ответ даёт +ставка силы, ошибка — −ставка. Энергия ставки списывается в обоих случаях, затем возвращается 1.</li>
        <li>«Отдохнуть»: 0 силы и +3 энергии, но не выше максимума.</li>
        <li>На вопрос — {ROUND_DURATION_MS / 1000} секунд. Без подтверждения: 0 силы и +1 энергия, это не отдых.</li>
        <li>Канат сдвигается на силу игрока минус силу бота.</li>
        <li>Победа при +{WIN_POSITION}, поражение при −{WIN_POSITION}. После {QUESTION_LIMIT} вопросов решает положение каната; при 0 — ничья.</li>
      </ul>
      <p>После каждого раунда можно спокойно прочитать правильный ответ и продолжить по кнопке.</p>
      <button onClick={() => dispatch({ type: 'start' })}>Начать игру</button>
    </section> : <>
      <div className="scoreboard">
        <p>Ваша энергия: <strong>{game.playerEnergy}/{MAX_ENERGY}</strong></p>
        <p>Энергия бота: <strong>{game.botEnergy}/{MAX_ENERGY}</strong></p>
      </div>
      <Rope position={game.position} />
      <p>{phase === 'question' ? `Вопрос ${game.roundsPlayed + 1} из ${QUESTION_LIMIT}` : `Завершено вопросов: ${game.roundsPlayed}/${QUESTION_LIMIT}`}</p>
      {phase === 'countdown' && <Countdown key={matchId} onComplete={ready} />}
      {phase === 'question' && <QuestionRound key={`${matchId}-${game.roundsPlayed}`}
        question={game.questions[game.roundsPlayed]!} energy={game.playerEnergy} onAction={play} />}
      {phase === 'review' && game.lastRound && <RoundReview
        question={game.questions[game.roundsPlayed - 1]!} result={game.lastRound}
        finished={game.winner !== null} onNext={next} />}
      {phase === 'result' && <section className="panel" aria-live="polite">
        <h2>{game.winner === 'draw' ? 'Ничья!' : game.winner === 'player' ? 'Вы победили!' : 'Победил бот!'}</h2>
        <p>Матч завершён. Сыграно раундов: {game.roundsPlayed}. Положение каната: {game.position}.</p>
        <button onClick={() => dispatch({ type: 'rematch' })}>Реванш</button>
      </section>}
    </>}
  </main>
}


import { useCallback, useReducer } from 'react'
import { useEffect, useState } from 'react'
import { questions } from './data/questions'
import { chooseBotAction } from './game/bot'
import { MAX_ENERGY, QUESTION_LIMIT, ROUND_DURATION_MS, WIN_POSITION } from './game/engine'
import { createSession, sessionReducer } from './game/session'
import type { Action } from './game/types'
import { Countdown } from './components/Countdown'
import { QuestionRound } from './components/QuestionRound'
import { Rope } from './components/Rope'
import { ProfilePicker } from './components/ProfilePicker'
import { usePlayerProfile } from './profile'
import { parsePlayerProfile } from '../shared/protocol'
import { RoundReview } from './components/RoundReview'

export default function App() {
  const [profile, setProfile] = usePlayerProfile()
  const [session, dispatch] = useReducer(sessionReducer, questions, createSession)
  const { game, phase, matchId } = session
  const reviewId = phase === 'review' ? `${matchId}-${game.roundsPlayed}` : null
  const [reviewSequence, setReviewSequence] = useState<{ id: string; step: number } | null>(null)
  useEffect(() => {
    if (!reviewId) return
    const answers = window.setTimeout(() => setReviewSequence({ id: reviewId, step: 1 }), 900)
    const pull = window.setTimeout(() => setReviewSequence({ id: reviewId, step: 2 }), 2200)
    const settle = window.setTimeout(() => setReviewSequence({ id: reviewId, step: 3 }), 3200)
    return () => { window.clearTimeout(answers); window.clearTimeout(pull); window.clearTimeout(settle) }
  }, [reviewId])
  const reviewStep = reviewSequence?.id === reviewId ? reviewSequence.step : 0
  const visiblePosition = phase === 'review' && game.lastRound && reviewStep < 2
    ? game.position - game.lastRound.delta : game.position
  const ready = useCallback(() => dispatch({ type: 'ready', matchId }), [matchId])
  const play = useCallback((player: Action) => {
    dispatch({
      type: 'submit', matchId, round: game.roundsPlayed, player,
      bot: chooseBotAction(game.botEnergy, Math.random(), Math.random()),
    })
  }, [matchId, game.roundsPlayed, game.botEnergy])
  const next = () => dispatch({ type: 'next', matchId, round: game.roundsPlayed })

  return <main className={'training-shell' + (phase !== 'start' ? ' training-shell--playing' : '')}>
    <span className="section-kicker">ТРЕНИРОВОЧНЫЙ РЕЖИМ</span>
    <h1>Перетягивание каната: Битва знаний</h1>
    {phase === 'start' ? <div className="training-start">
      <ProfilePicker profile={profile} onChange={setProfile} />
      <section className="panel">
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
      <button disabled={!parsePlayerProfile(profile)} onClick={() => dispatch({ type: 'start' })}>Начать игру</button>
      </section>
    </div> : <div className={'training-play-layout' + (phase === 'question' ? ' training-play-layout--question' : '')}>
      <section className="arena-panel training-arena" aria-label="Состояние матча">
        <div className="arena-panel__heading">
          <div><span className="section-kicker">ТРЕНИРОВОЧНАЯ АРЕНА</span><h2>Перетяните канат к себе</h2></div>
          <span className="round-chip">Вопрос {Math.min(game.roundsPlayed + 1, QUESTION_LIMIT)} / {QUESTION_LIMIT}</span>
        </div>
        <div className="training-energy">
          <span>Бот · энергия <strong>{game.botEnergy}/{MAX_ENERGY}</strong></span>
          <span>{profile.name} · энергия <strong>{game.playerEnergy}/{MAX_ENERGY}</strong></span>
        </div>
        <Rope position={visiblePosition} playerLabel={profile.name} opponentLabel="Бот" playerHero={profile.hero}
          pulling={phase === 'review' && reviewStep >= 2 && game.lastRound?.delta !== 0} />
        <p className="arena-footnote">Завершено вопросов: {game.roundsPlayed}/{QUESTION_LIMIT}</p>
      </section>
      {phase === 'countdown' && <Countdown key={matchId} onComplete={ready} />}
      {phase === 'question' && <QuestionRound key={`${matchId}-${game.roundsPlayed}`}
        question={game.questions[game.roundsPlayed]!} energy={game.playerEnergy} onAction={play} />}
      {phase === 'review' && game.lastRound && <RoundReview
        question={game.questions[game.roundsPlayed - 1]!} result={game.lastRound}
        finished={game.winner !== null} onNext={next} step={reviewStep} />}
      {phase === 'result' && <section className={'panel result-card ' +
        (game.winner === 'draw' ? 'result-card--draw' : game.winner === 'player' ? 'result-card--win' : 'result-card--loss')}
        aria-live="polite">
        <span className="result-emblem" aria-hidden="true">{game.winner === 'draw' ? '↔' : game.winner === 'player' ? '★' : '↘'}</span>
        <h2>{game.winner === 'draw' ? 'Ничья!' : game.winner === 'player' ? 'Вы победили!' : 'Победил бот!'}</h2>
        <p>Матч завершён. Сыграно раундов: {game.roundsPlayed}. Положение каната: {game.position}.</p>
        <button onClick={() => dispatch({ type: 'rematch' })}>Реванш</button>
      </section>}
    </div>}
  </main>
}


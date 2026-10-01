import { useEffect, useState } from 'react'
import { useRoom } from './useRoom'
import { OnlineQuestion } from './OnlineQuestion'
import { MAX_ENERGY, QUESTION_LIMIT, ROUND_DURATION_MS, WIN_POSITION } from '../game/engine'
import { Rope } from '../components/Rope'
import type { ActionResult } from '../game/types'
import type { RoomState, Seat } from '../../shared/protocol'

function describe(result: ActionResult, reveal: NonNullable<RoomState['reveal']>) {
  const action = result.action
  if (action.type === 'rest') return 'Отдых'
  if (action.type === 'timeout') return 'Время истекло'
  return reveal.question.options[action.answer] + ' (' +
    (action.answer === reveal.correctAnswer ? 'верно' : 'неверно') + '), ставка ' + action.bet
}
const forceTone = (force: number) => force > 0 ? ' force-positive' : force < 0 ? ' force-negative' : ' force-neutral'

function EnergyCard({ label, energy, own, connected }: {
  label: string; energy: number; own: boolean; connected: boolean
}) {
  return <div className={'energy-card' + (own ? ' energy-card--own' : '')}>
    <div className="energy-card__top">
      <span className="energy-card__name">{label} {own && <span className="you-tag">вы</span>}</span>
      <span className={'presence' + (connected ? ' presence--online' : '')}>
        {connected ? 'на связи' : 'не в сети'}
      </span>
    </div>
    <div className="energy-card__bottom">
      <strong>{energy}<span>/{MAX_ENERGY}</span></strong>
      <div className="energy-dots" aria-hidden="true">
        {Array.from({ length: MAX_ENERGY }, (_, i) =>
          <span key={i} className={i < energy ? 'energy-dot energy-dot--filled' : 'energy-dot'} />)}
      </div>
      <span className="energy-caption">энергия</span>
    </div>
  </div>
}

export function OnlineGame() {
  const room = useRoom()
  const [invite, setInvite] = useState('')
  const [formError, setFormError] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const state = room.state
  const identity = room.identity
  const revealId = state?.reveal ? `${state.matchId}-${state.roundsPlayed}` : null
  const [revealSequence, setRevealSequence] = useState<{ id: string; step: number } | null>(null)
  useEffect(() => {
    if (!revealId || state?.phase === 'result') return
    const first = window.setTimeout(() => setRevealSequence({ id: revealId, step: 1 }), 900)
    const pull = window.setTimeout(() => setRevealSequence({ id: revealId, step: 2 }), 2200)
    return () => { window.clearTimeout(first); window.clearTimeout(pull) }
  }, [revealId, state?.phase])
  const revealStep = state?.phase === 'result' ? 2 : revealSequence?.id === revealId ? revealSequence.step : 0
  const visiblePosition = state?.reveal && revealStep < 2
    ? state.position - state.reveal.result.delta : state?.position ?? 0
  const seconds = state
    ? Math.max(0, Math.ceil((state.paused
      ? state.remainingMs ?? 0
      : (state.deadline ?? state.serverTime) - state.serverTime) / 1000))
    : 0
  const opponent: Seat | null = identity ? (identity.seat === 'one' ? 'two' : 'one') : null
  const publicLink = identity ? window.location.origin + '/?room=' + identity.roomId : ''
  const phaseLabel = state?.paused ? 'Пауза' : state?.phase === 'waiting' ? 'Ожидание'
    : state?.phase === 'countdown' ? 'Старт' : state?.phase === 'question' ? 'Вопрос'
      : state?.phase === 'reveal' ? 'Разбор' : state?.phase === 'result' ? 'Итог' : 'Онлайн'

  const join = () => {
    let id = invite.trim()
    try { if (id.includes('://')) id = new URL(id).searchParams.get('room') ?? '' } catch { id = '' }
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) { setFormError('Вставьте ссылку-приглашение или код комнаты.'); return }
    setFormError('')
    setCopyState('idle')
    room.join(id)
  }
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(publicLink)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  return <main className="app-shell">
    <header className={'site-header' + (identity ? ' site-header--match' : '')}>
      <a className="brand" href="/" aria-label="Битва знаний — на главную">
        <span className="brand__mark" aria-hidden="true">⇄</span>
        <span>БИТВА <strong>ЗНАНИЙ</strong></span>
      </a>
      <span className="mode-badge">ИГРОК ПРОТИВ ИГРОКА</span>
    </header>

    {!identity && <div className="landing-grid">
      <section className="hero-card">
        <span className="eyebrow">ОНЛАЙН-ИГРА ДЛЯ ДВОИХ</span>
        <h1>Перетягивание каната.<br /><em>Решают знания.</em></h1>
        <p className="hero-lead">Пригласите друга, отвечайте на одни и те же вопросы и тяните канат к своей стороне.</p>
        <div className="hero-stats">
          <div><strong>{ROUND_DURATION_MS / 1000} сек</strong><span>на ответ</span></div>
          <div><strong>{QUESTION_LIMIT}</strong><span>вопросов</span></div>
          <div><strong>±{WIN_POSITION}</strong><span>границы победы</span></div>
        </div>
        <button className="button button--light button--large"
          disabled={room.status === 'connecting'}
          onClick={() => { setCopyState('idle'); room.create() }}>Создать комнату <span aria-hidden="true">↗</span></button>
        <p className="hero-note">Друг откроет вашу ссылку. Матч начнётся, когда оба будут в комнате.</p>
      </section>
      <div className="landing-side">
        <section className="panel join-card">
          <span className="section-kicker">УЖЕ ЕСТЬ ПРИГЛАШЕНИЕ?</span>
          <h2>Войти в комнату</h2>
          <label htmlFor="invite-input">Ссылка или код комнаты</label>
          <div className="join-row">
            <input id="invite-input" value={invite} onChange={e => setInvite(e.target.value)}
              placeholder="Вставьте ссылку друга" onKeyDown={e => { if (e.key === 'Enter') join() }} />
            <button className="button button--primary" disabled={room.status === 'connecting'} onClick={join}>Войти</button>
          </div>
          {formError && <p className="inline-error" role="alert">{formError}</p>}
        </section>
        <section className="panel how-card">
          <span className="section-kicker">КАК ИГРАТЬ</span>
          <h2>Три простых шага</h2>
          <ol className="steps-list">
            <li><span>01</span><p>Выберите ставку 1–3 энергии и ответьте на вопрос.</p></li>
            <li><span>02</span><p>Верный ответ тянет канат к вам, ошибка — от вас. Можно отдохнуть и вернуть 3 энергии.</p></li>
            <li><span>03</span><p>Перетяните канат до своей границы или ведите после {QUESTION_LIMIT} вопросов.</p></li>
          </ol>
          <p className="rule-note">Без ответа за {ROUND_DURATION_MS / 1000} секунд: 0 силы и +1 энергия. После ответа восстанавливается 1 энергия.</p>
          <a className="text-link" href="/?mode=training">Сначала потренироваться с ботом <span aria-hidden="true">→</span></a>
        </section>
      </div>
    </div>}

    {room.error && <p className="notice notice--error" role="alert">{room.error}</p>}
    {room.status === 'connecting' && <p className="notice" role="status">Подключаемся к серверу…</p>}

    {identity && <div className="match-layout">
      <div className="match-heading">
        <div>
          <span className="section-kicker">КОМНАТА {identity.roomId.slice(0, 8).toUpperCase()}</span>
          <h1>{state?.phase === 'waiting' ? 'Матч двух игроков' : `Вы — игрок ${identity.seat === 'one' ? '1, справа' : '2, слева'}`}</h1>
          {state?.phase === 'waiting' && <p>Пригласите друга. Ответы откроются одновременно после каждого раунда.</p>}
        </div>
        <span className="phase-badge"><span aria-hidden="true" className="phase-dot" />{phaseLabel}</span>
      </div>

      <details className={'panel invite-card' + (state?.phase !== 'waiting' ? ' invite-card--compact' : '')}
        open={state?.phase === 'waiting'}>
        <summary>{state?.phase === 'waiting' ? 'Приглашение для второго игрока' : 'Ссылка на комнату и личный ключ'}</summary>
        <div className="invite-card__intro">
          <div>
            <span className="section-kicker">ИГРА С ДРУГОМ</span>
            <h2>Ссылка-приглашение</h2>
            <p>Отправьте её второму игроку. Ваше место сохранено на этом устройстве.</p>
          </div>
          {state?.phase === 'waiting' && <span className="waiting-chip">Ожидаем соперника</span>}
        </div>
        <div className="copy-row">
          <input aria-label="Ссылка для друга" readOnly value={publicLink}
            onFocus={e => e.currentTarget.select()} />
          <button className="button button--primary" onClick={copyInvite}>
            {copyState === 'copied' ? 'Скопировано ✓' : 'Копировать'}
          </button>
        </div>
        {copyState === 'error' && <p className="inline-error" role="status">Не удалось скопировать. Выделите ссылку в поле и скопируйте вручную.</p>}
        <details className="private-link"><summary>Личная ссылка для возвращения</summary>
          <p>Это ключ вашего места. Не отправляйте его сопернику.</p>
          <input aria-label="Личная ссылка" readOnly value={publicLink + '#key=' + identity.token}
            onFocus={e => e.currentTarget.select()} />
        </details>
      </details>

      {room.status !== 'online' && <p className="notice notice--warning" role="status">
        Связь потеряна. Переподключаемся; ход пока отправить нельзя.
      </p>}

      {state && <div className={'game-stack' + (state.phase === 'question' && !state.paused ? ' game-stack--playing' : '')}>
        <section className="arena-panel" aria-label="Состояние матча">
          <div className="arena-panel__heading">
            <div><span className="section-kicker">АРЕНА</span><h2>Канат знаний</h2></div>
            <span className="round-chip">Вопрос {Math.min(state.round, QUESTION_LIMIT)} / {QUESTION_LIMIT}</span>
          </div>
          <div className="scoreboard">
            <EnergyCard label="Игрок 2" energy={state.players.two.energy}
              own={identity.seat === 'two'} connected={state.players.two.connected} />
            <div className="scoreboard__versus" aria-hidden="true">VS</div>
            <EnergyCard label="Игрок 1" energy={state.players.one.energy}
              own={identity.seat === 'one'} connected={state.players.one.connected} />
          </div>
          <Rope position={visiblePosition} playerLabel="Игрок 1" opponentLabel="Игрок 2"
            pulling={state.phase === 'reveal' && revealStep === 2 && state.reveal?.result.delta !== 0} />
          <p className="arena-footnote">Завершено вопросов: {state.roundsPlayed}/{QUESTION_LIMIT}</p>
        </section>

        {state.paused && <p className="notice notice--warning" role="status">
          Ожидаем соперника. Матч приостановлен. На возвращение: {Math.max(0, Math.ceil(((state.reconnectDeadline ?? state.serverTime) - state.serverTime) / 1000))} сек.
        </p>}
        {state.phase === 'waiting' && <section className="panel phase-card">
          <span className="phase-card__icon" aria-hidden="true">⌛</span>
          <h2>Ожидаем соперника</h2><p>Скопируйте ссылку выше и отправьте другу. После его входа начнётся отсчёт.</p>
        </section>}
        {state.phase === 'countdown' && <section className="panel phase-card" aria-live="polite">
          <span className="section-kicker">СКОРО НАЧНЁМ</span>
          <h2>Приготовьтесь!</h2><p className="countdown">{seconds || 'Старт!'}</p>
          <p>Оба игрока получат один и тот же вопрос.</p>
        </section>}
        {state.phase === 'question' && <div className="question-stage">
          <div className="round-status">
            <div>
              <span className="section-kicker">РАУНД {state.round} ИЗ {QUESTION_LIMIT}</span>
              <p>Соперник: {state.players[opponent!].submitted ? 'ход подтверждён' : 'выбирает ход'}</p>
            </div>
            <div className={'timer-pill' + (seconds <= 4 ? ' timer-pill--urgent' : '')}
              role="timer">⏱ {seconds} сек.</div>
          </div>
          <div className="timer-track" aria-hidden="true">
            <span style={{ width: Math.min(100, seconds / (ROUND_DURATION_MS / 1000) * 100) + '%' }} />
          </div>
          {state.question && <OnlineQuestion key={state.matchId + '-' + state.round + '-' + room.connectionVersion + '-' + room.errorVersion}
            question={state.question} energy={state.players[identity.seat].energy}
            disabled={state.paused || room.status !== 'online' || seconds === 0}
            submitted={state.players[identity.seat].submitted}
            onAction={action => room.send({ type: 'action', matchId: state.matchId, round: state.round, action })} />}
        </div>}
        {state.reveal && <section className="panel reveal-card" aria-live="polite">
          <div className="reveal-card__heading"><span className="section-kicker">РАУНД {state.roundsPlayed} ЗАВЕРШЁН</span>
            {revealStep >= 2 && <span className="movement-tag">Сдвиг {state.reveal.result.delta > 0 ? '+' : ''}{state.reveal.result.delta}</span>}</div>
          <h2>{revealStep === 0 ? 'Сверяем ответы…' : revealStep === 1 ? 'Силы определены'
            : state.reveal.result.delta === 0 ? 'Канат остался на месте' : 'Рывок завершён!'}</h2>
          <div className="reveal-progress" aria-label={`Этап раскрытия ${revealStep + 1} из 3`}>
            {[0, 1, 2].map(step => <span key={step} className={step <= revealStep ? 'is-active' : ''} />)}
          </div>
          <p className="review-question">{state.reveal.question.text}</p>
          {revealStep >= 1 ? <>
            <p className="correct-answer">Верный ответ: {state.reveal.question.options[state.reveal.correctAnswer]}</p>
            <div className="review-grid">
              <div className={forceTone(state.reveal.result.bot.force)}><span>ИГРОК 2 · СЛЕВА</span><p>{describe(state.reveal.result.bot, state.reveal)}.</p>
                <strong>Сила {state.reveal.result.bot.force > 0 ? '+' : ''}{state.reveal.result.bot.force}</strong></div>
              <div className={forceTone(state.reveal.result.player.force)}><span>ИГРОК 1 · СПРАВА</span><p>{describe(state.reveal.result.player, state.reveal)}.</p>
                <strong>Сила {state.reveal.result.player.force > 0 ? '+' : ''}{state.reveal.result.player.force}</strong></div>
            </div>
          </> : <p className="reveal-pending">Раунд завершён. Узнаём, кто перетянул канат.</p>}
          {revealStep >= 2 && <p className="reveal-footnote">Новое положение: {state.position > 0 ? '+' : ''}{state.position}.
            {state.phase === 'reveal' && ' Следующий вопрос через ' + seconds + ' сек.'}</p>}
        </section>}
        {state.phase === 'result' && <section className={'panel result-card ' +
          (state.winner === 'draw' ? 'result-card--draw' : state.winner === identity.seat ? 'result-card--win' : 'result-card--loss')}
          aria-live="polite">
          <span className="result-emblem" aria-hidden="true">{state.winner === 'draw' ? '↔' : state.winner === identity.seat ? '★' : '↘'}</span>
          <span className="section-kicker">МАТЧ ЗАВЕРШЁН</span>
          <h2>{state.reason === 'abandoned' ? 'Матч завершён без победителя'
            : state.winner === 'draw' ? 'Ничья!'
              : state.winner === identity.seat ? 'Вы победили!' : 'Победил соперник!'}</h2>
          <p>{state.reason === 'disconnect'
            ? 'Один из участников не вернулся за 30 секунд. Победа присуждена оставшемуся игроку.'
            : 'Финальное положение каната: ' + (state.position > 0 ? '+' : '') + state.position + '.'}</p>
          <button className="button button--primary button--large"
            disabled={room.status !== 'online' || state.players[identity.seat].rematch}
            onClick={() => room.send({ type: 'rematch', matchId: state.matchId })}>
            {state.players[identity.seat].rematch ? 'Ждём соперника…' : 'Сыграть реванш'}
          </button>
          <p className="rematch-status">Реванш: игрок 1 — {state.players.one.rematch ? 'готов' : 'ожидаем'};
            игрок 2 — {state.players.two.rematch ? 'готов' : 'ожидаем'}.</p>
          <p className="muted">Новая партия начнётся, когда оба подключены и согласились.</p>
        </section>}
      </div>}
    </div>}
    <footer className="site-footer"><a href="/">На главную</a><span>Битва знаний · игра для двоих</span></footer>
  </main>
}

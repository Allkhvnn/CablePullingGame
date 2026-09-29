import { useState } from 'react'
import { useRoom } from './useRoom'
import { OnlineQuestion } from './OnlineQuestion'
import { MAX_ENERGY, QUESTION_LIMIT, ROUND_DURATION_MS } from '../game/engine'
import { Rope } from '../components/Rope'
import type { ActionResult } from '../game/types'
import type { RoomState } from '../../shared/protocol'

function describe(result: ActionResult, reveal: NonNullable<RoomState['reveal']>) {
  const action = result.action
  if (action.type === 'rest') return 'Отдых'
  if (action.type === 'timeout') return 'Время истекло'
  return `${reveal.question.options[action.answer]} (${action.answer === reveal.correctAnswer ? 'верно' : 'неверно'}), ставка ${action.bet}`
}
export function OnlineGame() {
  const room = useRoom()
  const [invite, setInvite] = useState('')
  const [formError, setFormError] = useState('')
  const state = room.state
  const identity = room.identity
  const seconds = state ? Math.max(0, Math.ceil((state.paused ? state.remainingMs ?? 0 : (state.deadline ?? state.serverTime) - state.serverTime) / 1000)) : 0
  const join = () => {
    let id = invite.trim()
    try { if (id.includes('://')) id = new URL(id).searchParams.get('room') ?? '' } catch { id = '' }
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) { setFormError('Вставьте ссылку-приглашение или код комнаты.'); return }
    setFormError('')
    room.join(id)
  }
  const publicLink = identity ? `${window.location.origin}/?room=${identity.roomId}` : ''
  return <main>
    <h1>Перетягивание каната: Битва знаний</h1>
    <p>Онлайн-матч для двух игроков</p>
    {!identity && <section className="panel">
      <h2>Создать комнату или присоединиться</h2>
      <p>У каждого {MAX_ENERGY} энергии. Верный ответ даёт +ставка силы, ошибка −ставка.
        Ставка 1–3 списывается, затем возвращается 1 энергия. Отдых даёт +3 энергии и 0 силы.
        Без подтверждения за {ROUND_DURATION_MS / 1000} секунд: 0 силы и +1 энергия.</p>
      <p>Побеждает тот, кто перетянет канат до своей границы ±10. После {QUESTION_LIMIT} вопросов решает положение каната; при 0 — ничья.</p>
      <p>После подключения друга начнётся отсчёт. При обрыве связи матч приостанавливается на срок до 30 секунд.</p>
      <button disabled={room.status === 'connecting'} onClick={room.create}>Создать комнату</button>
      <label>Ссылка или код комнаты<input value={invite} onChange={e => setInvite(e.target.value)} /></label>
      <button disabled={room.status === 'connecting'} onClick={join}>Присоединиться</button>
      {formError && <p role="alert">{formError}</p>}
      <p><a href="/?mode=training">Тренировка с ботом</a></p>
    </section>}
    {room.error && <p role="alert">{room.error}</p>}
    {room.status === 'connecting' && <p role="status">Подключение к серверу…</p>}
    {identity && <>
      <p>Вы — игрок {identity.seat === 'one' ? '1 (справа, +)' : '2 (слева, −)'}. Комната: {identity.roomId}</p>
      <label>Ссылка для друга<input aria-label="Ссылка для друга" readOnly value={publicLink} onFocus={e => e.currentTarget.select()} /></label>
      <details><summary>Личная ссылка для возвращения</summary>
        <p>Это ключ вашего места. Не отправляйте его сопернику. На этом устройстве ключ также сохраняется автоматически.</p>
        <input aria-label="Личная ссылка" readOnly value={`${publicLink}#key=${identity.token}`} onFocus={e => e.currentTarget.select()} />
      </details>
      {room.status !== 'online' && <p role="status">Связь потеряна. Переподключаемся; ход пока отправить нельзя.</p>}
    </>}
    {state && identity && <>
      <div className="scoreboard"><p>Игрок 1: {state.players.one.energy}/{MAX_ENERGY}</p><p>Игрок 2: {state.players.two.energy}/{MAX_ENERGY}</p></div>
      <Rope position={state.position} playerLabel="Игрок 1" opponentLabel="Игрок 2" />
      <p>Завершено вопросов: {state.roundsPlayed}/{QUESTION_LIMIT}</p>
      {state.paused && <p role="status">Ожидаем соперника. Матч приостановлен.
        На возвращение: {Math.max(0, Math.ceil(((state.reconnectDeadline ?? state.serverTime) - state.serverTime) / 1000))} сек.</p>}
      {state.phase === 'waiting' && <h2>Ожидаем соперника — отправьте другу ссылку.</h2>}
      {state.phase === 'countdown' && <section className="panel"><h2>Приготовьтесь!</h2><p className="countdown">{seconds || 'Старт!'}</p></section>}
      {state.phase === 'question' && <>
        <p role="timer">Вопрос {state.round}. Осталось: {seconds} сек.</p>
        <p>Соперник: {state.players[identity.seat === 'one' ? 'two' : 'one'].submitted ? 'ход подтверждён' : 'выбирает ход'}</p>
        {state.question && <OnlineQuestion key={`${state.matchId}-${state.round}-${room.connectionVersion}-${room.errorVersion}`}
          question={state.question} energy={state.players[identity.seat].energy}
          disabled={state.paused || room.status !== 'online' || seconds === 0}
          submitted={state.players[identity.seat].submitted}
          onAction={action => room.send({ type: 'action', matchId: state.matchId, round: state.round, action })} />}
      </>}
      {state.reveal && <section className="panel">
        <h2>Результат раунда</h2>
        <p>{state.reveal.question.text}</p>
        <p>Правильный ответ: <strong>{state.reveal.question.options[state.reveal.correctAnswer]}</strong></p>
        <p>Игрок 1: {describe(state.reveal.result.player, state.reveal)}. Сила: {state.reveal.result.player.force}.</p>
        <p>Игрок 2: {describe(state.reveal.result.bot, state.reveal)}. Сила: {state.reveal.result.bot.force}.</p>
        <p>Сдвиг: {state.reveal.result.delta}. Положение: {state.position}.</p>
        {state.phase === 'reveal' && <p>Продолжение через {seconds} сек.</p>}
      </section>}
      {state.phase === 'result' && <section className="panel">
        <h2>{state.reason === 'abandoned' ? 'Матч завершён без победителя' : state.winner === 'draw' ? 'Ничья!' : state.winner === identity.seat ? 'Вы победили!' : 'Победил соперник!'}</h2>
        {state.reason === 'disconnect' && <p>Один из участников не вернулся за 30 секунд. Победа присуждена оставшемуся игроку.</p>}
        <button disabled={room.status !== 'online' || state.players[identity.seat].rematch}
          onClick={() => room.send({ type: 'rematch', matchId: state.matchId })}>Реванш</button>
        <p>Согласие на реванш: игрок 1 — {state.players.one.rematch ? 'да' : 'нет'}; игрок 2 — {state.players.two.rematch ? 'да' : 'нет'}.</p>
        <p>Новая партия начнётся, когда оба подключены и согласились.</p>
      </section>}
    </>}
    <p><a href="/">На главную</a></p>
  </main>
}

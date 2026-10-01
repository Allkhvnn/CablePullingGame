import { describe, expect, it } from 'vitest'
import { Rooms } from './rooms'
import type { Peer } from './rooms'
import type { ServerMessage } from '../shared/protocol'
import type { Question } from '../src/game/types'
import { COUNTDOWN_MS, RECONNECT_MS, REVEAL_MS, ROOM_RETENTION_MS } from './config'
import { ROUND_DURATION_MS } from '../src/game/engine'

export const testQuestions = (): Question[] => Array.from({ length: 12 }, (_, i) => ({
  id: `q${i}`, text: `Вопрос ${i}`, options: ['верный', 'нет', 'неверно', 'ошибка'], correctAnswer: 0,
}))
function peer() {
  const messages: ServerMessage[] = []
  const client: Peer = { send: m => messages.push(structuredClone(m)), close() {} }
  return { client, messages,
    state: () => (messages.findLast(m => m.type === 'state') as Extract<ServerMessage, { type: 'state' }>).state,
    joined: () => messages.find(m => m.type === 'joined') as Extract<ServerMessage, { type: 'joined' }>,
    error: () => messages.findLast(m => m.type === 'error') as Extract<ServerMessage, { type: 'error' }>,
  }
}
function fixture(start = true) {
  let now = 1000
  const rooms = new Rooms(() => now, testQuestions)
  const one = peer(); const two = peer()
  rooms.receive(one.client, { type: 'create' })
  const roomId = one.joined().roomId
  const advance = (ms: number) => { now += ms; rooms.tick() }
  const join = () => rooms.receive(two.client, { type: 'join', roomId })
  if (start) { join(); advance(COUNTDOWN_MS) }
  const action = (p: typeof one, value: unknown = { type: 'rest' }, round = one.state().round, matchId = one.state().matchId) => {
    rooms.receive(p.client, { type: 'action', action: value, round, matchId })
  }
  return { rooms, one, two, roomId, advance, action, join }
}

describe('Сервер комнат', () => {
  it('проверяет профиль на сервере и сохраняет его при возвращении', () => {
    const rooms = new Rooms(() => 1000, testQuestions)
    const one = peer(); const two = peer()
    rooms.receive(one.client, { type: 'create', profile: { name: ' Алия ', hero: 'owl' } })
    const roomId = one.joined().roomId
    rooms.receive(two.client, { type: 'join', roomId, profile: { name: 'Макс', hero: 'cat' } })
    expect(one.state().players.one.profile).toEqual({ name: 'Алия', hero: 'owl' })
    expect(two.state().players.two.profile).toEqual({ name: 'Макс', hero: 'cat' })
    rooms.disconnect(one.client)
    const returned = peer()
    rooms.receive(returned.client, { type: 'resume', roomId, token: one.joined().token,
      profile: { name: 'Чужой', hero: 'bear' } })
    expect(returned.state().players.one.profile).toEqual({ name: 'Алия', hero: 'owl' })
    const invalid = peer()
    rooms.receive(invalid.client, { type: 'create', profile: { name: '<script>', hero: 'fox' } })
    expect(invalid.error().code).toBe('INVALID_MESSAGE')
  })
  it('начинает только после входа второго; третий участник не занимает место', () => {
    const f = fixture(false)
    expect(f.one.state().phase).toBe('waiting')
    f.action(f.one)
    expect(f.one.error().code).toBe('WRONG_PHASE')
    f.join()
    expect(f.one.state().phase).toBe('countdown')
    f.action(f.one)
    expect(f.one.error().code).toBe('WRONG_PHASE')
    const third = peer()
    f.rooms.receive(third.client, { type: 'join', roomId: f.roomId })
    expect(third.error().code).toBe('ROOM_FULL')
    f.advance(COUNTDOWN_MS)
    expect(f.one.state()).toEqual(f.two.state())
    expect(f.one.state().phase).toBe('question')
  })
  it('не раскрывает правильный ответ, токены или ход соперника раньше времени', () => {
    const f = fixture()
    f.action(f.one, { type: 'answer', answer: 0, bet: 3 })
    const state = f.two.state()
    expect(state.question).toEqual({ id: 'q0', text: 'Вопрос 0', options: ['верный', 'нет', 'неверно', 'ошибка'] })
    expect(state.reveal).toBeNull()
    expect(state.players.one.submitted).toBe(true)
    const serialized = JSON.stringify(state)
    for (const secret of ['correctAnswer', '"answer":', '"bet":', f.one.joined().token, f.two.joined().token]) {
      expect(serialized).not.toContain(secret)
    }
    expect(state.players.one.energy).toBe(5)
  })
  it('рассчитывает один раз, когда оба ответили, и рассылает одинаковый результат', () => {
    const f = fixture()
    f.action(f.one, { type: 'answer', answer: 0, bet: 3 })
    f.action(f.one, { type: 'answer', answer: 1, bet: 1 })
    expect(f.one.error().code).toBe('ALREADY_SUBMITTED')
    f.action(f.two, { type: 'answer', answer: 1, bet: 2 })
    expect(f.one.state()).toEqual(f.two.state())
    expect(f.one.state()).toMatchObject({ phase: 'reveal', roundsPlayed: 1, position: 5,
      players: { one: { energy: 3 }, two: { energy: 4 } }, reveal: { correctAnswer: 0 } })
    f.action(f.two)
    expect(f.two.error().code).toBe('WRONG_PHASE')
    f.advance(REVEAL_MS)
    expect(f.one.state().roundsPlayed).toBe(1)
    expect(f.one.state().reveal).toBeNull()
    f.action(f.one, { type: 'rest' }, 1)
    expect(f.one.error().code).toBe('STALE_ROUND')
  })
  it.each([
    { type: 'answer', answer: 0, bet: 0 }, { type: 'answer', answer: 0, bet: 4 },
    { type: 'answer', answer: 0, bet: 1.5 }, { type: 'answer', answer: 4, bet: 1 },
    { type: 'answer', answer: -1, bet: 1 }, { type: 'answer', answer: '0', bet: 1 },
    { type: 'answer', answer: 0, bet: '1' }, { type: 'timeout' }, null,
  ])('отклоняет недопустимый ход %j', action => {
    const f = fixture()
    f.action(f.one, action)
    expect(f.one.error().code).toBe('INVALID_MESSAGE')
    expect(f.one.state().players.one.submitted).toBe(false)
  })
  it('проверяет принадлежность соединения и личный ключ', () => {
    const f = fixture(); const outsider = peer()
    f.action(outsider)
    expect(outsider.error().code).toBe('UNAUTHORIZED')
    f.rooms.receive(outsider.client, { type: 'resume', roomId: f.roomId, token: 'a'.repeat(64) })
    expect(outsider.error().code).toBe('UNAUTHORIZED')
    f.rooms.receive(f.one.client, { type: 'join', roomId: f.roomId })
    expect(f.one.error().code).toBe('ALREADY_JOINED')
  })
  it('не позволяет передать чужой seat и исполнить ход за соперника', () => {
    const f = fixture()
    f.rooms.receive(f.one.client, { type: 'action', seat: 'two', roomId: 'another', matchId: 1, round: 1, action: { type: 'rest' } })
    expect(f.two.state().players.one.submitted).toBe(true)
    expect(f.two.state().players.two.submitted).toBe(false)
  })
  it('не принимает ставку выше доступной энергии', () => {
    const f = fixture()
    for (let i = 0; i < 2; i++) {
      f.action(f.one, { type: 'answer', answer: 0, bet: 3 })
      f.action(f.two, { type: 'answer', answer: 0, bet: 3 })
      f.advance(REVEAL_MS)
    }
    expect(f.one.state().players.one.energy).toBe(1)
    f.action(f.one, { type: 'answer', answer: 0, bet: 2 })
    expect(f.one.error().code).toBe('NOT_ENOUGH_ENERGY')
    expect(f.one.state().players.one.submitted).toBe(false)
  })
  it('по сроку сохраняет принятый ход, второму ставит timeout с +1 энергии', () => {
    const f = fixture()
    f.action(f.one, { type: 'answer', answer: 0, bet: 3 })
    f.action(f.two, { type: 'answer', answer: 0, bet: 3 })
    f.advance(REVEAL_MS)
    f.action(f.one, { type: 'rest' })
    f.advance(ROUND_DURATION_MS)
    expect(f.one.state()).toMatchObject({ position: 0, roundsPlayed: 2,
      players: { one: { energy: 5 }, two: { energy: 4 } },
      reveal: { result: { bot: { action: { type: 'timeout' }, force: 0 } } } })
  })
  it('завершает матч по границе и игнорирует дальнейшие действия', () => {
    const f = fixture()
    for (let i = 0; i < 2; i++) {
      f.action(f.one, { type: 'answer', answer: 0, bet: 3 })
      f.action(f.two, { type: 'answer', answer: 1, bet: 3 })
      f.advance(REVEAL_MS)
    }
    expect(f.one.state()).toMatchObject({ phase: 'result', winner: 'one', position: 12 })
    f.action(f.one)
    f.advance(ROUND_DURATION_MS)
    expect(f.one.state().roundsPlayed).toBe(2)
  })
  it('играет 12 вопросов и требует согласия обоих для чистого реванша', () => {
    const f = fixture()
    for (let i = 0; i < 12; i++) { f.action(f.one); f.action(f.two); f.advance(REVEAL_MS) }
    expect(f.one.state()).toMatchObject({ phase: 'result', winner: 'draw', roundsPlayed: 12 })
    f.rooms.receive(f.one.client, { type: 'rematch', matchId: 1 })
    f.rooms.receive(f.one.client, { type: 'rematch', matchId: 1 })
    expect(f.two.state().phase).toBe('result')
    f.rooms.receive(f.two.client, { type: 'rematch', matchId: 1 })
    expect(f.one.state()).toMatchObject({ phase: 'countdown', matchId: 2, roundsPlayed: 0, position: 0, winner: null, reveal: null })
    expect(f.one.state().players.one.energy).toBe(5)
    expect(f.one.state().players.one.profile).toEqual({ name: 'Игрок 1', hero: 'fox' })
    expect(f.one.state().players.two.profile).toEqual({ name: 'Игрок 2', hero: 'bear' })
    f.advance(COUNTDOWN_MS)
    f.action(f.one, { type: 'rest' }, 1, 1)
    expect(f.one.error().code).toBe('STALE_MATCH')
  })
  it('при отключении сохраняет остаток времени, ход и занятое место', () => {
    const f = fixture()
    f.advance(4000)
    f.action(f.two)
    f.rooms.disconnect(f.two.client)
    expect(f.one.state()).toMatchObject({ paused: true, remainingMs: 8000, deadline: null })
    const stranger = peer()
    f.rooms.receive(stranger.client, { type: 'join', roomId: f.roomId })
    expect(stranger.error().code).toBe('ROOM_FULL')
    f.action(f.one)
    expect(f.one.error().code).toBe('WRONG_PHASE')
    f.advance(20_000)
    const returned = peer()
    f.rooms.receive(returned.client, { type: 'resume', roomId: f.roomId, token: f.two.joined().token })
    expect(returned.state()).toMatchObject({ paused: false, players: { two: { submitted: true } } })
    expect(returned.state().deadline! - returned.state().serverTime).toBe(8000)
    f.action(f.one)
    expect(returned.state().phase).toBe('reveal')
  })
  it('после grace-периода побеждает оставшийся; поздний возврат не меняет исход', () => {
    const f = fixture()
    f.rooms.disconnect(f.two.client)
    f.advance(RECONNECT_MS)
    expect(f.one.state()).toMatchObject({ phase: 'result', winner: 'one', reason: 'disconnect' })
    const returned = peer()
    f.rooms.receive(returned.client, { type: 'resume', roomId: f.roomId, token: f.two.joined().token })
    expect(returned.state().winner).toBe('one')
  })
  it('если отсутствуют оба, завершает без победителя и очищает забытую комнату', () => {
    const f = fixture()
    f.rooms.disconnect(f.one.client); f.rooms.disconnect(f.two.client)
    f.advance(RECONNECT_MS)
    const returned = peer()
    f.rooms.receive(returned.client, { type: 'resume', roomId: f.roomId, token: f.one.joined().token })
    expect(returned.state()).toMatchObject({ phase: 'result', winner: 'draw', reason: 'abandoned' })
    f.rooms.disconnect(returned.client)
    f.advance(ROOM_RETENTION_MS + 1)
    const later = peer()
    f.rooms.receive(later.client, { type: 'resume', roomId: f.roomId, token: f.one.joined().token })
    expect(later.error().code).toBe('NOT_FOUND')
  })
  it('старое соединение после resume теряет права', () => {
    const f = fixture(); const replacement = peer()
    f.rooms.receive(replacement.client, { type: 'resume', roomId: f.roomId, token: f.one.joined().token })
    f.rooms.disconnect(f.one.client)
    f.action(f.one)
    expect(f.one.error().code).toBe('UNAUTHORIZED')
    expect(f.two.state().paused).toBe(false)
  })
})

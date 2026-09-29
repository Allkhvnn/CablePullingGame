import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import type { AddressInfo } from 'node:net'
import { createGameServer } from './app'
import { Rooms } from './rooms'
import { COUNTDOWN_MS, REVEAL_MS } from './config'
import type { ClientMessage, RoomState, ServerMessage } from '../shared/protocol'
import type { Question } from '../src/game/types'

const sockets: WebSocket[] = []
let app: ReturnType<typeof createGameServer> | undefined
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate()
  await app?.close()
  app = undefined
})
async function connect(url: string) {
  const socket = new WebSocket(url)
  sockets.push(socket)
  const messages: ServerMessage[] = []
  socket.on('message', raw => messages.push(JSON.parse(raw.toString()) as ServerMessage))
  await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  async function waitFor(predicate: (m: ServerMessage) => boolean): Promise<ServerMessage> {
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      const message = messages.findLast(predicate)
      if (message) return message
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    throw new Error('Не получено ожидаемое сообщение WebSocket')
  }
  return { socket, messages, waitFor,
    send: (m: ClientMessage) => socket.send(JSON.stringify(m)),
    state: async (predicate: (s: RoomState) => boolean) =>
      (await waitFor(m => m.type === 'state' && predicate(m.state)) as Extract<ServerMessage, { type: 'state' }>).state,
    joined: async () => await waitFor(m => m.type === 'joined') as Extract<ServerMessage, { type: 'joined' }>,
  }
}

describe('Реальные WebSocket-соединения', () => {
  it('два клиента проходят матч, получают одинаковый итог и вместе начинают реванш', async () => {
    let now = 1000
    const factory = (): Question[] => Array.from({ length: 12 }, (_, i) => ({ id: String(i), text: `Вопрос ${i}`, options: ['a', 'b', 'c', 'd'], correctAnswer: 0 }))
    const rooms = new Rooms(() => now, factory)
    app = createGameServer(rooms)
    await new Promise<void>(resolve => app!.server.listen(0, '127.0.0.1', resolve))
    const port = (app.server.address() as AddressInfo).port
    expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200)
    expect((await fetch(`http://127.0.0.1:${port}/server/questions.ts`)).status).toBe(404)
    const url = `ws://127.0.0.1:${port}/ws`
    const one = await connect(url)
    one.send({ type: 'create' })
    const owner = await one.joined()
    const two = await connect(url)
    two.send({ type: 'join', roomId: owner.roomId })
    await two.joined()
    await one.state(s => s.phase === 'countdown')
    const third = await connect(url)
    third.send({ type: 'join', roomId: owner.roomId })
    expect(await third.waitFor(m => m.type === 'error')).toMatchObject({ code: 'ROOM_FULL' })
    now += COUNTDOWN_MS; rooms.tick()
    for (let round = 1; round <= 12; round++) {
      const current = await one.state(s => s.phase === 'question' && s.round === round)
      expect(current.question).not.toHaveProperty('correctAnswer')
      expect(current.reveal).toBeNull()
      one.send({ type: 'action', matchId: 1, round, action: { type: 'rest' } })
      const waiting = await two.state(s => s.phase === 'question' && s.round === round && s.players.one.submitted)
      expect(waiting.reveal).toBeNull()
      expect(waiting).not.toHaveProperty('actions')
      two.send({ type: 'action', matchId: 1, round, action: { type: 'rest' } })
      const first = await one.state(s => s.phase === 'reveal' && s.roundsPlayed === round)
      const second = await two.state(s => s.phase === 'reveal' && s.roundsPlayed === round)
      expect(first).toEqual(second)
      now += REVEAL_MS; rooms.tick()
    }
    await one.state(s => s.phase === 'result' && s.winner === 'draw')
    one.send({ type: 'rematch', matchId: 1 })
    expect(await two.state(s => s.players.one.rematch)).toMatchObject({ phase: 'result', matchId: 1 })
    two.send({ type: 'rematch', matchId: 1 })
    expect(await one.state(s => s.phase === 'countdown' && s.matchId === 2)).toMatchObject({ position: 0, roundsPlayed: 0, winner: null })
  })

  it('после разрыва соединения ключ возвращает прежнее место, публичная ссылка — нет', async () => {
    app = createGameServer()
    await new Promise<void>(resolve => app!.server.listen(0, '127.0.0.1', resolve))
    const url = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/ws`
    const one = await connect(url); one.send({ type: 'create' }); const owner = await one.joined()
    const two = await connect(url); two.send({ type: 'join', roomId: owner.roomId }); const guest = await two.joined()
    two.socket.close()
    await one.state(s => s.paused && !s.players.two.connected)
    const stranger = await connect(url); stranger.send({ type: 'join', roomId: owner.roomId })
    expect(await stranger.waitFor(m => m.type === 'error')).toMatchObject({ code: 'ROOM_FULL' })
    const returned = await connect(url)
    returned.send({ type: 'resume', roomId: owner.roomId, token: guest.token })
    expect(await returned.joined()).toEqual(guest)
    expect(await returned.state(s => !s.paused && s.players.two.connected)).toMatchObject({ phase: 'countdown' })
    returned.socket.send('{invalid-json')
    expect(await returned.waitFor(m => m.type === 'error')).toMatchObject({ code: 'INVALID_MESSAGE' })
  })
})

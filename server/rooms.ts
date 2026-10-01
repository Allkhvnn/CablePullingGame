import { randomBytes, randomUUID } from 'node:crypto'
import { calculateRound, createGame, QUESTION_LIMIT, ROUND_DURATION_MS } from '../src/game/engine'
import type { GameState, Question } from '../src/game/types'
import { parseClientMessage } from '../shared/protocol'
import type { PlayerAction, PlayerProfile, PublicQuestion, RoomState, Seat, ServerMessage } from '../shared/protocol'
import { COUNTDOWN_MS, RECONNECT_MS, REVEAL_MS, ROOM_RETENTION_MS } from './config'
import { selectQuestions } from './questions'

export interface Peer { send: (message: ServerMessage) => void; close: () => void }
interface Player { token: string; peer: Peer | null; disconnectedUntil: number | null; rematch: boolean; profile: PlayerProfile }
interface Room {
  id: string; matchId: number; game: GameState; phase: RoomState['phase']
  players: Record<Seat, Player | null>; actions: Partial<Record<Seat, PlayerAction>>
  deadline: number | null; remainingMs: number | null
  reason: RoomState['reason']; updatedAt: number
}
const seats: Seat[] = ['one', 'two']
const other = (seat: Seat): Seat => seat === 'one' ? 'two' : 'one'
const publicQuestion = (q: Question): PublicQuestion => ({ id: q.id, text: q.text, options: [...q.options] })

export class Rooms {
  private rooms = new Map<string, Room>()
  private members = new Map<Peer, { room: Room; seat: Seat }>()
  constructor(private now = Date.now, private questionFactory = selectQuestions) {}

  private error(peer: Peer, code: string, message: string) {
    peer.send({ type: 'error', code, message })
  }
  private bothOnline(room: Room) { return seats.every(s => room.players[s]?.peer) }
  private paused(room: Room) { return room.remainingMs !== null }
  private schedule(room: Room, phase: RoomState['phase'], ms: number) {
    room.phase = phase
    room.deadline = this.now() + ms
    room.remainingMs = null
    room.updatedAt = this.now()
  }
  private start(room: Room) {
    room.game = createGame(this.questionFactory())
    room.actions = {}
    room.reason = null
    for (const seat of seats) room.players[seat]!.rematch = false
    this.schedule(room, 'countdown', COUNTDOWN_MS)
  }
  private bind(peer: Peer, room: Room, seat: Seat) {
    const player = room.players[seat]!
    // Знание личного ключа позволяет заменить старое соединение, но не создать второе место.
    if (player.peer && player.peer !== peer) {
      this.members.delete(player.peer)
      player.peer.close()
    }
    player.peer = peer
    player.disconnectedUntil = null
    this.members.set(peer, { room, seat })
    room.updatedAt = this.now()
    peer.send({ type: 'joined', roomId: room.id, seat, token: player.token })
    if (this.bothOnline(room)) {
      if (room.phase === 'waiting') this.start(room)
      else if (this.paused(room)) {
        room.deadline = this.now() + room.remainingMs!
        room.remainingMs = null
      }
    }
    this.broadcast(room)
  }

  receive(peer: Peer, raw: unknown) {
    const message = parseClientMessage(raw)
    if (!message) return this.error(peer, 'INVALID_MESSAGE', 'Некорректное сообщение.')
    if (message.type === 'create' || message.type === 'join' || message.type === 'resume') {
      if (this.members.has(peer)) return this.error(peer, 'ALREADY_JOINED', 'Соединение уже участвует в комнате.')
      if (message.type === 'create') {
        if (this.rooms.size >= 1000) return this.error(peer, 'CAPACITY', 'Сервер заполнен. Попробуйте позже.')
        const room: Room = { id: randomUUID(), matchId: 1, game: createGame(this.questionFactory()),
          phase: 'waiting', players: { one: { token: randomBytes(32).toString('hex'), peer: null, disconnectedUntil: null, rematch: false,
            profile: message.profile ?? { name: 'Игрок 1', hero: 'fox' } }, two: null },
          actions: {}, deadline: null, remainingMs: null, reason: null, updatedAt: this.now() }
        this.rooms.set(room.id, room)
        this.bind(peer, room, 'one')
        return
      }
      const room = this.rooms.get(message.roomId)
      if (!room) return this.error(peer, 'NOT_FOUND', 'Комната не найдена или уже удалена.')
      this.advance(room)
      if (message.type === 'join') {
        if (room.players.two || room.phase !== 'waiting') return this.error(peer, 'ROOM_FULL', 'Места заняты. Для возвращения нужен личный ключ участника.')
        room.players.two = { token: randomBytes(32).toString('hex'), peer: null, disconnectedUntil: null, rematch: false,
          profile: message.profile ?? { name: 'Игрок 2', hero: 'bear' } }
        this.bind(peer, room, 'two')
        return
      }
      const seat = seats.find(s => room.players[s]?.token === message.token)
      if (!seat) return this.error(peer, 'UNAUTHORIZED', 'Личный ключ участника не подходит.')
      this.bind(peer, room, seat)
      return
    }

    const membership = this.members.get(peer)
    if (!membership) return this.error(peer, 'UNAUTHORIZED', 'Сначала войдите в комнату.')
    const { room, seat } = membership
    this.advance(room)
    if (message.matchId !== room.matchId) return this.error(peer, 'STALE_MATCH', 'Это действие относится к прошлому матчу.')
    if (message.type === 'rematch') {
      if (room.phase !== 'result') return this.error(peer, 'WRONG_PHASE', 'Реванш доступен после завершения матча.')
      room.players[seat]!.rematch = true
      if (this.bothOnline(room) && seats.every(s => room.players[s]!.rematch)) {
        room.matchId++
        this.start(room)
      }
      this.broadcast(room)
      return
    }
    if (room.phase !== 'question' || this.paused(room)) return this.error(peer, 'WRONG_PHASE', 'Сейчас нельзя отправить ход.')
    if (message.round !== room.game.roundsPlayed + 1) return this.error(peer, 'STALE_ROUND', 'Раунд уже сменился.')
    if (room.actions[seat]) return this.error(peer, 'ALREADY_SUBMITTED', 'Ваш ход уже принят.')
    const energy = seat === 'one' ? room.game.playerEnergy : room.game.botEnergy
    if (message.action.type === 'answer' && message.action.bet > energy) {
      return this.error(peer, 'NOT_ENOUGH_ENERGY', 'Недостаточно энергии для ставки.')
    }
    room.actions[seat] = message.action
    room.updatedAt = this.now()
    if (room.actions.one && room.actions.two) this.resolve(room)
    this.broadcast(room)
  }

  private resolve(room: Room) {
    if (room.phase !== 'question') return
    room.game = calculateRound(room.game, room.actions.one ?? { type: 'timeout' }, room.actions.two ?? { type: 'timeout' })
    if (room.game.winner !== null) room.reason = 'normal'
    this.schedule(room, 'reveal', REVEAL_MS)
  }
  private advance(room: Room) {
    const now = this.now()
    if (room.phase !== 'result' && room.game.winner === null) {
      const expired = seats.find(s => {
        const deadline = room.players[s]?.disconnectedUntil
        return deadline != null && now >= deadline
      })
      if (expired) {
        const survivor = room.players[other(expired)]?.peer ? other(expired) : null
        room.game = { ...room.game, winner: survivor === 'one' ? 'player' : survivor === 'two' ? 'bot' : 'draw' }
        room.phase = 'result'
        room.reason = survivor ? 'disconnect' : 'abandoned'
        room.deadline = null
        room.remainingMs = null
        room.updatedAt = now
        return
      }
    }
    if (this.paused(room) || room.deadline === null || now < room.deadline) return
    if (room.phase === 'countdown') this.schedule(room, 'question', ROUND_DURATION_MS)
    else if (room.phase === 'question') this.resolve(room)
    else if (room.phase === 'reveal') {
      if (room.game.winner !== null) { room.phase = 'result'; room.deadline = null }
      else { room.actions = {}; this.schedule(room, 'question', ROUND_DURATION_MS) }
    }
  }
  disconnect(peer: Peer) {
    const member = this.members.get(peer)
    if (!member) return
    this.members.delete(peer)
    const { room, seat } = member
    this.advance(room)
    const player = room.players[seat]!
    player.peer = null
    player.rematch = false
    player.disconnectedUntil = this.now() + RECONNECT_MS
    room.updatedAt = this.now()
    if (room.phase !== 'result' && room.game.winner === null && !this.paused(room)) {
      room.remainingMs = room.deadline === null ? 0 : Math.max(0, room.deadline - this.now())
      room.deadline = null
    }
    this.broadcast(room)
  }

  // Только разрешённые публичные поля. Секреты и ожидающие ходы сюда не попадают.
  private snapshot(room: Room): RoomState {
    const game = room.game
    const shown = (room.phase === 'reveal' || room.phase === 'result') && game.lastRound
      ? game.questions[game.roundsPlayed - 1]! : null
    const playerState = (seat: Seat) => ({
      occupied: room.players[seat] !== null, connected: !!room.players[seat]?.peer,
      energy: seat === 'one' ? game.playerEnergy : game.botEnergy,
      submitted: !!room.actions[seat], rematch: room.players[seat]?.rematch ?? false,
      profile: room.players[seat]?.profile ?? null,
    })
    const reconnectTimes = seats.flatMap(s => {
      const p = room.players[s]
      return p && !p.peer && p.disconnectedUntil !== null ? [p.disconnectedUntil] : []
    })
    return {
      roomId: room.id, matchId: room.matchId, phase: room.phase, serverTime: this.now(),
      deadline: room.deadline, paused: this.paused(room), remainingMs: room.remainingMs,
      reconnectDeadline: reconnectTimes.length ? Math.min(...reconnectTimes) : null,
      players: { one: playerState('one'), two: playerState('two') },
      roundsPlayed: game.roundsPlayed, round: Math.min(QUESTION_LIMIT, game.roundsPlayed + 1),
      position: game.position,
      question: room.phase === 'question' ? publicQuestion(game.questions[game.roundsPlayed]!) : null,
      reveal: shown ? { question: publicQuestion(shown), correctAnswer: shown.correctAnswer, result: game.lastRound! } : null,
      winner: game.winner === 'player' ? 'one' : game.winner === 'bot' ? 'two' : game.winner,
      reason: room.reason,
    }
  }
  private broadcast(room: Room) {
    const message: ServerMessage = { type: 'state', state: this.snapshot(room) }
    for (const seat of seats) room.players[seat]?.peer?.send(message)
  }
  tick() {
    for (const room of this.rooms.values()) {
      this.advance(room)
      if (seats.every(s => !room.players[s]?.peer) && this.now() - room.updatedAt > ROOM_RETENTION_MS) {
        this.rooms.delete(room.id)
      } else this.broadcast(room)
    }
  }
}

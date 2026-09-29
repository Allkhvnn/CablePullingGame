// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useRoom } from './useRoom'
import type { ServerMessage } from '../../shared/protocol'

class FakeSocket {
  static OPEN = 1
  static instances: FakeSocket[] = []
  readyState = 0
  sent: unknown[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  constructor() { FakeSocket.instances.push(this) }
  send(data: string) { this.sent.push(JSON.parse(data)) }
  open() { this.readyState = 1; this.onopen?.() }
  receive(message: ServerMessage) { this.onmessage?.({ data: JSON.stringify(message) }) }
  close(code = 1000) { this.readyState = 3; this.onclose?.({ code }) }
}
const identity = { type: 'joined' as const, roomId: 'room-one', seat: 'one' as const, token: 'b'.repeat(64) }
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', FakeSocket)
  FakeSocket.instances = []
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('личная ссылка работает в StrictMode и сохраняет ключ только своего места', () => {
  window.history.replaceState(null, '', `/?room=room-one#key=${identity.token}`)
  const { result } = renderHook(useRoom, { wrapper: StrictMode })
  const socket = FakeSocket.instances.at(-1)!
  act(() => socket.open())
  expect(socket.sent).toEqual([{ type: 'resume', roomId: identity.roomId, token: identity.token }])
  act(() => socket.receive(identity))
  expect(result.current.status).toBe('online')
  expect(localStorage.getItem('cable-room:room-one')).toBe(identity.token)
  expect(window.location.hash).toBe('')
})

it('после разрыва автоматически делает resume, а не новый join или повтор хода', () => {
  const { result, unmount } = renderHook(useRoom)
  act(() => result.current.create())
  const first = FakeSocket.instances.at(-1)!
  act(() => { first.open(); first.receive(identity) })
  act(() => first.close())
  expect(result.current.status).toBe('offline')
  expect(result.current.send({ type: 'rematch', matchId: 1 })).toBe(false)
  act(() => vi.advanceTimersByTime(1000))
  const second = FakeSocket.instances.at(-1)!
  act(() => second.open())
  expect(second.sent).toEqual([{ type: 'resume', roomId: identity.roomId, token: identity.token }])
  act(() => second.receive(identity))
  expect(result.current.status).toBe('online')
  act(() => second.close(4001))
  act(() => vi.advanceTimersByTime(5000))
  expect(FakeSocket.instances).toHaveLength(2)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('после удаления комнаты сервером возвращает на экран создания', () => {
  const { result } = renderHook(useRoom)
  act(() => result.current.create())
  const first = FakeSocket.instances.at(-1)!
  act(() => { first.open(); first.receive(identity); first.close() })
  act(() => vi.advanceTimersByTime(1000))
  const second = FakeSocket.instances.at(-1)!
  act(() => second.open())
  act(() => second.receive({ type: 'error', code: 'NOT_FOUND', message: 'Комната не найдена.' }))
  expect(result.current.identity).toBeNull()
  expect(result.current.state).toBeNull()
  expect(result.current.error).toContain('Комната не найдена')
  expect(localStorage.getItem('cable-room:room-one')).toBeNull()
  expect(window.location.search).toBe('')
  act(() => result.current.create())
  expect(FakeSocket.instances).toHaveLength(3)
})

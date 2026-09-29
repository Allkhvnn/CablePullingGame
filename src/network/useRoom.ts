import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientMessage, RoomState, Seat, ServerMessage } from '../../shared/protocol'

type Entry = Extract<ClientMessage, { type: 'create' | 'join' | 'resume' }>
interface Identity { roomId: string; seat: Seat; token: string }
const storageKey = (roomId: string) => `cable-room:${roomId}`

function initialEntry(): Entry | null {
  const url = new URL(window.location.href)
  const roomId = url.searchParams.get('room')
  if (!roomId) return null
  const privateKey = new URLSearchParams(url.hash.slice(1)).get('key')
  let token = privateKey
  try { token ??= localStorage.getItem(storageKey(roomId)) } catch { /* Доступна также личная ссылка. */ }
  return token ? { type: 'resume', roomId, token } : { type: 'join', roomId }
}

export function useRoom() {
  const [entry, setEntry] = useState<Entry | null>(initialEntry)
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [state, setState] = useState<RoomState | null>(null)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'online' | 'offline'>('idle')
  const [error, setError] = useState('')
  const [errorVersion, setErrorVersion] = useState(0)
  const [connectionVersion, setConnectionVersion] = useState(0)
  const socket = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!entry) return
    let disposed = false
    let blocked = false
    let retry: ReturnType<typeof setTimeout> | undefined
    let credentials: Identity | null = null
    let current: WebSocket | null = null
    function connect() {
      if (disposed || blocked) return
      setStatus('connecting')
      const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${scheme}//${window.location.host}/ws`)
      current = ws
      socket.current = ws
      ws.onopen = () => {
        if (disposed) { ws.close(); return }
        ws.send(JSON.stringify(credentials ? { type: 'resume', roomId: credentials.roomId, token: credentials.token } : entry))
      }
      ws.onmessage = event => {
        if (disposed || blocked) return
        const message = JSON.parse(event.data as string) as ServerMessage
        if (message.type === 'joined') {
          credentials = { roomId: message.roomId, seat: message.seat, token: message.token }
          setIdentity(credentials)
          try { localStorage.setItem(storageKey(message.roomId), message.token) } catch { /* Личная ссылка остаётся доступна. */ }
          const url = new URL(window.location.href)
          url.searchParams.set('room', message.roomId)
          url.hash = ''
          window.history.replaceState(null, '', url)
          setStatus('online')
          setError('')
          setConnectionVersion(v => v + 1)
        } else if (message.type === 'state') {
          setState(message.state)
        } else {
          setError(message.message)
          setErrorVersion(v => v + 1)
          if (['NOT_FOUND', 'ROOM_FULL', 'UNAUTHORIZED', 'CAPACITY'].includes(message.code)) {
            blocked = true
            setStatus('offline')
            ws.close()
          }
        }
      }
      ws.onerror = () => { if (!disposed) setError('Не удалось связаться с сервером. Повторяем подключение…') }
      ws.onclose = event => {
        if (disposed) return
        setStatus('offline')
        if (event.code === 4001) {
          blocked = true
          setError('Ваше место открыто в другой вкладке или на другом устройстве.')
        }
        if (!blocked) retry = setTimeout(connect, 1000)
      }
    }
    connect()
    return () => {
      disposed = true
      clearTimeout(retry)
      if (socket.current === current) socket.current = null
      current?.close()
    }
  }, [entry])

  const send = useCallback((message: ClientMessage) => {
    if (socket.current?.readyState !== WebSocket.OPEN || status !== 'online') return false
    setError('')
    socket.current.send(JSON.stringify(message))
    return true
  }, [status])
  return { identity, state, status, error, errorVersion, connectionVersion, send,
    create: () => setEntry({ type: 'create' }),
    join: (roomId: string) => {
      let token: string | null = null
      try { token = localStorage.getItem(storageKey(roomId)) } catch { /* Возможен вход без хранилища. */ }
      setEntry(token ? { type: 'resume', roomId, token } : { type: 'join', roomId })
    },
  }
}

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'
import { Rooms } from './rooms'
import type { Peer } from './rooms'
import { HEARTBEAT_MS } from './config'

export function createGameServer(rooms = new Rooms()) {
  const root = resolve('dist')
  const server = createServer(async (req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return }
    try {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
      const file = resolve(root, '.' + (path === '/' ? '/index.html' : path))
      if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return }
      const data = await readFile(file)
      const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' })
      res.end(data)
    } catch { res.writeHead(404); res.end('Not found. Run npm run build first.') }
  })
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 })
  const alive = new WeakMap<WebSocket, boolean>()
  wss.on('connection', ws => {
    const peer: Peer = {
      send: message => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)) },
      close: () => ws.close(4001, 'Session resumed elsewhere'),
    }
    alive.set(ws, true)
    ws.on('pong', () => alive.set(ws, true))
    // Ограничение частоты сообщений не влияет на обычный выбор одного хода.
    let windowStart = Date.now()
    let messages = 0
    ws.on('message', (data, binary) => {
      if (Date.now() - windowStart >= 1000) { windowStart = Date.now(); messages = 0 }
      if (++messages > 30) { ws.close(1008, 'Too many messages'); return }
      if (binary) { peer.send({ type: 'error', code: 'INVALID_MESSAGE', message: 'Ожидается JSON.' }); return }
      try { rooms.receive(peer, JSON.parse(data.toString()) as unknown) }
      catch { peer.send({ type: 'error', code: 'INVALID_MESSAGE', message: 'Не удалось обработать сообщение.' }) }
    })
    ws.on('close', () => rooms.disconnect(peer))
    ws.on('error', () => { rooms.disconnect(peer); ws.terminate() })
  })
  const tick = setInterval(() => rooms.tick(), 100)
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) { ws.terminate(); continue }
      alive.set(ws, false)
      ws.ping()
    }
  }, HEARTBEAT_MS)
  return {
    server,
    async close() {
      clearInterval(tick)
      clearInterval(heartbeat)
      for (const ws of wss.clients) ws.terminate()
      await new Promise<void>(done => wss.close(() => done()))
      await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()))
    },
  }
}

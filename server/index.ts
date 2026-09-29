import { createGameServer } from './app'
const port = Number(process.env.PORT ?? 3001)
const app = createGameServer()
app.server.listen(port, '0.0.0.0', () => console.log(`Game server: http://localhost:${port}`))
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  await app.close()
}
process.on('SIGINT', () => { void stop() })
process.on('SIGTERM', () => { void stop() })

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { WebSocket } from 'ws'

test('real bridge protects HTTP and websocket handshakes while allowing authenticated local research transport', { timeout: 20000 }, async t => {
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening')
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve))
  const child = spawn(process.execPath, ['bridge/server.mjs'], { cwd: new URL('../', import.meta.url), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, JARVIS_BRAIN: 'ollama', JARVIS_BRIDGE_PORT: String(port), JARVIS_ALLOWED_ORIGINS: '', JARVIS_ALLOW_NO_ORIGIN: '0' } })
  t.after(async () => { const ended = once(child, 'exit'); child.kill(); await ended })
  let output = ''; child.stdout.on('data', data => { output += data }); child.stderr.on('data', () => {})
  const base = `http://127.0.0.1:${port}`
  for (let count = 0; count < 80; count++) {
    if (child.exitCode !== null) assert.fail('Bridge exited before startup')
    if (output.includes('bridge listening')) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  const origin = 'http://127.0.0.1:5173'
  assert.equal((await fetch(`${base}/live`)).status, 200)
  for (const path of ['/health', '/readiness', '/file?path=x', '/img?url=https://example.com', '/media?url=https://example.com', '/reports/a.docx']) assert.equal((await fetch(base + path)).status, 403)
  assert.equal((await fetch(base + '/tts', { method: 'POST', body: '{}' })).status, 403)
  assert.equal((await fetch(base + '/stt', { method: 'POST', body: 'audio' })).status, 403)
  assert.equal((await fetch(base + '/session', { method: 'POST', headers: { Origin: 'http://evil.test', 'x-jarvis-client': 'hud' } })).status, 403)
  const bootstrap = await fetch(base + '/session', { method: 'POST', headers: { Origin: origin, 'x-jarvis-client': 'hud' } })
  assert.equal(bootstrap.status, 204)
  const cookie = bootstrap.headers.get('set-cookie').split(';')[0]
  assert.match(bootstrap.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
  const health = await fetch(base + '/health', { headers: { Origin: origin, Cookie: cookie } })
  assert.equal(health.status, 200); assert.equal((await health.json()).alive, true)
  const forbidden = new WebSocket(`ws://127.0.0.1:${port}`, { origin })
  await new Promise(resolve => forbidden.once('error', error => { assert.match(error.message, /403/); resolve() }))
  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin, headers: { Cookie: cookie } })
  t.after(() => ws.terminate())
  const frames = []; ws.on('message', raw => frames.push(JSON.parse(raw)))
  await once(ws, 'open')
  ws.send(JSON.stringify({ type: 'ask', id: 'safe-time', text: 'Que horas são?' }))
  for (let count = 0; count < 40 && !frames.some(f => f.type === 'done' && f.ask === 'safe-time'); count++) await new Promise(resolve => setTimeout(resolve, 50))
  assert.ok(frames.some(f => f.type === 'done' && f.ask === 'safe-time'))
  ws.close()
})

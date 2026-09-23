import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const tick = () => new Promise((r) => setImmediate(r))
class Socket extends EventTarget {
  static OPEN = 1; static instances = []
  readyState = 0; sent = []
  constructor() { super(); Socket.instances.push(this) }
  send(raw) { this.sent.push(JSON.parse(raw)) }
  open() { this.readyState = 1; this.onopen?.() }
  frame(data) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })) }
  close() { this.readyState = 3; this.onclose?.(); this.dispatchEvent(new Event('close')) }
}

test('frontend isolates late frames, cancels while dialing and reconnects without stale ownership', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  t.mock.property(globalThis, 'WebSocket', Socket)
  globalThis.window = globalThis
  globalThis.location = { port: '5173' }
  t.after(() => { delete globalThis.window; delete globalThis.location })
  const source = readFileSync(new URL('../src/lib/bridge.ts', import.meta.url), 'utf8')
    .replace("import { BRIDGE_WS_URL } from '../config'", "const BRIDGE_WS_URL = 'ws://test.invalid'")
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText
  const bridge = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
  const handlers = { onText() {}, onTool() {} }, blades = []
  bridge.watchBlades((b) => blades.push(b))
  const abandoned = bridge.ask('old dialing', handlers)
  const current = bridge.ask('new dialing', handlers)
  const socket = Socket.instances.at(-1)
  socket.open(); socket.frame({ type: 'diagnostics', protocol: 2 })
  await tick()
  assert.deepEqual(await abandoned, { text: '', tools: [] })
  const id = socket.sent.find((m) => m.type === 'ask').id
  assert.equal(socket.sent.filter((m) => m.type === 'ask').length, 1)
  socket.frame({ type: 'blade', ask: 'old', blade: { id: 'wrong' } })
  socket.frame({ type: 'blade', blade: { id: 'untagged' } })
  socket.frame({ type: 'text', ask: 'old', delta: 'wrong' })
  socket.frame({ type: 'blade', ask: id, blade: { id: 'right' } })
  socket.frame({ type: 'done', ask: id, text: 'right' })
  assert.equal((await current).text, 'right'); assert.deepEqual(blades, [{ id: 'right' }])
  const cancelled = bridge.ask('cancel', handlers); await tick()
  const cancelledId = socket.sent.at(-1).id
  bridge.cancel(); await cancelled
  socket.frame({ type: 'blade', ask: cancelledId, blade: { id: 'late' } })
  assert.equal(blades.length, 1)
  const failing = bridge.ask('disconnect', handlers); await tick()
  const rejection = assert.rejects(failing, /disconnected/)
  socket.close(); await rejection
  t.mock.timers.tick(500)
  const reconnected = Socket.instances.at(-1)
  assert.notEqual(reconnected, socket)
  reconnected.open(); reconnected.frame({ type: 'diagnostics', protocol: 2 })
  const retry = bridge.ask('retry', handlers); await tick()
  const retryId = reconnected.sent.at(-1).id
  socket.frame({ type: 'blade', ask: retryId, blade: { id: 'old socket' } })
  reconnected.frame({ type: 'done', ask: retryId, text: 'recovered' })
  assert.equal((await retry).text, 'recovered')
  assert.equal(blades.length, 1)
})

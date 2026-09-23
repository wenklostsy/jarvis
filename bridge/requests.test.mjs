import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createRequests } from './requests.mjs'
import { ollamaConnection } from './ollama.mjs'
import { geminiConnection } from './gemini.mjs'
import { openaiConnection } from './openai.mjs'
import { attachDiagnostics } from './diagnostics.mjs'

const tick = () => new Promise((r) => setImmediate(r))
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r }); return { promise, resolve } }
class Socket extends EventEmitter {
  OPEN = 1; readyState = 1; frames = []
  send(raw) { this.frames.push(JSON.parse(raw)) }
  input(message) { this.emit('message', JSON.stringify(message)) }
  close() { this.readyState = 3; this.emit('close') }
}

test('serial execution, queued cancellation and duplicate IDs never execute twice', async () => {
  const frames = [], ran = [], hold = deferred()
  const q = createRequests((m) => frames.push(m))
  const first = q.enqueue('a', async () => { ran.push('a'); await hold.promise })
  const second = q.enqueue('b', () => ran.push('b'))
  const third = q.enqueue('c', () => ran.push('c'))
  await tick(); assert.deepEqual(ran, ['a'])
  q.cancel('b'); hold.resolve()
  await Promise.all([first, second, third, q.enqueue('c', () => ran.push('duplicate'))])
  assert.deepEqual(ran, ['a', 'c'])
  assert.equal(frames.filter((m) => m.ask === 'b' && m.state === 'cancelled').length, 1)
  q.close()
})

test('active cancellation signals operation, rejects late events and releases next request', async () => {
  const frames = [], hold = deferred(); let context
  const q = createRequests((m) => frames.push(m))
  const first = q.enqueue('old', async (c) => { context = c; await hold.promise; c.send({ type: 'blade' }) })
  await tick(); q.cancel('old')
  await q.enqueue('new', (c) => c.send({ type: 'done', text: 'new' }))
  assert.equal(context.signal.aborted, true)
  hold.resolve(); await first; await tick()
  assert.equal(frames.some((m) => m.type === 'blade'), false)
  assert.equal(frames.find((m) => m.type === 'done').ask, 'new')
  q.close()
})

test('disconnect invalidates pending commands and failure does not poison queue', async () => {
  const frames = [], q = createRequests((m) => frames.push(m)); let ran = false
  await q.enqueue('bad', () => { throw Error('sensitive internal detail') })
  await q.enqueue('good', () => { ran = true })
  assert.equal(ran, true)
  assert.equal(JSON.stringify(frames).includes('sensitive'), false)
  const hold = deferred()
  const a = q.enqueue('a', () => hold.promise)
  const b = q.enqueue('b', () => assert.fail('must not run'))
  await tick(); q.close(); hold.resolve(); await Promise.all([a, b])
})

test('SDK drain mode does not adopt a new ID before old result boundary', async () => {
  const q = createRequests(() => {}, { drainOnCancel: true }), hold = deferred(); let next = false
  const a = q.enqueue('a', () => hold.promise)
  await tick(); q.cancel('a')
  const b = q.enqueue('b', () => { next = true })
  await tick(); assert.equal(next, false)
  hold.resolve(); await Promise.all([a, b]); assert.equal(next, true); q.close()
})

test('timeout aborts a hung operation and allows following work', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  const q = createRequests(() => {}, { timeoutMs: 100 }); let signal, next = false
  const a = q.enqueue('a', (c) => { signal = c.signal; return new Promise(() => {}) })
  await tick(); t.mock.timers.tick(101); await a
  await q.enqueue('b', () => { next = true })
  assert.equal(signal.aborted, true); assert.equal(next, true); q.close()
})

for (const [name, connect] of [['ollama', ollamaConnection], ['gemini', geminiConnection], ['openai', openaiConnection]]) {
  test(`${name}: cancellation, late provider reply, sequential failure and close use same lifecycle`, async (t) => {
    const oldGemini = process.env.GEMINI_API_KEY, oldOpenai = process.env.OPENAI_API_KEY
    process.env.GEMINI_API_KEY = 'test'; process.env.OPENAI_API_KEY = 'test'
    t.after(() => {
      if (oldGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldGemini
      if (oldOpenai === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldOpenai
    })
    const hold = deferred(); let signal, count = 0
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      count++; signal = options.signal
      if (count === 1) return hold.promise
      throw Error('simulated provider failure')
    })
    const socket = new Socket(); connect(socket, 'test')
    socket.input({ type: 'ask', id: 'old', text: 'Converse comigo' }); await tick()
    socket.input({ type: 'ask', id: 'queued', text: 'Que horas são?' })
    socket.input({ type: 'interrupt' })
    assert.equal(signal.aborted, true)
    socket.input({ type: 'ask', id: 'new', text: 'Que horas são?' }); await tick()
    assert.match(socket.frames.find((m) => m.type === 'done' && m.ask === 'new').text, /São/)
    hold.resolve({ ok: true, json: async () => ({ message: { content: 'late' }, candidates: [{ content: { parts: [{ text: 'late' }] } }], output: [{ content: [{ type: 'output_text', text: 'late' }] }] }) })
    await tick()
    assert.equal(socket.frames.some((m) => m.type === 'done' && ['old', 'queued'].includes(m.ask)), false)
    socket.input({ type: 'ask', id: 'bad', text: 'Converse comigo' }); await tick()
    socket.input({ type: 'ask', id: 'good', text: 'Que horas são?' }); await tick()
    assert.ok(socket.frames.some((m) => m.type === 'done' && m.ask === 'good'))
    socket.input({ type: 'ask', id: 'closed', text: 'Que horas são?' }); socket.close(); await tick()
    assert.equal(socket.frames.some((m) => m.type === 'done' && m.ask === 'closed'), false)
  })
}

test('diagnostic allowlist reports identity and reachability without credentials', async () => {
  const socket = new Socket()
  attachDiagnostics(socket, { request: async () => ({ ok: true }) })
  await tick()
  const last = socket.frames.at(-1)
  assert.equal(last.ollama, 'disponível')
  assert.match(last.revision, /^[a-f0-9]{12}$/)
  assert.deepEqual(Object.keys(last).sort(), ['backend', 'instance', 'model', 'ollama', 'protocol', 'revision', 'sourceStatus', 'startedAt', 'type'])
  socket.close()
})

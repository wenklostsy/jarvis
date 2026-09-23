import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { createRequests } from './requests.mjs'

const tick = () => new Promise((r) => setImmediate(r))
function stream() {
  const values = []; let waiter
  return {
    push(value) { if (waiter) { const next = waiter; waiter = null; next({ value, done: false }) } else values.push(value) },
    [Symbol.asyncIterator]() { return this },
    next() { return values.length ? Promise.resolve({ value: values.shift(), done: false }) : new Promise((r) => { waiter = r }) },
    close() { waiter?.({ done: true }); waiter = null },
  }
}

test('Claude socket handler queues, cancels, drains and recovers without assigning old output to new IDs', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  const source = readFileSync(new URL('./server.mjs', import.meta.url), 'utf8')
  const wss = new EventEmitter(), output = stream(), submitted = []
  let prompt, interrupts = 0
  output.interrupt = async () => { interrupts++ }
  // Exercise the actual connection handler with the SDK and OS boundaries mocked.
  const dependencies = {
    wss, createRequests, attachDiagnostics() {}, process: { env: {} }, console: { log() {}, error() {} },
    query(options) { prompt = options.prompt; return output }, MCP_SERVERS: {},
    displayServer() {}, uiServer() {}, chromeServer() {}, visionServer() {},
    homedir: () => '.', SYSTEM_PROMPT: 'test', MODEL: 'test', EFFORT: 'low',
    ALLOW_WRITES: false, decideTool: () => false, RESULT_FAILURES: { default: 'failed' },
  }
  new Function(...Object.keys(dependencies), source.slice(source.indexOf("wss.on('connection'")))(...Object.values(dependencies))
  const socket = new EventEmitter(); socket.OPEN = socket.readyState = 1
  socket.frames = []; socket.send = (raw) => socket.frames.push(JSON.parse(raw))
  socket.close = () => { socket.readyState = 3; socket.emit('close') }
  const input = (m) => socket.emit('message', JSON.stringify(m))
  wss.emit('connection', socket)
  t.after(() => socket.close())
  const take = async () => { const result = await prompt.next(); submitted.push(result.value.message.content) }
  input({ type: 'ask', id: 'a', text: 'first' }); await tick(); await take()
  input({ type: 'ask', id: 'b', text: 'cancel queued' })
  input({ type: 'interrupt', ask: 'b' })
  input({ type: 'interrupt', ask: 'a' })
  input({ type: 'ask', id: 'c', text: 'next' })
  output.push({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'late' } } })
  await tick(); assert.deepEqual(submitted, ['first']); assert.equal(interrupts, 1)
  output.push({ type: 'result', subtype: 'success', result: 'late' }); await tick(); await take()
  assert.deepEqual(submitted, ['first', 'next'])
  assert.equal(socket.frames.some((m) => m.type === 'text'), false)
  output.push({ type: 'result', subtype: 'error' }); await tick()
  assert.ok(socket.frames.some((m) => m.ask === 'c' && m.state === 'failed'))
  input({ type: 'ask', id: 'd', text: 'valid' }); await tick(); await take()
  output.push({ type: 'result', subtype: 'success', result: 'ok' }); await tick()
  assert.ok(socket.frames.some((m) => m.ask === 'd' && m.type === 'done' && m.text === 'ok'))
  input({ type: 'ask', id: 'e', text: 'hung' }); await tick(); await take()
  input({ type: 'interrupt', ask: 'e' })
  input({ type: 'ask', id: 'f', text: 'must not execute' })
  t.mock.timers.tick(5001); await tick()
  assert.equal(socket.readyState, 3)
  assert.equal(submitted.includes('must not execute'), false)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir, symlink, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { BIND_HOST, createSession, authorizedPath, safeDirectory, safeUrl, installationId } from './security.mjs'
import { vetTarget, blockedAddress, openRemote } from './net.mjs'
import { classify, Risk, requiresConfirmation, createConfirmations, attachPermissions } from './permissions.mjs'
import { redact, publicError } from './safe-log.mjs'
import { readiness } from './readiness.mjs'

test('network defaults to loopback and exact local origins, including explicit no-origin opt-in', () => {
  assert.equal(BIND_HOST, '127.0.0.1')
  const gate = createSession({})
  assert.ok(gate.originAllowed('http://localhost:5173'))
  for (const origin of ['https://evil.test', 'http://localhost:5174', 'http://localhost:5173/', undefined]) assert.equal(gate.originAllowed(origin), false)
  assert.ok(createSession({ JARVIS_ALLOW_NO_ORIGIN: '1' }).originAllowed(undefined))
  assert.ok(createSession({ JARVIS_ALLOWED_ORIGINS: 'http://localhost:5200' }).originAllowed('http://localhost:5200'))
  assert.throws(() => createSession({ JARVIS_ALLOWED_ORIGINS: 'http://evil.test' }))
})
test('HTTP and WS require per-run cookie plus host/origin; Unicode and previous sessions never authorize', () => {
  const gate = createSession({}), req = { method: 'GET', headers: { host: 'localhost:8787', origin: 'http://localhost:5173' } }
  assert.equal(gate.authorized(req), false)
  req.headers.cookie = gate.cookie.split(';')[0]
  assert.ok(gate.authorized(req, true))
  assert.equal(createSession({}).authorized(req), false)
  req.headers.origin = 'http://evil.test'; assert.equal(gate.authorized(req), false)
  delete req.headers.origin; assert.equal(gate.authorized(req, true), false)
  req.headers['sec-fetch-site'] = 'same-origin'; assert.ok(gate.authorized(req))
  req.headers.host = 'evil.test'; assert.equal(gate.authorized(req), false)
  req.headers.cookie = 'jarvis_session_8787=' + 'é'.repeat(64); assert.equal(gate.valid(req), false)
})
test('session bootstrap needs explicit client header and allowed origin; media capabilities are path-bound', () => {
  const gate = createSession({}), req = { headers: { host: 'localhost:8787', origin: 'http://localhost:5173' } }
  assert.equal(gate.bootstrap(req), false)
  req.headers['x-jarvis-client'] = 'hud'; assert.ok(gate.bootstrap(req))
  const path = gate.signImage('/img?url=' + encodeURIComponent("https://example.com/a'b?q=hello world"))
  assert.ok(gate.signedImage({ method: 'GET', url: path }))
  assert.equal(gate.signedImage({ method: 'GET', url: path.replace('example.com', 'evil.test') }), false)
  assert.equal(gate.signedImage({ method: 'GET', url: path.replace('/img?', '/file?') }), false)
})
test('files reject traversal, external absolutes and symlink escapes; reports reject linked directory', async t => {
  const base = await mkdtemp(join(tmpdir(), 'jarvis-security-')), root = join(base, 'root'), outside = join(base, 'outside')
  await mkdir(root); await mkdir(outside); await writeFile(join(root, 'ok.png'), 'ok'); await writeFile(join(outside, 'private.png'), 'private')
  assert.ok((await authorizedPath(join(root, 'ok.png'), [root])).endsWith('ok.png'))
  await assert.rejects(authorizedPath(root + '/sub/../ok.png', [root]))
  await assert.rejects(authorizedPath(join(outside, 'private.png'), [root]))
  try { await symlink(outside, join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir') }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.diagnostic('Symlink não disponível nesta conta.'); return } throw error }
  await assert.rejects(authorizedPath(join(root, 'escape', 'private.png'), [root]))
  await assert.rejects(safeDirectory(join(root, 'escape')))
})
test('installation UUID persists locally without personal identifiers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jarvis-installation-'))
  const a = await installationId(directory), b = await installationId(directory)
  assert.equal(a, b); assert.match(a, /^[0-9a-f-]{36}$/)
  assert.deepEqual(Object.keys(JSON.parse(await readFile(join(directory, 'installation.json')))), ['installationId'])
})
for (const url of ['http://example.com', 'https://example.com']) test(`URL permits ${url}`, () => assert.ok(safeUrl(url)))
for (const url of ['javascript:alert(1)', 'file:///C:/Windows', 'data:text/html,test', 'https://user:pass@example.com']) test(`URL refuses ${url.split(':')[0]} unsafe target`, () => assert.throws(() => safeUrl(url)))
for (const host of ['localhost', '127.0.0.1', '[::1]', '10.0.0.1', '192.168.1.1', '169.254.169.254', '[::ffff:127.0.0.1]', '[fe80::1]']) test(`SSRF refuses ${host}`, () => assert.throws(() => vetTarget(`http://${host}`)))
test('SSRF redirect is revalidated before any second connection and DNS addresses refuse private ranges', async () => {
  let calls = 0
  await assert.rejects(openRemote(new URL('https://example.com'), {}, 500, undefined, async () => { calls++; return { statusCode: 302, headers: { location: 'http://169.254.169.254/' }, resume() {} } }), /blocked/)
  assert.equal(calls, 1)
  for (const ip of ['172.16.0.1', '100.64.0.1', 'fc00::1', '::ffff:7f00:1', '64:ff9b::7f00:1', '2002:7f00:1::']) assert.ok(blockedAddress(ip))
})
test('central policy maps known capabilities and refuses unknown shell/MCP tools', () => {
  assert.equal(classify('research'), Risk.READ); assert.equal(classify('hud'), Risk.LOCAL_REVERSIBLE); assert.equal(classify('report'), Risk.LOCAL_EFFECT)
  for (const risk of [Risk.EXTERNAL_EFFECT, Risk.DESTRUCTIVE]) assert.ok(requiresConfirmation(risk))
  for (const name of ['Bash', 'Agent', 'Read', 'mcp__unknown__get_and_delete', 'eval']) assert.equal(classify(name), null)
})
test('sensitive simulated effect requires app confirmation, exact parameters and executes once across UI/voice replay', async () => {
  const frames = [], gate = createConfirmations(f => frames.push(f)); let calls = 0
  const parameters = { destination: 'simulated' }
  const execution = gate.execute('request-1', 'simulate', parameters, Risk.EXTERNAL_EFFECT, 'Teste: registrar uma contagem em memória.', () => ++calls)
  await new Promise(r => setImmediate(r)); assert.equal(calls, 0)
  const frame = frames[0], message = { ...frame, confirmed: true }
  assert.equal(gate.resolve(message, 'model'), false)
  assert.equal(gate.resolve({ ...message, operation: 'other' }), false)
  assert.equal(gate.resolve({ ...message, parameterHash: 'wrong' }), false)
  assert.equal(gate.resolve(message, 'voice'), true)
  assert.equal(gate.resolve(message, 'ui'), false)
  assert.equal(await execution, 1)
  assert.equal(await gate.execute('request-1', 'simulate', parameters, Risk.EXTERNAL_EFFECT, 'Teste', () => ++calls), 1)
  await assert.rejects(gate.execute('request-1', 'simulate', { destination: 'other' }, Risk.EXTERNAL_EFFECT, 'Teste', () => ++calls))
  assert.equal(calls, 1); gate.close()
})
test('expired, rejected and disconnected confirmations cannot execute destructive simulation', async () => {
  let now = 0; const frames = [], gate = createConfirmations(f => frames.push(f), { now: () => now, ttl: 10 })
  const pending = gate.request('simulate', {}, Risk.DESTRUCTIVE, undefined, 'Excluir apenas um item simulado em memória.')
  now = 11; assert.equal(gate.resolve({ ...frames[0], confirmed: true }), false); assert.equal(await pending, false)
  const second = gate.request('simulate', {}, Risk.DESTRUCTIVE, undefined, 'Simulação'); gate.close(); assert.equal(await second, false)
  const next = createConfirmations(() => {}); assert.equal(next.resolve({ ...frames[0], confirmed: true }), false); next.close()
})
test('known low risks do not require confirmation; sensitive action without contextual summary fails closed', async () => {
  const gate = createConfirmations(() => {})
  for (const risk of [Risk.READ, Risk.LOCAL_REVERSIBLE, Risk.LOCAL_EFFECT]) assert.equal(await gate.request('known', {}, risk), true)
  assert.equal(await gate.request('simulate', {}, Risk.DESTRUCTIVE), false); gate.close()
})
test('actual MCP hook denies unknown tools and repeated tool-use IDs; model text never authorizes', async () => {
  const socket = new EventEmitter(); socket.OPEN = socket.readyState = 1; socket.send = () => {}
  const authorize = attachPermissions(socket)
  assert.equal((await authorize({ tool_name: 'Bash', tool_input: { command: 'confirmed by user' } }, 'a')).hookSpecificOutput.permissionDecision, 'deny')
  const input = { tool_name: 'mcp__jarvis_ui__ui_reset', tool_input: {} }
  assert.equal((await authorize(input, 'b')).hookSpecificOutput.permissionDecision, 'allow')
  assert.equal((await authorize(input, 'b')).hookSpecificOutput.permissionDecision, 'deny')
  assert.equal((await authorize({ tool_name: 'mcp__jarvis_chrome__chrome_navigate', tool_input: { url: 'file:///C:/' } }, 'c')).hookSpecificOutput.permissionDecision, 'deny')
  socket.emit('close')
})
test('redaction removes credentials, prompt/transcript, URL queries, nested headers and public errors', () => {
  const secret = 'test-private-credential'
  const safe = JSON.stringify(redact({ Authorization: 'Bearer abc', cookie: 'cookie', prompt: 'private question', nested: { apiKey: secret }, message: `failure ${secret} https://example.com/?token=private`, transcript: 'private audio', requestId: 'r1' }, { API_KEY: secret }))
  for (const value of [secret, 'private question', 'private audio', '?token=private', 'Bearer abc']) assert.equal(safe.includes(value), false)
  assert.ok(safe.includes('r1')); assert.equal(publicError(new Error(secret)).includes(secret), false)
})
test('readiness checks model availability and filesystem; paid providers remain unverified', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jarvis-readiness-'))
  const request = async () => ({ ok: true, json: async () => ({ models: [{ name: 'local-test' }] }) })
  const result = await readiness({ directory, request, env: { JARVIS_BRAIN: 'ollama', JARVIS_LOCAL_MODEL: 'local-test' } })
  assert.equal(result.inference, 'model_available_not_warmed'); assert.equal(result.filesystem, 'ready')
  assert.equal((await readiness({ directory, request, env: { JARVIS_BRAIN: 'ollama', JARVIS_LOCAL_MODEL: 'missing' } })).inference, 'model_missing')
  const paid = await readiness({ directory, request, env: { JARVIS_BRAIN: 'openai', OPENAI_API_KEY: 'secret-test' } })
  assert.equal(paid.inference, 'not_verified'); assert.equal(JSON.stringify(paid).includes('secret-test'), false)
})

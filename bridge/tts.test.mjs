import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

let seq = 0
const tick = () => new Promise((r) => setImmediate(r))
async function setup(t, mode = 'normal') {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000 })
  const utterances = [], audio = [], signals = [], revoked = []
  globalThis.window = globalThis
  globalThis.localStorage = { getItem: () => null }
  globalThis.requestAnimationFrame = () => 1
  globalThis.cancelAnimationFrame = () => {}
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
  t.mock.method(URL, 'revokeObjectURL', (url) => revoked.push(url))
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    signals.push(options.signal)
    if (mode === 'cloud-stalled') return new Promise(() => {})
    if (mode === 'audio-stalled') return { ok: true, blob: async () => new Blob(['audio']) }
    return { ok: false }
  })
  globalThis.Audio = class {
    constructor() { audio.push(this) }
    play() { queueMicrotask(() => this.onplaying?.()); return Promise.resolve() }
    pause() { this.paused = true; this.onpause?.() }
  }
  globalThis.speechSynthesis = { getVoices: () => [], addEventListener() {}, resume() {}, pause() {}, cancel() {},
    speak(u) { utterances.push(u); queueMicrotask(() => { u.onstart?.(); if (mode === 'normal') u.onend?.(); if (mode === 'error') u.onerror?.({ error: 'synthesis-failed' }) }) },
  }
  t.after(() => { for (const key of ['window', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame', 'SpeechSynthesisUtterance', 'speechSynthesis', 'Audio']) delete globalThis[key] })
  let source = readFileSync(new URL('../src/lib/tts.ts', import.meta.url), 'utf8')
  source = source.replace(/import \{[\s\S]*?\} from '..\/config'/, "const env = {}; const USE_ELEVENLABS = false, BACKEND = 'bridge', TTS_ENGINE = 'system', KOKORO_VOICE = '', BRIDGE_HTTP_URL = ''; ")
    .replace("import * as kokoro from './kokoro'", 'const kokoro = { isUnavailable: () => true };')
    .replace("import { caps } from './capabilities'", `const caps = () => ({ tts: ${mode.includes('stalled') && mode !== 'stalled'} });`)
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText
  return { ...await import('data:text/javascript;base64,' + Buffer.from(js + '\n//# sourceURL=jarvis-tts-test-' + seq++ + '.mjs').toString('base64')), utterances, audio, signals, revoked }
}

for (const mode of ['cloud-stalled', 'audio-stalled']) {
  test(`${mode}: cancellation settles end without network/media terminal events`, async (t) => {
    const { createSpeaker, diag, signals, audio, revoked } = await setup(t, mode)
    const speaker = createSpeaker(mode)
    speaker.push('Resumo curto. ')
    const pending = speaker.end()
    await tick()
    speaker.cancel('user-stop'); await pending
    assert.equal(diag.controllerActive, false)
    assert.equal(signals[0].aborted, true)
    if (mode === 'audio-stalled') {
      assert.equal(audio[0].paused, true)
      assert.ok(revoked.length > 0)
    }
  })
}

test('speech that starts but never emits end/error must release end() and permit the next command', async (t) => {
  const { createSpeaker, diag } = await setup(t, 'stalled')
  const speaker = createSpeaker('research-1')
  try {
    speaker.push('Resumo da pesquisa. ')
    let ended = false
    const pending = speaker.end().then(() => { ended = true })
    await tick()
    assert.equal(diag.state, 'speaking')
    t.mock.timers.tick(120000); await tick()
    assert.equal(ended, true, 'onstart without onend leaves the TTS drain promise pending')
    await pending
    assert.equal(diag.controllerActive, false)
  } finally { speaker.cancel() }
})

for (const mode of ['normal', 'error', 'stalled']) {
  test(`research → ${mode} speech → new command: actual App respond releases execution before presentation`, async (t) => {
    const tts = await setup(t, mode)
    let phase = 'listening', calls = 0
    const state = new Proxy({ phase, blades: [], setPhase(value) { phase = value; this.phase = value } }, { get: (obj, key) => obj[key] ?? (() => {}) })
    const useStore = (select) => select(state); useStore.getState = () => state
    const noop = new Proxy({}, { get: () => () => {} })
    globalThis.__appTest = { useRef: (value) => ({ current: value }), useStore,
      parseResultVoiceCommand: () => null, runResultAction: async () => {}, createSpeaker: tts.createSpeaker, ttsDiag: tts.diag, sfx: noop, music: noop,
      usingBridge: true, forTool: () => '', bridgeDiagnostics: { request: 'r1' },
      ask: async (_said, _history, handlers) => { calls++; handlers.onText('Síntese da pesquisa. '); return { text: 'Síntese da pesquisa.' } },
    }
    t.after(() => { delete globalThis.__appTest })
    let source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
    source = source.slice(0, source.indexOf('  useEffect(() => watchResultActions')) + '  return { respond, silence, speaker }\n}'
    source = source.replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm, '')
    source = 'const { ' + Object.keys(globalThis.__appTest).join(',') + ' } = globalThis.__appTest;\n' + source
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText
    const { default: App } = await import('data:text/javascript;base64,' + Buffer.from(js + '\n//# sourceURL=jarvis-app-test-' + seq++ + '.mjs').toString('base64'))
    const app = App()
    await app.respond('Pesquise sobre energia solar')
    assert.equal(calls, 1)
    await tick()
    if (mode === 'stalled') {
      assert.equal(tts.diag.state, 'speaking')
      await app.respond('Que horas são?') // No onSpeechStart prerequisite.
      assert.equal(calls, 2)
      app.silence()
    } else {
      await app.respond('Que horas são?')
      assert.equal(calls, 2)
    }
    await tick(); app.silence()
  })
}

test('long output is segmented once, ends normally, and repeated end does not read twice', async (t) => {
  const { createSpeaker, utterances, diag } = await setup(t)
  const speaker = createSpeaker('long')
  speaker.push('Palavra longa sem pontuação '.repeat(80))
  await speaker.end(); await speaker.end()
  assert.ok(utterances.length > 1)
  assert.ok(utterances.every((u) => u.text.length <= 240))
  assert.equal(diag.currentSegment, utterances.length)
  assert.equal(diag.state, 'ended')
  assert.equal(diag.controllerActive, false)
})

test('cancel releases native resources even if cancel produces no browser event; late events do not resume', async (t) => {
  const { createSpeaker, utterances, diag } = await setup(t, 'stalled')
  const speaker = createSpeaker('cancel')
  speaker.push('Uma frase. Outra frase. ')
  const ending = speaker.end(); await tick()
  speaker.cancel('user-stop'); await ending
  utterances[0].onstart?.(); utterances[0].onend?.(); await tick()
  assert.equal(utterances.length, 1)
  assert.equal(diag.controllerActive, false)
  assert.equal(diag.reason, 'user-stop')
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { createResearch } from './research.mjs'
import { writeReport } from './reports.mjs'
import { createConversation } from './conversation-context.mjs'
import { createLocalCommands } from './local-commands.mjs'
import { EventEmitter } from 'node:events'
import { ollamaConnection } from './ollama.mjs'

function fixture(saveReport) {
  const events = []
  let query = ''
  const research = createResearch({ saveReport, send: m => events.push(m),
    request: async url => {
      if (url.includes('/search?')) {
        query = new URL(url).searchParams.get('q')
        return { type: 'text/html', text: `<a href="https://fonte.org/artigo"><h3>${query}</h3></a>` }
      }
      return { type: 'text/html', text: `<article>${(query + ' evidências públicas para revisão. ').repeat(20)}</article>` }
    },
    generate: async (_system, data) => `Informações sobre ${JSON.parse(data).assunto} [1].`,
  })
  return { research, events, latest: () => events.filter(m => m.type === 'blade').at(-1)?.blade.research }
}

test('sports Word uses only research B, with a real file and traceable artifact; replay writes once', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jarvis-hotfix-'))
  const paths = []
  try {
    const f = fixture(async data => { const report = await writeReport(data, directory); paths.push(report.path); return report })
    await f.research.run({ query: 'energia solar' }, { id: 'energy-request' })
    await f.research.run({ query: 'eventos de esporte recentes' }, { id: 'sports-request' })
    const sports = f.latest()
    assert.doesNotMatch(sports.content + sports.spokenSummary, /energia solar|aulas de violão|example\.com/)
    const action = { operation: 'report', researchId: sports.id, origin: 'voice' }
    const context = { id: 'export-sports', action }
    const responses = await Promise.all([f.research.action(action, context), f.research.action(action, context)])
    assert.ok(responses.every(r => /Word está pronto/.test(r)))
    await f.research.action(action, context)
    assert.equal(paths.length, 1)
    const artifact = f.latest().artifacts[0]
    assert.equal(artifact.researchId, sports.id)
    assert.equal(artifact.actionRequestId, 'export-sports')
    assert.equal(f.latest().requestId, 'sports-request')
    assert.ok(artifact.artifactId && artifact.createdAt)
    const zip = await JSZip.loadAsync(await readFile(paths[0]))
    const xml = await zip.file('word/document.xml').async('string')
    assert.match(xml, /eventos de esporte recentes/)
    assert.doesNotMatch(xml, /energia solar|aulas de violão|example\.com|gere um relatório dessa pesquisa/)
    assert.ok(f.events.some(m => m.reportState === 'available' && m.artifactId === artifact.artifactId))
    f.research.close()
    assert.match(await f.research.action(action, context), /não está mais disponível/)
    assert.equal(paths.length, 1)
  } finally { for (const path of paths) await unlink(path); await rmdir(directory) }
})

test('selected older Rick research survives newer energy research; distinct intentional exports remain distinct', async () => {
  const saved = []
  const paths = []
  const directory = await mkdtemp(join(tmpdir(), 'jarvis-selected-'))
  try {
  const f = fixture(async data => { saved.push(data); const report = await writeReport(data, directory); paths.push(report.path); return report })
  await f.research.run({ query: 'Rick e Renner' })
  const rick = f.latest()
  await f.research.run({ query: 'energia solar' })
  assert.match(await f.research.run({ reuse: true, report: true }), /Selecione/)
  assert.equal(saved.length, 0)
  for (const id of ['click-1', 'click-2']) await f.research.action({ operation: 'report', researchId: rick.id }, { id })
  assert.ok(saved.every(data => data.query === 'Rick e Renner' && data.summary === rick.content))
  assert.equal(f.latest().artifacts.length, 2)
  assert.notEqual(f.latest().artifacts[0].artifactId, f.latest().artifacts[1].artifactId)
  for (const path of paths) {
    const zip = await JSZip.loadAsync(await readFile(path))
    const xml = await zip.file('word/document.xml').async('string')
    assert.match(xml, /Rick e Renner/)
    assert.doesNotMatch(xml, /energia solar/)
  }
  f.research.close()
  } finally { for (const path of paths) await unlink(path); await rmdir(directory) }
})

test('write failure and missing receipt never publish an artifact or claim completion', async () => {
  for (const save of [async () => { throw new Error('disk full') }, async () => null]) {
    const f = fixture(save)
    const answer = await f.research.run({ query: 'esportes', report: true }, { id: 'failed-file' })
    assert.match(answer, /Não consegui/)
    assert.doesNotMatch(answer, /pronto/)
    assert.equal(f.latest(), undefined)
    assert.ok(f.events.some(m => m.reportState === 'failed'))
    f.research.close()
  }
  await assert.rejects(writeReport({ summary: 'texto de conversa' }), /pesquisa estruturada/)
})

test('conversation keeps real follow-ups but never promotes local help or report speech to assistant history', async () => {
  const conversation = createConversation()
  const f = fixture()
  const context = { id: 'rick' }
  await f.research.run({ query: 'Rick e Renner' }, context)
  conversation.local('Pesquise sobre Rick e Renner', context)
  conversation.local('Ajuda', { localResult: 'pesquise sobre energia solar; aulas de violão; https://example.com' })
  let messages = conversation.messages('Quando a dupla foi formada?')
  assert.match(JSON.stringify(messages), /Rick e Renner/)
  assert.doesNotMatch(JSON.stringify(messages), /energia solar|violão|example\.com/)
  assert.equal(messages.filter(m => m.role === 'assistant').length, 0)
  conversation.chat('Quando a dupla foi formada?', 'Precisamos consultar uma fonte sobre a formação.')
  messages = conversation.messages('E o primeiro disco?')
  assert.ok(messages.some(m => m.role === 'assistant' && /formação/.test(m.content)))
  assert.ok(messages.some(m => m.role === 'user' && /Quando/.test(m.content)))
  f.research.close()
})

test('unsupported report request asks for clarification instead of reaching free chat', async () => {
  let calls = 0
  const local = createLocalCommands(() => {}, { research: async () => { calls++; return 'executado' } })
  assert.match(await local.tryHandle('Me faça um relatório com os principais eventos de esporte recentes'), /Qual é o assunto/)
  assert.equal(calls, 0)
  assert.equal(await local.tryHandle('Crie um relatório sobre esportes'), 'executado')
  local.close()
})

test('research A → B → common command → C replaces tool context, retaining genuine conversation', async () => {
  const conversation = createConversation()
  const f = fixture()
  for (const [id, query] of [['a', 'Rick e Renner'], ['b', 'esportes'], ['c', 'astronomia']]) {
    const context = { id }
    await f.research.run({ query }, context)
    conversation.local(`Pesquise ${query}`, context)
    if (id === 'b') conversation.local('Que horas são?', {})
    const messages = conversation.messages('Conte mais')
    const tool = JSON.parse(messages[1].content.split(': ').slice(1).join(': '))
    assert.equal(tool.query, query)
    assert.equal(tool.researchId, f.latest().id)
    assert.doesNotMatch(JSON.stringify(messages), /energia solar|aulas de violão|example\.com/)
  }
  assert.ok(conversation.messages('E depois?').some(m => m.role === 'user' && m.content === 'Que horas são?'))
  f.research.close()
})

test('actual Ollama request excludes help examples and report clarification never calls the model', { timeout: 3000 }, async t => {
  class Socket extends EventEmitter {
    OPEN = 1; readyState = 1
    send(raw) { this.emit('frame', JSON.parse(raw)) }
  }
  const socket = new Socket(), bodies = []
  const original = globalThis.fetch
  globalThis.fetch = async (_url, options) => { bodies.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ message: { content: 'Conversa legítima.' } }) } }
  t.after(() => { globalThis.fetch = original; socket.emit('close') })
  ollamaConnection(socket)
  const ask = (id, text) => new Promise(resolve => {
    const receive = frame => { if (frame.ask === id && frame.type === 'done') { socket.off('frame', receive); resolve(frame.text) } }
    socket.on('frame', receive)
    socket.emit('message', JSON.stringify({ type: 'ask', id, text }))
  })
  await ask('help', 'Ajuda')
  await ask('chat', 'Olá, vamos conversar?')
  assert.equal(bodies.length, 1)
  assert.doesNotMatch(JSON.stringify(bodies[0].messages), /energia solar|aulas de violão|example\.com/)
  await ask('report', 'Me faça um relatório com os eventos de esporte recentes')
  assert.equal(bodies.length, 1)
  await ask('followup', 'Continue nossa conversa')
  assert.ok(bodies[1].messages.some(m => m.role === 'assistant' && m.content === 'Conversa legítima.'))
})

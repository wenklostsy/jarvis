import { test } from 'node:test'
import assert from 'node:assert/strict'
import { relevantSources, validateSynthesis } from './research-quality.mjs'
import { createResearch, readSource } from './research.mjs'

const page = (text) => ({ text: `<html><head><meta property="article:published_time" content="2026-09-20"></head><body><article>${text.repeat(15)}</article></body></html>`, type: 'text/html' })
const results = (title, url = 'https://example.com/article') => ({ text: `<html><body><div><a href="${url}"><h3>${title}</h3></a><p>${title} — trecho do buscador.</p></div></body></html>`, type: 'text/html' })
const fixture = (title) => async (url) => url.includes('/search?') ? results(title) : page(title + ' evidência pública. ')

test('Portuguese YouTube relevance excludes unrelated sports, channels and promotional links', () => {
  const sources = [
    { title: 'Aulas de violão para iniciantes', url: 'https://www.youtube.com/watch?v=abc12345' },
    { title: 'Resultado do jogo de futebol', url: 'https://www.youtube.com/watch?v=fut12345' },
    { title: 'Aulas de violão', url: 'https://www.youtube.com/@channel' },
    { title: 'Receitas de bolo de cenoura', url: 'https://youtu.be/bolo1234' },
  ]
  assert.equal(relevantSources(sources, 'aulas de violão para iniciantes', { engine: 'youtube' }).length, 1)
  assert.equal(relevantSources(sources, 'receitas de bolo de cenoura', { engine: 'youtube' })[0].url, 'https://youtu.be/bolo1234')
  assert.equal(validateSynthesis('Assisti ao vídeo [1].', 1, 'youtube'), false)
  assert.equal(validateSynthesis('Há aulas no título [2].', 1, 'youtube'), false)
  assert.equal(validateSynthesis('Sem fonte.', 1), false)
})

test('YouTube research sends metadata, never page recommendations or an invented transcript, to the model', async () => {
  const frames = []
  const research = createResearch({ request: async (url) => url.includes('/search?')
    ? results('Aulas de violão para iniciantes', 'https://www.youtube.com/watch?v=abc12345')
    : { text: '<html><head><meta name="description" content="Aula introdutória de violão"></head><body>Futebol recomendado e anúncios</body></html>', type: 'text/html' },
    generate: async (_system, data) => {
      assert.match(data, /Aula introdutória/)
      assert.doesNotMatch(data, /Futebol/)
      return 'Encontrei uma aula introdutória de violão nos metadados [1].'
    }, send: (m) => frames.push(m),
  })
  await research.run({ query: 'aulas de violão para iniciantes', engine: 'youtube' })
  const result = frames.find((m) => m.type === 'blade').blade.research
  assert.equal(result.sources[0].transcriptAvailable, false)
  assert.equal(result.sources[0].videoAnalyzed, false)
  assert.match(result.limitations.join(' '), /sem análise do vídeo/)
})

test('long and short research preserve full result independently from spoken summary and real progress', async () => {
  for (const summary of ['Energia solar [1].', 'Energia solar e evidências [1]. '.repeat(900)]) {
    const frames = []
    const research = createResearch({ request: fixture('Energia solar'), generate: async () => summary, send: (m) => frames.push(m) })
    const speech = await research.run({ query: 'energia solar' })
    const result = frames.find((m) => m.type === 'blade').blade.research
    assert.equal(result.content, summary)
    assert.ok(speech.length < 1000)
    assert.ok(result.sources[0].publishedAt)
    assert.deepEqual(frames.filter((m) => m.type === 'progress').map((m) => m.stage), ['searching', 'found', 'reading', 'synthesizing', 'completed'])
    research.close()
  }
})

test('irrelevant results never invoke model; inaccessible evidence and invalid citations are disclosed', async () => {
  let generations = 0
  const unrelated = createResearch({ request: fixture('Resultado do futebol'), generate: async () => { generations++; return 'Inventado [1]' } })
  assert.match(await unrelated.run({ query: 'energia solar' }), /Não consegui concluir/)
  assert.equal(generations, 0)
  const frames = []
  const blocked = createResearch({ request: async (url) => url.includes('/search?') ? results('Energia solar') : { text: '<html><title>CAPTCHA</title></html>', type: 'text/html' }, generate: async () => { generations++; return 'Inventado [1]' }, send: (m) => frames.push(m) })
  await blocked.run({ query: 'energia solar' })
  assert.equal(generations, 0)
  assert.match(frames.find((m) => m.type === 'blade').blade.research.content, /não uma conclusão verificada/)
  const source = await readSource({ url: 'https://example.com', snippet: 'Trecho' }, async () => { throw Error('blocked') })
  assert.equal(source.text, '')
  const invalid = createResearch({ request: fixture('Energia solar'), generate: async () => 'Afirmação [99].', send: (m) => frames.push(m) })
  await invalid.run({ query: 'energia solar' })
  assert.match(frames.filter((m) => m.type === 'blade').at(-1).blade.research.content, /não uma conclusão verificada/)
})

test('Word button targets selected research; voice uses explicit selection; export neither searches nor synthesizes again', async () => {
  const frames = [], saved = []; let fetches = 0, generations = 0
  const research = createResearch({ request: async (url) => { fetches++; return url.includes('/search?') ? results('Energia solar e energia eólica') : page('Energia solar e energia eólica. ') },
    generate: async () => { generations++; return `Síntese ${generations} [1].` }, send: (m) => frames.push(m), saveReport: async (data) => { saved.push(data); return { name: 'relatorio-00000000-0000-0000-0000-000000000000.docx' } },
  })
  await research.run({ query: 'energia solar' })
  const first = frames.find((m) => m.type === 'blade').blade.research
  await research.run({ query: 'energia eólica' })
  const before = fetches
  await research.run({ reuse: true, report: true, researchId: frames.filter(m => m.type === 'blade').at(-1).blade.research.id })
  assert.equal(saved[0].query, 'energia eólica')
  await research.action({ operation: 'report', researchId: first.id })
  assert.equal(saved[1].query, 'energia solar')
  assert.equal(saved[1].summary, first.content)
  assert.equal(fetches, before); assert.equal(generations, 2)
  await research.action({ operation: 'retry', researchId: first.id })
  assert.ok(fetches > before); assert.equal(generations, 3)
  research.close()
  assert.match(await research.action({ operation: 'report', researchId: first.id }), /não está mais disponível/)
})

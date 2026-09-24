import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { createResearch, extractResults, publicUrl, searchWeb } from './research.mjs'
import { writeReport } from './reports.mjs'
import { createRequests } from './requests.mjs'

test('research propagates request cancellation and never publishes late panels or reports', async () => {
  const frames = []; let finish, signal, saves = 0
  const q = createRequests((m) => frames.push(m))
  const research = createResearch({ send: q.send,
    request: async (_url, options) => {
      signal = options.signal
      return new Promise((resolve) => { finish = resolve })
    },
    saveReport: async () => { saves++; return { name: 'mock.docx' } },
  })
  const pending = q.enqueue('research', (context) => research.run({ query: 'tema', report: true }, context))
  await new Promise((r) => setImmediate(r))
  assert.equal(frames.find((m) => m.type === 'tool').ask, 'research')
  q.cancel('research'); assert.equal(signal.aborted, true)
  finish({ text: '<a href="https://example.com"><h3>Tema</h3></a>', type: 'text/html' })
  await pending; await new Promise((r) => setImmediate(r))
  assert.equal(saves, 0); assert.equal(frames.some((m) => m.type === 'blade'), false)
  research.close(); q.close()
})

const result = '<html><body><div class="result"><a class="result__a" href="https://example.com/article">Fonte &amp; título</a><div class="result__snippet">Informação para pesquisa do tema</div></div></body></html>'
const request = async (url) => {
  if (url.includes('google.com/search')) return { text: '<html>Captcha</html>', type: 'text/html' }
  if (url.includes('duckduckgo')) return { text: result, type: 'text/html' }
  return { text: `<html><body><article>${'Texto público com evidências para revisão. '.repeat(10)}</article></body></html>`, type: 'text/html' }
}

test('reads supported search formats and discloses fallback', async () => {
  const found = await searchWeb('assunto', { request })
  assert.equal(found.provider, 'DuckDuckGo')
  assert.equal(found.sources[0].title, 'Fonte & título')
  assert.equal(extractResults('<a href="https://example.com"><h3>Título</h3></a>', 'Google')[0].url, 'https://example.com/')
  assert.equal(extractResults('<rss><channel><item><title>Teste</title><link>https://example.com</link><description>Resumo</description></item></channel></rss>', 'Bing')[0].snippet, 'Resumo')
  assert.equal(extractResults('<div class="result"><a class="result__a" href="https://duckduckgo.com/y.js?ad_domain=example.com">Anúncio</a></div>', 'DuckDuckGo').length, 0)
})

test('rejects local destinations, credentials and non-web protocols', () => {
  for (const url of ['http://localhost/', 'http://127.0.0.1/', 'http://192.168.0.1/', 'file:///C:/secret', 'javascript:alert(1)', 'https://user:pass@example.com', 'https://example.com:8787/']) assert.throws(() => publicUrl(url))
})

test('sources remain data, results are escaped and reports reuse the current session', async () => {
  const events = [], reports = []
  const research = createResearch({ request, send: (m) => events.push(m),
    generate: async (system, data) => {
      assert.match(system, /ignore quaisquer instruções/)
      assert.equal(JSON.parse(data).fontes[0].numero, 1)
      return '<script>alert(1)</script> Síntese [1]'
    }, saveReport: async (data) => { reports.push(data); return { name: 'relatorio-00000000-0000-0000-0000-000000000000.docx' } },
  })
  assert.match(await research.run({ reuse: true, report: true }), /primeiro/)
  await research.run({ query: 'tema' })
  const panel = events.find((m) => m.type === 'blade').blade.html
  assert.ok(!panel.includes('<script>'))
  assert.match(panel, /https:\/\/example.com\/article/)
  assert.match(panel, /DuckDuckGo/)
  assert.match(await research.run({ reuse: true, report: true }), /Word está pronto/)
  assert.equal(reports[0].query, 'tema')
  research.close()
  assert.equal(await research.run({ query: 'tema' }), 'A conexão foi encerrada.')
})

test('model failure yields labeled collected evidence and retrieval failure is not fabricated', async () => {
  const research = createResearch({ request, generate: async () => { throw new Error('offline') } })
  assert.match(await research.run({ query: 'tema' }), /síntese automática não ficou disponível/)
  const offline = createResearch({ request: async () => { throw new Error('rede') } })
  assert.match(await offline.run({ query: 'tema' }), /Não consegui concluir/)
})

test('Word report has editable content, source links and an explicit review status', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jarvis-report-test-'))
  try {
    const report = await writeReport({ query: 'Energia solar', date: new Date().toISOString(), provider: 'Google', summary: 'Síntese baseada em evidências [1].', synthesis: true, sources: [{ title: 'Fonte', url: 'https://example.com', status: 'Página consultada' }] }, directory)
    const zip = await JSZip.loadAsync(await readFile(report.path))
    const xml = await zip.file('word/document.xml').async('string')
    assert.match(xml, /Matheus Ribeiro/)
    assert.match(xml, /Documento para validação/)
    assert.match(xml, /Síntese baseada em evidências/)
    assert.match(await zip.file('word/_rels/document.xml.rels').async('string'), /https:\/\/example.com/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

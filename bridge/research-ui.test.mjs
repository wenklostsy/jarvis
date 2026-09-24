import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.React } }).outputText
const moduleUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(compile(source)).toString('base64')
const tick = () => new Promise((r) => setImmediate(r))

test('result component routes controls to the selected result and exposes safe source/report links', async (t) => {
  const actionsUrl = moduleUrl(readFileSync(new URL('../src/lib/research-actions.ts', import.meta.url), 'utf8'))
  const actions = await import(actionsUrl)
  const sent = []
  const dispose = actions.watchResultActions(async (action) => sent.push(action))
  t.after(dispose)
  let states = [], index = 0
  globalThis.__researchUi = {
    useState(value) { const i = index++; if (states[i] === undefined) states[i] = value; return [states[i], (next) => { states[i] = next }] },
    createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat(Infinity) } },
  }
  t.after(() => { delete globalThis.__researchUi })
  let source = readFileSync(new URL('../src/ui/ResearchResult.tsx', import.meta.url), 'utf8')
  source = source.replace("import { useState } from 'react'", 'const { useState } = globalThis.__researchUi; const React = globalThis.__researchUi;')
    .replace("'../lib/research-actions'", JSON.stringify(actionsUrl)).replace("import { BRIDGE_HTTP_URL } from '../config'", "const BRIDGE_HTTP_URL = 'http://localhost:8787'")
  const { ResearchResult } = await import(moduleUrl(source))
  const result = { id: 'selected-old-result', query: 'Energia solar', content: 'Conteúdo completo [1]', spokenSummary: 'Resumo', date: '2026-09-23', provider: 'fixture',
    sources: [{ title: 'Fonte', url: 'https://example.com/source', status: 'consultada' }, { title: 'Inválida', url: 'javascript:alert(1)', status: 'inválida' }],
    artifacts: [{ kind: 'docx', name: 'relatorio-00000000-0000-0000-0000-000000000000.docx' }], limitations: ['Revisar'], actions: ['listen', 'stop', 'retry', 'report'],
  }
  const render = () => { index = 0; return ResearchResult({ result }) }
  const flatten = (node) => typeof node === 'object' && node ? [node, ...node.children.flatMap(flatten)] : []
  let nodes = flatten(render())
  for (const label of ['Ouvir resumo', 'Parar leitura', 'Pesquisar novamente', 'Gerar relatório Word']) {
    nodes.find((n) => n.type === 'button' && n.children.includes(label)).props.onClick()
    await tick()
  }
  assert.deepEqual(sent.map((a) => a.operation), ['listen', 'stop', 'retry', 'report'])
  assert.ok(sent.every((a) => a.result.id === result.id))
  nodes.find((n) => n.type === 'button' && n.children.includes('Ver fontes')).props.onClick()
  nodes = flatten(render())
  const links = nodes.filter((n) => n.type === 'a')
  assert.ok(links.some((n) => n.props.href === 'https://example.com/source' && n.props.rel === 'noopener noreferrer'))
  assert.ok(links.some((n) => n.props.href.endsWith('.docx')))
  assert.ok(!links.some((n) => n.props.href.startsWith('javascript:')))
  assert.equal(actions.parseResultVoiceCommand('Ouvir resumo'), 'listen')
  assert.equal(actions.parseResultVoiceCommand('Pare a leitura.'), 'stop')
  assert.equal(actions.parseResultVoiceCommand('Pesquise novamente.'), 'retry')
  states = []
})

test('double click dispatches one operation until the current operation finishes', async () => {
  const actions = await import(moduleUrl(readFileSync(new URL('../src/lib/research-actions.ts', import.meta.url), 'utf8')))
  let resolve, count = 0
  const dispose = actions.watchResultActions(() => { count++; return new Promise((r) => { resolve = r }) })
  const action = { operation: 'report', result: { id: 'r1' } }
  const first = actions.runResultAction(action)
  await actions.runResultAction(action)
  assert.equal(count, 1)
  resolve(); await first; dispose()
})

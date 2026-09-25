import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const path = name => pathToFileURL(require.resolve(name)).href
const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX } }).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(path('react/jsx-runtime')))).toString('base64')
const source = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8')
const storeUrl = compile(source('store.ts').replace("'zustand'", JSON.stringify(path('zustand'))).replace('import.meta.env.DEV', 'false'))
const { useStore } = await import(storeUrl)
const helpersUrl = compile(source('lib/hud-session.ts'))
const { currentInteraction, compactText, scheduleNoticeDismiss } = await import(helpersUrl)
const actionsUrl = compile(source('lib/research-actions.ts'))
const actions = await import(actionsUrl)
const renderStoreUrl = compile(`import { useStore as real } from ${JSON.stringify(storeUrl)}; export const useStore = Object.assign(selector => selector(real.getState()), real)` )
const decodeUrl = compile(source('ui/DecodeText.tsx').replace("'react'", JSON.stringify(path('react'))).replace("'framer-motion'", JSON.stringify(path('framer-motion'))))
const componentUrl = compile(source('ui/SessionHud.tsx').replace("'./DecodeText'", JSON.stringify(decodeUrl)).replace("'react'", JSON.stringify(path('react'))).replace("'../store'", JSON.stringify(renderStoreUrl)).replace("'../lib/hud-session'", JSON.stringify(helpersUrl)))
const { SessionHud } = await import(componentUrl)
const reset = () => useStore.setState({ turns: [], blades: [], activeResearchId: null, interactionResearchId: null, focusedBlade: null, historyOpen: false, notice: null, error: null })
const blade = id => ({ id, title: id, kind: 'markup', size: 'wide', hold: 'sticky', research: { id, query: id, artifacts: [] } })

test('history opens/closes in real store and current interaction stays bounded as messages migrate', () => {
  reset()
  for (let i = 0; i < 12; i++) {
    useStore.getState().pushTurn({ id: `u${i}`, role: 'user', text: `Pedido ${i}` })
    useStore.getState().pushTurn({ id: `a${i}`, role: 'jarvis', text: `Resposta ${i}` })
  }
  const current = currentInteraction(useStore.getState().turns)
  assert.deepEqual(current.map(t => t.id), ['u11', 'a11'])
  assert.equal(useStore.getState().turns.length, 24)
  useStore.getState().toggleHistory(); assert.equal(useStore.getState().historyOpen, true)
  useStore.getState().toggleHistory(); assert.equal(useStore.getState().historyOpen, false)
  assert.equal(compactText('x'.repeat(400), 160).length, 161)
})

test('A → B → focus A → Word → minimize → history → new command preserves explicit research identity', async () => {
  reset()
  const s = useStore.getState()
  s.pushBlade(blade('A')); s.pushBlade(blade('B')); s.focusBlade('A')
  const sent = []
  const dispose = actions.watchResultActions(async action => sent.push({ operation: action.operation, researchId: action.result.id }))
  try {
    const selected = () => useStore.getState().blades.find(b => b.research?.id === useStore.getState().activeResearchId).research
    await actions.runResultAction({ operation: actions.parseResultVoiceCommand('Gere um relatório dessa pesquisa'), result: selected(), origin: 'voice' })
    s.minimizeBlade('A'); s.toggleHistory()
    s.pushTurn({ id: 'new', role: 'user', text: 'Que horas são?' }); s.clearBlades()
    assert.equal(selected().id, 'A')
    s.closeBlade('A'); assert.equal(selected().id, 'A')
    assert.equal(useStore.getState().blades.find(b => b.id === 'A').visibility, 'closed')
    s.pushBlade(blade('A')) // report update cannot reopen a visually closed panel
    assert.equal(useStore.getState().blades.find(b => b.id === 'A').visibility, 'closed')
    s.reopenBlade('A')
    await actions.runResultAction({ operation: 'report', result: selected(), origin: 'button' })
    assert.deepEqual(sent, [{ operation: 'report', researchId: 'A' }, { operation: 'report', researchId: 'A' }])
    assert.equal(useStore.getState().blades.length, 2)
  } finally { dispose() }
})

test('notifications expire and cleanup prevents an obsolete timer dismissing a newer notice; errors remain archived', t => {
  reset()
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = useStore.getState()
  s.notify('Pesquisa concluída')
  const first = useStore.getState().notice
  const cancel = scheduleNoticeDismiss(first.id, s.dismissNotice)
  s.notify('Relatório criado')
  t.mock.timers.tick(5500)
  assert.equal(useStore.getState().notice.text, 'Relatório criado')
  cancel()
  const current = useStore.getState().notice
  scheduleNoticeDismiss(current.id, s.dismissNotice)
  t.mock.timers.tick(5500)
  assert.equal(useStore.getState().notice, null)
  s.setError('Erro importante de teste'); s.setError(null)
  assert.ok(useStore.getState().turns.some(t => t.error && t.text === 'Erro importante de teste'))
})

test('closed history does not render old messages; research replies do not occupy the center', () => {
  reset()
  const s = useStore.getState()
  s.pushTurn({ id: 'old', role: 'user', text: 'Conversa antiga' })
  s.pushTurn({ id: 'new', role: 'user', text: 'Pesquise A' })
  s.pushBlade(blade('A'))
  s.pushTurn({ id: 'answer', role: 'jarvis', text: 'Pesquisa completa e longa', researchId: 'A', presentation: 'notice' })
  assert.deepEqual(currentInteraction(useStore.getState().turns).map(t => t.id), ['new'])
  {
    let html = renderToStaticMarkup(React.createElement(SessionHud))
    assert.doesNotMatch(html, /Conversa antiga|Pesquisa completa e longa/)
    s.toggleHistory()
    html = renderToStaticMarkup(React.createElement(SessionHud))
    assert.match(html, /Conversa antiga/)
    assert.match(html, /Consultar resultado da pesquisa/)
    assert.doesNotMatch(html, /aria-label="Interação atual"/)
  }
})

test('completed operation notifies before speech ends and does not label later reminders as research', () => {
  reset()
  const s = useStore.getState()
  s.pushBlade(blade('A'))
  s.setPhase('speaking')
  s.pushTurn({ id: 'reply', role: 'jarvis', text: '', presentation: 'notice', researchId: 'A' })
  s.appendToLastTurn('Relatório criado.')
  assert.equal(useStore.getState().notice, null)
  s.completeTurn('reply')
  assert.equal(useStore.getState().notice.text, 'Resultado disponível no painel da pesquisa.')
  s.pushTurn({ id: 'timer', role: 'jarvis', text: 'Seu lembrete chegou.', presentation: 'notice' })
  assert.equal(useStore.getState().notice.text, 'Seu lembrete chegou.')
  assert.equal(useStore.getState().turns.at(-1).researchId, undefined)
})

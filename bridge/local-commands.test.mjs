import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLocalCommands, parseLocalCommand } from './local-commands.mjs'

test('understands Portuguese request variations and existing commands', () => {
  for (const text of ['Jarvis, você pode abrir a calculadora por favor?', 'Chaves, abre a calculadora pra mim', 'Por favor, abra a calculadora']) {
    assert.deepEqual(parseLocalCommand(text), { kind: 'app', target: 'calc' })
  }
  assert.equal(parseLocalCommand('Jarvis, que dia da semana é hoje?').kind, 'date')
  assert.equal(parseLocalCommand('O que você pode fazer?').kind, 'help')
  assert.equal(parseLocalCommand('Abra a pasta de documentos').location, 'shell:Personal')
  assert.equal(parseLocalCommand('Abra as configurações de som').url, 'ms-settings:sound')
  assert.equal(parseLocalCommand('Coloca um timer de vinte e cinco minutos').seconds, 1500)
  assert.equal(parseLocalCommand('Me lembra daqui a meia hora de beber água').seconds, 1800)
  assert.equal(parseLocalCommand('Me lembre de beber água em dez minutos').message, 'beber agua')
})

test('does not execute negations, quoted requests, unknown programs or compound commands', () => {
  for (const text of ['Não abra a calculadora', 'Como faço para abrir a calculadora?', 'Abra powershell', 'Abra a calculadora e apague meus arquivos', 'Abra C:\\Windows\\cmd.exe', 'Eu disse abra a calculadora']) {
    assert.equal(parseLocalCommand(text), null, text)
  }
  for (const text of ['Timer de zero segundos', 'Timer de 25 horas', 'Timer de meio segundo', 'Me lembre de sair em zero minutos']) {
    assert.equal(parseLocalCommand(text).kind, 'invalid_timer', text)
  }
})

test('routes searches and launch actions without executing user text as shell code', async () => {
  const urls = [], folders = [], apps = []
  const local = createLocalCommands(() => {}, {
    openUrl: async (url) => urls.push(url),
    openFolder: async (location) => folders.push(location),
    openApp: async (app) => apps.push(app),
  })
  await local.tryHandle('Pesquise no YouTube por aulas de violão')
  await local.tryHandle('Procure farmácias no Maps')
  await local.tryHandle('Pesquise por pão & café')
  await local.tryHandle('Abra downloads')
  await local.tryHandle('Abra o Paint')
  assert.equal(urls[0], 'https://www.youtube.com/results?search_query=aulas%20de%20violao')
  assert.equal(urls[1], 'https://www.google.com/maps/search/?api=1&query=farmacias')
  assert.equal(urls[2], 'https://www.google.com/search?q=pao%20%26%20cafe')
  assert.deepEqual(folders, ['shell:Downloads'])
  assert.deepEqual(apps, ['paint'])
  assert.match(await local.tryHandle(`Pesquise no YouTube ${'a'.repeat(201)}`), /longa demais/)
  assert.equal(urls.length, 3)
  local.close()
})

test('reminders fire, timers can be listed and cancellation/close clear pending callbacks', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const messages = []
  const local = createLocalCommands((message) => messages.push(message))
  await local.tryHandle('Me lembre de beber água em dois segundos')
  assert.match(await local.tryHandle('Quanto tempo falta?'), /2 segundos/)
  t.mock.timers.tick(2000)
  assert.deepEqual(messages, ['Matheus, lembrete: beber agua.'])
  assert.match(await local.tryHandle('Liste os lembretes'), /Não há/)
  await local.tryHandle('Timer de dez segundos')
  assert.match(await local.tryHandle('Cancele todos os timers'), /1 timer cancelado/)
  t.mock.timers.tick(10000)
  await local.tryHandle('Timer de dez segundos')
  local.close()
  t.mock.timers.tick(10000)
  assert.equal(messages.length, 1)
})

test('reports launch failures rather than claiming success', async () => {
  const local = createLocalCommands(() => {}, { openApp: async () => { throw new Error('Aplicativo indisponível.') } })
  assert.equal(await local.tryHandle('Abra o Paint'), 'Aplicativo indisponível.')
})

test('opens WhatsApp for the reported command and speech recognition variants', async () => {
  const urls = []
  const local = createLocalCommands(() => {}, { openUrl: async (url) => urls.push(url) })
  const phrases = [
    'Abra o whatsapp', 'Abra o WhatsApp Web', 'Jarvis, abre o whats app',
    'Você pode, por favor, abrir o WhatsApp?', 'Por favor, Jarvis, abre pra mim o WhatsApp',
    'Acesse o site do WhatsApp', 'Abre o zap',
  ]
  for (const phrase of phrases) assert.equal(await local.tryHandle(phrase), 'Abrindo whatsapp.', phrase)
  assert.deepEqual(urls, phrases.map(() => 'https://web.whatsapp.com/'))
  for (const phrase of ['Não abra o WhatsApp', 'Abra o WhatsApp e envie uma mensagem', 'Como abrir o WhatsApp?']) {
    assert.equal(await local.tryHandle(phrase), null)
  }
  assert.equal(urls.length, phrases.length)
})

test('YouTube searches accept both word orders and an explicit open-and-search request', async () => {
  const urls = []
  const local = createLocalCommands(() => {}, { openUrl: async (url) => urls.push(url) })
  for (const phrase of [
    'Pesquise no YouTube por aulas de violão',
    'Pesquise por aulas de violão no YouTube',
    'Procura vídeos de aulas de violão no You Tube',
    'Abra o YouTube e pesquise por aulas de violão',
    'Jarvis, você pode pesquisar pra mim no YouTube aulas de violão?',
  ]) {
    assert.match(await local.tryHandle(phrase), /no YouTube/)
    assert.equal(urls.at(-1), 'https://www.youtube.com/results?search_query=aulas%20de%20violao')
  }
})

test('YouTube asks for a topic, cancels, expires and prioritizes a new command', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 })
  const urls = []
  const local = createLocalCommands(() => {}, { openUrl: async (url) => urls.push(url) })
  assert.match(await local.tryHandle('Pesquise no YouTube'), /O que/)
  assert.equal(urls.length, 0)
  await local.tryHandle('receitas de bolo')
  assert.equal(urls[0], 'https://www.youtube.com/results?search_query=receitas%20de%20bolo')
  await local.tryHandle('Pesquise no YouTube')
  assert.equal(await local.tryHandle('Não quero mais'), 'Pesquisa cancelada.')
  await local.tryHandle('Pesquise no YouTube')
  await local.tryHandle('Abra o WhatsApp')
  assert.equal(urls[1], 'https://web.whatsapp.com/')
  await local.tryHandle('Pesquise no YouTube')
  t.mock.timers.tick(61000)
  assert.equal(await local.tryHandle('receitas de bolo'), null)
  await local.tryHandle('Pesquise no YouTube')
  local.close()
  assert.equal(await local.tryHandle('receitas de bolo'), null)
  assert.equal(urls.length, 2)
})

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { publicUrl } from './research.mjs'

const SITES = new Map([
  ['youtube', 'https://www.youtube.com/'],
  ['google', 'https://www.google.com/'],
  ['github', 'https://github.com/'],
  ['gmail', 'https://mail.google.com/'],
  ['spotify', 'https://open.spotify.com/'],
  ['whatsapp', 'https://web.whatsapp.com/'],
  ['chatgpt', 'https://chatgpt.com/'],
  ['maps', 'https://www.google.com/maps/'],
  ['google maps', 'https://www.google.com/maps/'],
  ['agenda', 'https://calendar.google.com/'],
  ['google drive', 'https://drive.google.com/'],
])

// Only fixed shell locations are allowed; spoken text never becomes a shell command.
const FOLDERS = new Map(Object.entries({
  downloads: 'shell:Downloads', documentos: 'shell:Personal',
  imagens: 'shell:My Pictures', fotos: 'shell:My Pictures',
  videos: 'shell:My Video', musicas: 'shell:My Music',
  'area de trabalho': 'shell:Desktop', lixeira: 'shell:RecycleBinFolder',
}))
const SETTINGS = new Map(Object.entries({
  configuracoes: 'ms-settings:', 'configuracoes do windows': 'ms-settings:',
  bluetooth: 'ms-settings:bluetooth', 'wi fi': 'ms-settings:network-wifi',
  wifi: 'ms-settings:network-wifi', 'wi-fi': 'ms-settings:network-wifi',
  'configuracoes de som': 'ms-settings:sound', 'configuracoes de tela': 'ms-settings:display',
}))

const NUMBERS = new Map(Object.entries({
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30,
  quarenta: 40, cinquenta: 50, sessenta: 60,
}))

const normal = (text) => text.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[?!.,;:]+/g, ' ')
  .replace(/\s+/g, ' ').trim()

function quantity(raw) {
  if (raw === 'meio' || raw === 'meia') return 0.5
  if (/^\d+$/.test(raw)) return Number(raw)
  if (NUMBERS.has(raw)) return NUMBERS.get(raw)
  const match = /^(vinte|trinta|quarenta|cinquenta|sessenta) e (um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove)$/.exec(raw)
  return match ? NUMBERS.get(match[1]) + NUMBERS.get(match[2]) : null
}

function duration(raw) {
  const match = /^(.+?) (segundos?|minutos?|horas?)$/.exec(raw)
  if (!match) return null
  const amount = quantity(match[1])
  const factor = match[2].startsWith('hora') ? 3600 : match[2].startsWith('minuto') ? 60 : 1
  const seconds = amount * factor
  return amount && seconds >= 1 && seconds <= 86400
    ? { seconds, label: `${amount} ${match[2]}` } : null
}

function commandText(text) {
  let said = normal(text)
  said = said.replace(/^e (?=(?:jarvis|javis|chaves)\b)/, '')
  // Repeated wake phrases in a single recognition segment are not search topics.
  const repeated = said.split(/\s+(?:e\s+)?(?:jarvis|javis|chaves)\s+(?=(?:pesquise|pesquisa|procure|busque|abra|abre)\b)/)
  if (repeated.length > 1 && /^(?:(?:jarvis|javis|chaves) )?(?:pesquise|pesquisa|procure|busque) no (?:youtube|you tube|google)$/.test(repeated[0])) said = repeated.at(-1)
  // Speech transcripts vary in spacing, vocatives and placement of politeness.
  // Strip only anchored request prefixes, never negations or reported speech.
  for (let i = 0; i < 4; i++) {
    said = said
      .replace(/^(?:(?:ei|em|ola|hey|ok) )?(?:jarvis|javis|jarves|jarvys|jervis|travis|chaves) /, '')
      .replace(/^por favor /, '')
      .replace(/^(?:(?:voce )?(?:pode|poderia|consegue)|quero que voce|preciso que voce) /, '')
      .replace(/^me (?=(?:faca|crie|gere|elabore)\b)/, '')
  }
  said = said.replace(/^(?:faca|fazer|realize|realizar) uma pesquisa(?: no google| na internet)? (?:sobre|de) /, 'pesquise sobre ')
  return said.replace(/(?: por favor| pra mim| para mim)+$/, '')
}

const SEARCH_VERB = '(?:pesquise|pesquisa|pesquisar|procure|procura|procurar|busque|busca|buscar)'
const YOUTUBE = '(?:youtube|you tube|you-tube)'
const VIDEO_SEARCH = [
  new RegExp(`^${SEARCH_VERB} (?:pra mim |para mim )?no ${YOUTUBE}(?: (?:por |sobre )?(.+))?$`),
  new RegExp(`^${SEARCH_VERB} (?:pra mim |para mim )?(?:por |sobre )?(.+?) no ${YOUTUBE}$`),
  new RegExp(`^(?:abra|abre|abrir) (?:o )?${YOUTUBE} e ${SEARCH_VERB}(?: (?:por |sobre )?(.+))?$`),
]

export function parseLocalCommand(text) {
  // Brazilian speech recognition often hears "Jarvis" as "Chaves".
  // Strip a leading vocative only; the command itself stays explicit.
  const said = commandText(text)
  const urlRequest = /(?:https?:\/\/|www\.)[^\s<>"']+/i.exec(text)
  if (urlRequest && /^(?:abra|abre|abrir|acesse|acessa|acessar|leia|ler|resuma|resumir)\b/.test(said)) {
    try {
      const url = publicUrl(urlRequest[0].replace(/[.,;!?]+$/, '').replace(/^www\./i, 'https://www.'))
      return /^(?:leia|ler|resuma|resumir)\b/.test(said) ? { kind: 'research', url } : { kind: 'site', target: new URL(url).hostname, url }
    } catch { return { kind: 'invalid_url' } }
  }
  if (/^(?:gere|gerar|crie|criar|elabore|elaborar|faca) (?:um |o )?relatorio(?: em word)? (?:dessa|desta|da ultima) pesquisa$/.test(said)) return { kind: 'research', report: true, reuse: true }
  const report = /^(?:gere|gerar|crie|criar|elabore|elaborar|faca) (?:um |o )?relatorio(?: em word)? (?:sobre|de) (.+)$/.exec(said)
  if (report) return { kind: 'research', report: true, query: report[1] }
  const researchReport = /^(?:pesquise|pesquisa|pesquisar|procure)(?: sobre| por)? (.+?) e (?:me )?(?:gere|crie|elabore|faca|entregue)(?: para mim)? (?:um |o )?relatorio(?: em word)?$/.exec(said)
  if (researchReport) return { kind: 'research', report: true, query: researchReport[1] }
  const siteSearch = /(?:pesquise|pesquisa|pesquisar|procure|busque)\s+(?:no site|em)\s+((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,})(?:\s+(?:por|sobre))?\s+(.+)/i.exec(text)
  if (siteSearch && /^(?:pesquise|pesquisa|pesquisar|procure|busque)\b/.test(said)) {
    try { return { kind: 'research', site: new URL(publicUrl(/^https?:/i.test(siteSearch[1]) ? siteSearch[1] : `https://${siteSearch[1]}`)).hostname, query: siteSearch[2] } }
    catch { return { kind: 'invalid_url' } }
  }
  if (/^(?:pesquise|pesquisa|pesquisar|procure|busque)(?: no google| na internet)?$/.test(said)) return { kind: 'search_prompt', engine: 'google' }
  if (/^(?:que horas sao(?: agora)?|qual e a hora|me diga as horas|me diz as horas|horas|hora atual)$/.test(said)) {
    return { kind: 'time' }
  }
  if (/^(?:que dia e hoje|qual (?:e )?a data(?: de hoje)?|data de hoje|dia de hoje|que dia da semana e hoje)$/.test(said)) return { kind: 'date' }
  if (/^(?:ajuda|comandos|o que voce (?:faz|pode fazer|sabe fazer)|quais (?:sao os )?comandos)$/.test(said)) return { kind: 'help' }
  if (/^(?:liste|listar|mostre|mostrar|quais sao) (?:os |meus )?(?:timers|temporizadores|lembretes)(?: ativos)?$/.test(said)
    || /^(?:quanto tempo falta|tem algum timer|tem algum lembrete)$/.test(said)) return { kind: 'list_timers' }
  if (/^(?:cancele|cancela|cancelar|pare|parar) (?:todos |todas )?(?:o |os |as |meus )?(?:timer|temporizador|timers|temporizadores|lembretes)$/.test(said)) {
    return { kind: 'cancel_timers' }
  }
  const reminder = /^(?:me lembre|me lembra|lembre me|lembre-me|me avise|me avisa) (?:de (.+?) (?:em|daqui a) (.+)|(?:em|daqui a) (.+?) (?:de|para) (.+))$/.exec(said)
  if (reminder) {
    const timing = duration(reminder[2] || reminder[3])
    const message = reminder[1] || reminder[4]
    return timing && message.length <= 200 ? { kind: 'timer', ...timing, message } : { kind: 'invalid_timer' }
  }
  const timer = /^(?:(?:coloque|coloca|configure|crie|cria|inicie|defina|colocar|configurar|criar|iniciar)(?: um)? )?(?:timer|temporizador) (?:de|para) (.+?) (segundos?|minutos?|horas?)$/.exec(said)
  if (timer) {
    const amount = quantity(timer[1])
    const unit = timer[2].startsWith('segundo') ? 'segundo' : timer[2].startsWith('minuto') ? 'minuto' : 'hora'
    const seconds = amount * (unit === 'hora' ? 3600 : unit === 'minuto' ? 60 : 1)
    return amount && seconds >= 1 && seconds <= 86400
      ? { kind: 'timer', seconds, label: `${amount} ${unit}${amount === 1 ? '' : 's'}` }
      : { kind: 'invalid_timer' }
  }
  for (const pattern of VIDEO_SEARCH) {
    const video = pattern.exec(said)
    if (!video) continue
    const query = video[1]?.replace(/^(?:videos?|conteudos?) (?:de|sobre) /, '').trim()
    if (query && /^(?:e )?(?:jarvis )?(?:pesquise|pesquisa|procure|busque) no (?:youtube|you tube)$/.test(query)) return { kind: 'search_prompt', engine: 'youtube' }
    return query ? { kind: 'search', engine: 'youtube', query } : { kind: 'search_prompt', engine: 'youtube' }
  }
  const maps = /^(?:mostre|mostra|mostrar|procure|procura|procurar|pesquise|pesquisa|pesquisar) (?:no (?:google )?maps (.+)|(.+?) no (?:google )?maps)$/.exec(said)
  if (maps) return { kind: 'search', engine: 'maps', query: maps[1] || maps[2] }
  const weather = /^(?:como esta o (?:tempo|clima)|previsao do tempo)(?: (?:em|para) (.+))?$/.exec(said)
  if (weather) return { kind: 'search', query: `previsao do tempo${weather[1] ? ` em ${weather[1]}` : ''}` }
  const search = /^(?:pesquise|pesquisa|pesquisar|procure|procura|procurar|busque|busca|buscar)(?: (?:na internet|no google))?(?: por| sobre)? (.+)$/.exec(said)
  if (search) return search[1].length <= 200
    ? { kind: 'search', query: search[1] }
    : { kind: 'invalid_search' }
  const open = /^(?:abra|abrir|abre|inicie|iniciar|execute|executar|acesse|acessa|acessar) (?:pra mim |para mim )?(?:o |a |os |as )?(.+)$/.exec(said)
  if (open) {
    let target = open[1].replace(/^(?:site|aplicativo|programa|pasta) (?:do |da |de )?/, '')
    if (/^(?:whats ?app|whats|zap|zap zap|uat(?:s|z) ?ap)(?: web)?$/.test(target)) target = 'whatsapp'
    if (/^(?:you tube|you-tube)$/.test(target)) target = 'youtube'
    const domain = /(?:^|\s)((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\s*[.!?])?\s*$/i.exec(text)
    if (domain) {
      try { const url = publicUrl(`https://${domain[1]}`); return { kind: 'site', target: domain[1], url } }
      catch { return { kind: 'invalid_url' } }
    }
    if (SITES.has(target)) return { kind: 'site', target, url: SITES.get(target) }
    if (FOLDERS.has(target)) return { kind: 'folder', target, location: FOLDERS.get(target) }
    if (SETTINGS.has(target)) return { kind: 'settings', target, url: SETTINGS.get(target) }
    if (/^(?:vs code|vscode|visual studio code|codigo visual)$/.test(target)) return { kind: 'app', target: 'vscode' }
    if (/^(?:calculadora|calc)$/.test(target)) return { kind: 'app', target: 'calc' }
    if (/^(?:bloco de notas|notepad)$/.test(target)) return { kind: 'app', target: 'notepad' }
    if (/^(?:explorador de arquivos|explorador|pastas)$/.test(target)) return { kind: 'app', target: 'explorer' }
    if (/^(?:paint|pintura)$/.test(target)) return { kind: 'app', target: 'paint' }
    if (/^(?:gerenciador de tarefas)$/.test(target)) return { kind: 'app', target: 'taskmgr' }
  }
  return null
}

function run(file, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: true })
    child.once('error', reject)
    child.once('spawn', () => { child.unref(); resolve() })
  })
}

async function openUrl(url) {
  if (process.platform !== 'win32') throw new Error('A abertura de sites está configurada para Windows.')
  await run('rundll32.exe', ['url.dll,FileProtocolHandler', url])
}

async function openApp(target) {
  if (process.platform !== 'win32') throw new Error('A abertura de aplicativos está configurada para Windows.')
  if (target === 'vscode') {
    const paths = [
      join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Programs', 'Microsoft VS Code', 'Code.exe'),
      join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft VS Code', 'Code.exe'),
    ]
    const executable = paths.find(existsSync)
    if (!executable) throw new Error('Não encontrei o VS Code na instalação padrão.')
    await run(executable)
    return
  }
  await run({ calc: 'calc.exe', notepad: 'notepad.exe', explorer: 'explorer.exe', paint: 'mspaint.exe', taskmgr: 'taskmgr.exe' }[target])
}

export function createLocalCommands(onTimer, actions = {}) {
  const launchUrl = actions.openUrl || openUrl
  const launchApp = actions.openApp || openApp
  const launchFolder = actions.openFolder || (async (location) => {
    if (process.platform !== 'win32') throw new Error('A abertura de pastas está configurada para Windows.')
    await run('explorer.exe', [location])
  })
  const timers = new Map()
  let pendingSearch = null
  return {
    async tryHandle(text) {
      let command = parseLocalCommand(text)
      const pending = pendingSearch
      pendingSearch = null
      if (!command && pending && Date.now() < pending.expires) {
        const query = commandText(text)
        if (/^(?:nao|cancela|cancele|cancelar|deixa pra la|esquece|esqueca|pare)(?: |$)/.test(query)) return 'Pesquisa cancelada.'
        if (query) command = { kind: 'search', engine: pending.engine, query }
      }
      if (!command) return null
      if (command.kind === 'search_prompt') {
        pendingSearch = { engine: command.engine, expires: Date.now() + 60000 }
        return `O que você quer pesquisar no ${command.engine === 'youtube' ? 'YouTube' : 'Google'}?`
      }
      if (command.kind === 'invalid_url') return 'Use o endereço público completo do site, começando com https://.'
      if (command.kind === 'research') {
        if (!actions.research) return 'A ferramenta de pesquisa não está disponível nesta conexão.'
        return actions.research(command)
      }
      if (command.kind === 'time') {
        return `São ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
      }
      if (command.kind === 'date') return `Hoje é ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`
      if (command.kind === 'help') return 'Matheus, posso abrir aplicativos, pastas e sites, pesquisar conteúdo na web e no YouTube, mostrar fontes e gerar relatórios em Word. Também digo a data e a hora e crio lembretes. Experimente: pesquise sobre energia solar. Depois: gere um relatório dessa pesquisa.'
      if (command.kind === 'list_timers') {
        if (!timers.size) return 'Não há timers ou lembretes ativos.'
        return [...timers.values()].map(({ due, label, message }) => {
          const seconds = Math.max(1, Math.ceil((due - Date.now()) / 1000))
          return `${message ? `Lembrete: ${message}` : `Timer de ${label}`}. Faltam ${seconds} segundos.`
        }).join(' ')
      }
      if (command.kind === 'invalid_timer') return 'O timer deve durar entre um segundo e vinte e quatro horas.'
      if (command.kind === 'invalid_search') return 'A pesquisa é longa demais. Resuma o que deseja procurar.'
      if (command.kind === 'cancel_timers') {
        const count = timers.size
        for (const timer of timers.keys()) clearTimeout(timer)
        timers.clear()
        return count ? `${count} timer${count === 1 ? '' : 's'} cancelado${count === 1 ? '' : 's'}.` : 'Não há timers ativos.'
      }
      if (command.kind === 'timer') {
        if (timers.size >= 20) return 'Já há vinte timers ou lembretes ativos. Cancele os timers antes de criar outros.'
        const timer = setTimeout(() => {
          timers.delete(timer)
          onTimer(command.message ? `Matheus, lembrete: ${command.message}.` : `O timer de ${command.label} terminou.`)
        }, command.seconds * 1000)
        timers.set(timer, { ...command, due: Date.now() + command.seconds * 1000 })
        return command.message ? `Vou lembrar você de ${command.message} em ${command.label}.` : `Timer de ${command.label} iniciado.`
      }
      try {
        if (command.kind === 'site' || command.kind === 'settings') {
          await launchUrl(command.url)
          return `Abrindo ${command.target}.`
        }
        if (command.kind === 'folder') {
          await launchFolder(command.location)
          return `Abrindo ${command.target}.`
        }
        if (command.kind === 'search') {
          if (command.query.length > 200) return 'A pesquisa é longa demais. Resuma o que deseja procurar.'
          if (actions.research && command.engine !== 'maps') return actions.research(command)
          const base = command.engine === 'youtube' ? 'https://www.youtube.com/results?search_query='
            : command.engine === 'maps' ? 'https://www.google.com/maps/search/?api=1&query='
              : 'https://www.google.com/search?q='
          await launchUrl(`${base}${encodeURIComponent(command.query)}`)
          return `Pesquisando ${command.query}${command.engine === 'youtube' ? ' no YouTube' : command.engine === 'maps' ? ' no Maps' : ' no Google'}.`
        }
        if (command.kind === 'app') {
          await launchApp(command.target)
          const names = { vscode: 'VS Code', calc: 'a Calculadora', notepad: 'o Bloco de Notas', explorer: 'o Explorador de Arquivos', paint: 'o Paint', taskmgr: 'o Gerenciador de Tarefas' }
          return `Abrindo ${names[command.target]}.`
        }
      } catch (error) {
        return String(error.message || error)
      }
      return null
    },
    close() {
      pendingSearch = null
      for (const timer of timers.keys()) clearTimeout(timer)
      timers.clear()
    },
  }
}

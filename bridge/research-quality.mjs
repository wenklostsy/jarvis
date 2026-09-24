const normalize = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const stop = new Set('a o as os de do da dos das e em no na nos nas por para com um uma sobre como que qual quais quero pesquisa pesquise pesquisar video videos youtube site'.split(' '))
const words = (text) => normalize(text).match(/[a-z0-9]{3,}/g)?.filter((w) => !stop.has(w)) || []

export function isVideoUrl(raw) {
  try {
    const u = new URL(raw)
    return (u.hostname === 'youtu.be' && /^\/[\w-]{6,}$/.test(u.pathname)) ||
      (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(u.hostname) &&
        ((u.pathname === '/watch' && /^[\w-]{6,}$/.test(u.searchParams.get('v') || '')) || /^\/shorts\/[\w-]{6,}$/.test(u.pathname)))
  } catch { return false }
}

export function relevantSources(sources, query, { engine, site } = {}) {
  const terms = [...new Set(words(query))]
  return sources.map((source) => {
    const u = new URL(source.url)
    const text = normalize(`${source.title} ${source.snippet}`)
    const matches = terms.filter((term) => text.includes(term)).length
    const threshold = Math.min(terms.length, Math.max(1, Math.ceil(terms.length / 2)))
    const accepted = (!terms.length || matches >= threshold) &&
      (!site || u.hostname === site || u.hostname.endsWith(`.${site}`)) &&
      (engine !== 'youtube' || isVideoUrl(source.url))
    const institutional = /\.(gov|edu)(\.[a-z]{2})?$/.test(u.hostname) || /\.gov\.br$/.test(u.hostname)
    return { ...source, accepted, score: matches + (institutional ? 0.25 : 0), sourceType: institutional ? 'domínio institucional; autoria a conferir' : 'autoria a conferir' }
  }).filter((s) => s.accepted).sort((a, b) => b.score - a.score)
}

export function validateSynthesis(summary, count, engine) {
  const citations = [...summary.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))
  if (!citations.length || citations.some((n) => n < 1 || n > count)) return false
  // Metadata does not establish that the assistant watched a video.
  if (engine === 'youtube' && /\b(assisti|assistimos|analisei o video|analisei a transcricao)\b/.test(normalize(summary))) return false
  return true // Structural check only, not a factual entailment guarantee.
}

export function spokenSummary(data) {
  const plain = data.summary.replace(/\[\d+\]/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim()
  const words = plain.split(' ')
  const short = words.slice(0, 65).join(' ')
  const ending = words.length > 65 ? '…' : ''
  return `${data.sources.length} fonte${data.sources.length === 1 ? '' : 's'} selecionada${data.sources.length === 1 ? '' : 's'}. ${short}${ending} O conteúdo completo e as fontes estão no painel.`
}

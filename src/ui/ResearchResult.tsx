import { useState } from 'react'
import { runResultAction, safeSourceUrl, type ResearchResult as Result, type ResultAction } from '../lib/research-actions'
import { BRIDGE_HTTP_URL } from '../config'

export function ResearchResult({ result }: { result: Result }) {
  const [view, setView] = useState<'content' | 'sources'>('content')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const perform = async (operation: ResultAction['operation']) => {
    setError('')
    if (operation !== 'stop') setBusy(true)
    try { await runResultAction({ operation, result, origin: 'button' }) }
    catch { setError('Não foi possível executar a ação. Ative o JARVIS e tente novamente.') }
    finally { setBusy(false) }
  }
  return <div className="bl-markup p-body research-result">
    <p><strong>{result.query}</strong></p>
    <p>Consulta: {new Date(result.date).toLocaleString('pt-BR')} · {result.provider}</p>
    <div className="research-actions" aria-label="Ações da pesquisa">
      {(['listen', 'stop', 'retry', 'report'] as const).filter((op) => result.actions.includes(op)).map((op) =>
        <button key={op} disabled={busy && op !== 'stop'} onClick={() => void perform(op)}>
          {{ listen: 'Ouvir resumo', stop: 'Parar leitura', retry: 'Pesquisar novamente', report: 'Gerar relatório Word' }[op]}
        </button>)}
      <button aria-pressed={view === 'content'} onClick={() => setView('content')}>Ver conteúdo completo</button>
      <button aria-pressed={view === 'sources'} onClick={() => setView('sources')}>Ver fontes</button>
    </div>
    {busy && <p role="status">Ação em andamento…</p>}
    {error && <p role="alert">{error}</p>}
    {view === 'content' ? <div>{result.content.split(/\n+/).map((text, i) => <p key={i}>{text}</p>)}</div>
      : <ol>{result.sources.map((source, i) => {
        const url = safeSourceUrl(source.url)
        return <li key={i}>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{source.title || url} · Abrir fonte</a> : source.title}
          <p>{source.status} · Publicação: {source.publishedAt ? new Date(source.publishedAt).toLocaleDateString('pt-BR') : 'não informada'}</p>
          {source.media === 'video-metadata' && <p>Metadados de vídeo; sem transcrição ou análise audiovisual.</p>}
        </li>
      })}</ol>}
    {result.artifacts.filter((a, i, all) => all.findIndex(b => (b.artifactId || b.name) === (a.artifactId || a.name)) === i).filter((a) => /^relatorio-[a-f0-9-]+\.docx$/.test(a.name)).map((artifact) =>
      <p key={artifact.name}><a href={`${BRIDGE_HTTP_URL}/reports/${artifact.name}`} download>Baixar relatório Word{artifact.createdAt ? ` · ${new Date(artifact.createdAt).toLocaleString('pt-BR')} · ${(artifact.artifactId || artifact.name).slice(0, 8)}` : ''}</a></p>)}
    <details><summary>Método e limitações</summary>{result.limitations.map((text, i) => <p key={i}>{text}</p>)}</details>
  </div>
}

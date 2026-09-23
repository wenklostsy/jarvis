// Uses the already configured brain; no separate paid service or search key.
export async function summarizeResearch(system, data, signal) {
  const timeout = AbortSignal.timeout(120000)
  const options = { method: 'POST', signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers: { 'Content-Type': 'application/json' } }
  const brain = process.env.JARVIS_BRAIN || 'ollama'
  let url, body
  if (brain === 'gemini') {
    if (!process.env.GEMINI_API_KEY) throw new Error('Gemini sem chave')
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.JARVIS_MODEL || 'gemini-3.5-flash')}:generateContent`
    options.headers['x-goog-api-key'] = process.env.GEMINI_API_KEY
    body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: data }] }] }
  } else if (brain === 'openai') {
    if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI sem chave')
    url = 'https://api.openai.com/v1/responses'
    options.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    body = { model: process.env.JARVIS_MODEL || 'gpt-5.1', instructions: system, input: data, store: false }
  } else {
    url = 'http://127.0.0.1:11434/api/chat'
    body = { model: process.env.JARVIS_LOCAL_MODEL || 'qwen3.5:4b', messages: [{ role: 'system', content: system }, { role: 'user', content: data }], stream: false, think: false, options: { num_ctx: 8192, num_predict: 1200, temperature: 0.2 } }
  }
  const response = await fetch(url, { ...options, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(`Síntese indisponível (${response.status})`)
  const result = await response.json()
  if (brain === 'gemini') return result.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('')
  if (brain === 'openai') return result.output?.flatMap((item) => item.content || []).filter((p) => p.type === 'output_text').map((p) => p.text).join('')
  return result.message?.content
}

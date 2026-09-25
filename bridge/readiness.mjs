import { access, constants } from 'node:fs/promises'
import { REPORT_DIR } from './reports.mjs'
import { safeDirectory } from './security.mjs'
export async function readiness({ request = fetch, env = process.env, directory = REPORT_DIR } = {}) {
  const backend = ['ollama', 'gemini', 'openai'].includes(env.JARVIS_BRAIN) ? env.JARVIS_BRAIN : 'claude'
  const result = { alive: true, backend, inference: 'not_verified', filesystem: 'unavailable', browserVoice: 'browser_check_required' }
  try { await access(await safeDirectory(directory), constants.R_OK | constants.W_OK); result.filesystem = 'ready' } catch { /* No paths or errors exposed. */ }
  if (backend === 'ollama') {
    try {
      const response = await request('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) })
      if (!response.ok) result.inference = 'unavailable'
      else {
        const data = await response.json(), model = env.JARVIS_LOCAL_MODEL || 'qwen3.5:4b'
        result.inference = data.models?.some(m => [m.name, m.model].includes(model)) ? 'model_available_not_warmed' : 'model_missing'
      }
    } catch { result.inference = 'unavailable' }
  }
  return result
}

import { randomBytes, timingSafeEqual, randomUUID, createHmac } from 'node:crypto'
import { realpath, mkdir, readFile, writeFile, lstat } from 'node:fs/promises'
import { relative, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const BIND_HOST = '127.0.0.1'
export const DATA_DIR = fileURLToPath(new URL('../.jarvis/', import.meta.url))
export const MEDIA_DIR = join(DATA_DIR, 'media')
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
export function createSession(env = process.env) {
  const origins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'])
  for (const raw of (env.JARVIS_ALLOWED_ORIGINS || '').split(',').filter(Boolean)) {
    const url = new URL(raw.trim())
    if (!localHosts.has(url.hostname) || url.protocol !== 'http:' || url.origin !== raw.trim()) throw new Error('Origin local exata exigida.')
    origins.add(url.origin)
  }
  const secret = randomBytes(32).toString('hex')
  const name = `jarvis_session_${env.JARVIS_BRIDGE_PORT || 8787}`
  const originAllowed = (origin) => origin ? origins.has(origin) : env.JARVIS_ALLOW_NO_ORIGIN === '1'
  const hostAllowed = (host) => { try { return /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(host) } catch { return false } }
  const valid = (req) => {
    const value = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1) || ''
    return /^[a-f0-9]{64}$/.test(value) && timingSafeEqual(Buffer.from(value), Buffer.from(secret))
  }
  const sign = (path, expires) => createHmac('sha256', secret).update(path + ':' + expires).digest('hex')
  return {
    signImage(path) { const parsed = new URL(path, 'http://localhost'); path = parsed.pathname + '?' + parsed.searchParams.toString(); const expires = String(Date.now() + 60000); return path + '&expires=' + expires + '&signature=' + sign(path, expires) },
    signedImage(req) {
      if (req.method !== 'GET' || !req.url?.startsWith('/img?')) return false
      const url = new URL(req.url, 'http://localhost'), expires = url.searchParams.get('expires'), signature = url.searchParams.get('signature') || ''
      url.searchParams.delete('expires'); url.searchParams.delete('signature')
      const expected = sign(url.pathname + url.search, expires)
      return Number(expires) > Date.now() && /^[a-f0-9]{64}$/.test(signature) && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    },
    originAllowed, hostAllowed, valid,
    bootstrap(req) { return hostAllowed(req.headers.host) && originAllowed(req.headers.origin) && req.headers['x-jarvis-client'] === 'hud' },
    cookie: `${name}=${secret}; HttpOnly; SameSite=Strict; Path=/`,
    authorized(req, websocket = false) {
      if (!hostAllowed(req.headers.host) || !valid(req)) return false
      if (req.headers.origin) return originAllowed(req.headers.origin)
      // Browser image/download navigations omit Origin; require same-site Fetch Metadata.
      return originAllowed(undefined) || (!websocket && req.method === 'GET' && ['same-origin', 'same-site'].includes(req.headers['sec-fetch-site']))
    },
  }
}

export async function authorizedPath(path, roots) {
  if (typeof path !== 'string' || !isAbsolute(path) || path.includes('\0') || path.split(/[\\/]/).includes('..')) throw new Error('Caminho não autorizado.')
  const canonical = await realpath(path)
  for (const root of roots) {
    let base
    try { base = await realpath(root) } catch { continue }
    const rel = relative(base, canonical)
    if (rel && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(rel)) return canonical
  }
  throw new Error('Caminho fora das raízes autorizadas.')
}
export async function safeDirectory(directory) {
  await mkdir(directory, { recursive: true })
  if ((await lstat(directory)).isSymbolicLink()) throw new Error('Diretório simbólico não autorizado.')
  return realpath(directory)
}
export async function installationId(directory = DATA_DIR) {
  const base = await safeDirectory(directory)
  const path = join(base, 'installation.json')
  try {
    if ((await lstat(path)).isSymbolicLink()) throw new Error('Identidade simbólica recusada.')
    const data = JSON.parse(await readFile(path, 'utf8'))
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(data.installationId)) throw new Error('Identidade local inválida.')
    return data.installationId
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    const id = randomUUID()
    try { await writeFile(path, JSON.stringify({ installationId: id }), { flag: 'wx', mode: 0o600 }) }
    catch (error) { if (error.code === 'EEXIST') return installationId(directory); throw error }
    return id
  }
}
export function safeUrl(raw) {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL HTTP/HTTPS sem credenciais exigida.')
  return url.href
}

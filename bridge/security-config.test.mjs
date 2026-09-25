import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadConfigFromFile } from 'vite'

test('Vite excludes frontend credentials by default and loads the explicit legacy opt-in only when requested', async t => {
  const names = ['VITE_ANTHROPIC_API_KEY', 'VITE_NOTION_TOKEN', 'VITE_ALLOW_BROWSER_SECRETS']
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]))
  t.after(() => { for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name] } })
  process.env.VITE_ANTHROPIC_API_KEY = 'security-test-canary-key'
  process.env.VITE_NOTION_TOKEN = 'security-test-canary-token'
  process.env.VITE_ALLOW_BROWSER_SECRETS = '0'
  const { config } = await loadConfigFromFile({ command: 'build', mode: 'production' })
  assert.equal(config.envPrefix, 'JARVIS_PUBLIC_UNUSED_')
  assert.equal(config.define['import.meta.env.VITE_ANTHROPIC_API_KEY'], undefined)
  assert.equal(config.define['import.meta.env.VITE_NOTION_TOKEN'], undefined)
  assert.equal(JSON.stringify(config.define).includes('security-test-canary'), false)
  assert.equal(config.server.host, '127.0.0.1'); assert.equal(config.preview.host, '127.0.0.1')
  assert.equal(config.server.strictPort, true); assert.ok(config.server.proxy['/bridge'].ws)
  process.env.VITE_ALLOW_BROWSER_SECRETS = '1'
  const legacy = await loadConfigFromFile({ command: 'build', mode: 'production' })
  assert.equal(legacy.config.define['import.meta.env.VITE_ANTHROPIC_API_KEY'], JSON.stringify('security-test-canary-key'))
})

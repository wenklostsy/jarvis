import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Same local security policy in dev and preview; load the selected Vite mode.
export default defineConfig(({ mode }) => {
  const loaded = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const browserSecrets = loaded.VITE_ALLOW_BROWSER_SECRETS === '1'
  const publicEnv = Object.fromEntries(Object.entries(loaded).filter(([key]) => key.startsWith('VITE_') && (browserSecrets || !/KEY|TOKEN|SECRET|PASSWORD|MCP_URL|DSN/i.test(key))).map(([key, value]) => ['import.meta.env.' + key, JSON.stringify(value)]))
  const proxy = { '/bridge': { target: 'http://127.0.0.1:' + (loaded.JARVIS_BRIDGE_PORT || 8787), ws: true, headers: { 'x-jarvis-prefix': '/bridge' }, rewrite: (path: string) => path.replace(/^\/bridge/, '') || '/' } }
  return {
    envPrefix: 'JARVIS_PUBLIC_UNUSED_',
    define: publicEnv,
    preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy },
    plugins: [react()],
    server: {
      host: '127.0.0.1', strictPort: true, proxy,
      // Custom PORT requires its exact local origin in JARVIS_ALLOWED_ORIGINS.
      port: Number(process.env.PORT) || 5173,
    },
    optimizeDeps: {
      // kokoro-js pulls in `phonemizer`, which carries espeak-ng as inline WASM.
      // Vite's dependency pre-bundler rewrites that initialisation and the
      // language table ends up empty — the symptom is
      // `Invalid language identifier: "en". Should be one of: .` at generate()
      // time, long after the model has loaded successfully. Serving these
      // untouched fixes it.
      exclude: ['kokoro-js', 'phonemizer', '@huggingface/transformers'],
    },
  }
})

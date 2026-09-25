# Etapa 1C — segurança local

## Auditoria direcionada, anterior à implementação

| Superfície | Entrada / efeito | Risco | Proteção anterior | Correção necessária |
|---|---|---|---|---|
| HTTP / WebSocket :8787 | Pedidos e ferramentas | Controle local indevido | Origin no WS; bind sem host | Loopback, origins exatas, sessão efêmera |
| /health e diagnóstico WS | Estado / configuração | Divulgação e falso readiness | Campos selecionados; chave confundida com disponibilidade | Separar liveness, configuração e verificação |
| /file GET | Caminho / leitura de imagem | Traversal e leitura privada | realpath, extensão, tamanho; home e temporários amplos | Raízes explícitas pequenas |
| /reports GET e DOCX | Nome / leitura e escrita | Symlink inesperado | UUID, criação exclusiva | Canonicalização e recusa de links |
| /img, /media, /page GET | URL / tráfego remoto | SSRF | DNS validado na conexão, redirects, limites | Preservar, recusar credenciais na URL |
| /tts e /stt POST | Texto/áudio / API opcional | Abuso, erro contendo dados | Limites de entrada | Sessão, deadline, erro resumido |
| Comandos Windows | Frase / abertura de app e URL | Shell e esquemas perigosos | Parser e apps conhecidos, spawn sem shell | Política central; validar novamente no executor |
| Claude / MCP | Tool e parâmetros / efeitos diversos | Autorização inferida do nome | Verbos, servidores inteiros e ALLOW_WRITES | Lista explícita; hook anterior à execução; desconhecidos recusados |
| Configuração | env, MCP / credenciais | Segredos no bundle e logs | .env ignorado; variáveis VITE públicas | Inventário só nomes, opt-in explícito para modo legado |
| Logs / erros | Falhas de provedores | Dados e stack privados | Logging disperso | Redaction e mensagens públicas fixas |
| Instalação | Estado local | Mistura futura de dispositivos | Sem identidade persistente | UUID local sem dados pessoais |

Implementação, resultados e limitações serão registrados após a validação.


## Implementação e resultado — 25/09/2026

A fundação local da Etapa 1C foi implementada sem trocar React/Vite/Three.js/Zustand/Node ou os adaptadores de IA. A auditoria acima precedeu as alterações. A política mudou de permissões inferidas por nome para capacidades conhecidas, com recusa explícita para operações ainda sem contrato seguro.

### Correções realizadas

- HTTP/WS em 127.0.0.1; origins exatas locais e Host validado; no-origin apenas opt-in. Vite e preview também usam loopback e strictPort.
- Sessão efêmera de 256 bits por execução, cookie HttpOnly/SameSite=Strict, bootstrap com header próprio e Origin, frontend através de /bridge. Endpoint /live mínimo; demais capacidades autenticadas. Frames WS limitados.
- Política central READ, LOCAL_REVERSIBLE, LOCAL_EFFECT, EXTERNAL_EFFECT e DESTRUCTIVE. Windows mantém parser/allowlists; URLs validadas novamente no executor. Settings só usa a lista fixa existente.
- Infraestrutura de confirmação controlada pela aplicação: UUID, hash de parâmetros, resumo contextual, expiração, vínculo à conexão, invalidação por cancelamento/reconexão, execução única por ID. Voz e botões resolvem a mesma pendência. Nenhuma operação externa/destrutiva real foi criada para demonstrar isso; testes usam memória.
- Hook PreToolUse obrigatório no Claude; builtins de shell/disco irrestrito e MCP desconhecidos ficam bloqueados. A flag antiga ALLOW_WRITES nunca substitui autorização. Ollama, Gemini e OpenAI mantêm seus fluxos existentes.
- Arquivos: realpath, rejeição de traversal e escape por symlink, raiz de imagens .jarvis/media e extras explícitos, reports com UUID/criação exclusiva e diretório validado. Diretórios home/temp deixaram de ser implicitamente acessíveis.
- Proxies mantêm DNS validado na conexão, limites, timeouts e revalidação de redirects. URLs com credenciais e IPv6 de tradução/túnel são recusadas. Artigos têm sandbox/CSP e capacidades de imagem assinadas restritas, para não depender de cookie dentro do iframe opaco.
- TTS/STT: sessão, timeout de 30 segundos, erro público resumido; TTS limita saída em 25 MiB e respeita contrapressão.
- Redaction central e logs com metadados; respostas brutas dos provedores não são ecoadas ao cliente. .env real não foi alterado; .env.example tem somente valores públicos/entradas vazias. Secrets VITE são omitidos por padrão; modo direto legado exige opt-in explícito para expô-los.
- /readiness verifica filesystem e presença real do modelo no Ollama; providers pagos ficam não verificados. /health preserva flags de configuração de voz para compatibilidade, sem afirmar disponibilidade. installationId UUID local, persistente, não secreto em .jarvis/installation.json.

### Parte não liberada e proposta sujeita a aprovação

Ferramentas MCP externas e ações genéricas de clique/digitação não recebem autorização automática. O efeito de um clique depende do site, destino e estado da página; um hash dos parâmetros não basta para consentimento informado. Para liberar esses caminhos com segurança, proponho uma etapa específica de adaptadores com descrição contextual verificável de efeito/alvo, testes e confirmação central. Essa ampliação fica sujeita à aprovação de Matheus. A implementação perigosa foi bloqueada; os servidores e credenciais não foram removidos. Não houve novo MCP ou integração externa.

Não foram feitas migração ao Windows Credential Manager, isolamento de processos contra malware, deployment remoto, persistência de idempotência externa ou correção automática de dependências. A interface futura de SecretProvider e limites estão em SECURITY.md. Mudanças estruturais permanecem propostas.

### Auditoria de dependências — somente leitura

Comando: npm audit --json. O primeiro acesso dentro do sandbox falhou; a repetição autorizada em modo somente leitura concluiu. Resultado: **8 pacotes sinalizados, 5 altos, 3 moderados, 0 críticos**. O exit code 1 indica vulnerabilidades, não falha da consulta final. Nenhuma versão, package.json ou lockfile foi alterada. Evidência completa em AUDIT_NPM_1C.json; caminhos conferidos com npm explain.

| Pacote | Severidade | Caminho | Alcançabilidade provável | Correção informada pelo npm / risco |
|---|---|---|---|---|
| dompurify | Moderada | dependência direta do frontend | Sanitização é usada; advisory envolve IN_PLACE, não utilizado aqui | Disponível; priorizar patch e regressão de HTML/HUD |
| fast-uri | Alta | SDK MCP → ajv → fast-uri | Validação de schemas MCP; proxy JARVIS usa node:http/net.mjs, não fast-uri | Disponível; validar contratos SDK/MCP |
| hono | Moderada | SDK MCP / @hono/node-server → hono | Caminhos HTTP opcionais MCP; bridge principal usa node:http | Disponível; testar adaptadores, sem concluir ausência de risco |
| qs | Moderada | SDK MCP → express/body-parser → qs | Parsers HTTP opcionais MCP; endpoints próprios não usam qs | Disponível; regressão de parsing |
| nanoid | Alta | docx → nanoid 5.x | Geração Word presente; advisory envolve geradores customizados com tamanho zero | Disponível; testar integridade DOCX e IDs; nanoid 3.x do PostCSS não foi o nó sinalizado |
| sharp | Alta | kokoro-js → @huggingface/transformers → sharp | Caminho nativo de imagens/libvips; Kokoro browser é opcional e não é o backend principal | npm não apresenta fix automático; avaliar cadeia e compatibilidade |
| @huggingface/transformers | Alta | kokoro-js → transformers → sharp | Alerta herdado de sharp, não uma nova falha direta no bridge | Sem fix automático informado; risco maior de regressão WASM/modelos |
| kokoro-js | Alta | direto → transformers → sharp | Cadeia opcional preservada; engine padrão usa voz do sistema | Sem fix automático informado; decisão futura sobre versão/uso |

Alcançabilidade é avaliação do código atual, não prova de exploração nem dispensa de atualização. Revisão futura deve começar por atualizações compatíveis em branch isolada, sem audit fix --force.

### Verificações realizadas

- **84 testes aprovados, 0 falhas, 0 skips**: os 55 anteriores foram preservados, com adaptações dos mocks de fronteira para bootstrap assíncrono/confirmVoice; assertions existentes mantidas. Mais 29 testes/casos cobrem segurança.
- node --test bridge/*.test.mjs: inclui execução de bridge real em porta temporária, HTTP negado/permitido, bootstrap/cookie e handshake WS, seguido de comando local real de data/hora sem efeitos no Windows.
- Confirmações: expiração, parâmetros trocados, texto do modelo, outra conexão, duplicação UI/voz e único efeito simulado. Frontend real transpilado exercita voz/mesma pendência e rejeição de frame de socket antigo.
- Arquivos normais/traversal/absolutos/junction para fora da raiz, UUID persistente, HTTP/HTTPS/esquemas perigosos, SSRF/IPs privados e redirect proibido, redaction, readiness e configuração Vite sem canários secretos. Teste de junction foi executado nesta máquina sem skip.
- **npm run build aprovado**; aviso existente de chunks maiores que 500 kB permanece.
- **npm run lint aprovado, zero erros**; um aviso anterior em bridge/chrome.mjs (catch não usado) permanece.
- **git diff --check aprovado**.
- Navegador real abriu o HUD por Vite na porta temporária 5178 e iniciou a sequência de boot, sem erro de rede/autenticação observado no console. O boot permaneceu na ativação de voz; não foi aceito novo acesso ao microfone nem concluída validação falada. O servidor temporário foi encerrado automaticamente. A integração autenticada completa foi validada pelo teste HTTP/WS, não por uma sessão falada.

### Validação manual necessária

1. Reiniciar o JARVIS com npm start e recarregar a página; processo antigo não recebe as novas proteções por edição de arquivo.
2. Confirmar microfone/TTS/STT/barge-in no navegador habitual; testar “Abra o WhatsApp”, hora, pesquisa YouTube e fontes.
3. Selecionar pesquisa A, criar B, voltar a A e exportar Word; abrir o DOCX no Word e conferir conteúdo/fontes. Tests verificam arquivo, correlação e idempotência; não substituem inspeção visual no Word.
4. Testar imagens/vídeos/página em iframe e download autenticado; se uma ferramenta salvar imagens em outra pasta, autorizar apenas essa pasta, nunca home/disco inteiro.
5. Para providers pagos, testar apenas quando desejar usar suas credenciais/cotas. A presença de configuração não foi tratada como prova de disponibilidade.
6. Antes de habilitar MCP externo, aprovar adaptador contextual; não usar ALLOW_WRITES/no-origin como solução genérica.

### Riscos remanescentes e escopo

A sessão reduz a superfície web, mas processos do próprio usuário podem falsificar cabeçalhos. Cookies não isolam aplicações locais no mesmo hostname. Há risco residual de XSS/CSP legado, dependências vulneráveis, corrida de filesystem por adversário local e efeitos externos sem idempotência persistente. Capacidade de imagem de iframe expira em 60s; recargas tardias podem exigir reabrir o painel. Credenciais no .env continuam dependentes das permissões/backup do Windows; modo direto opt-in continua expondo chaves ao browser. Ver SECURITY.md para detalhes.

**Universal Tool Registry, Memory, Projects, Legacy e novas integrações externas NÃO foram iniciados.** Não houve commit, push, pull, reset, instalação de dependências, migração de credenciais ou publicação.


### Arquivos desta entrega

- .env.example
- .gitignore
- bridge/claude-lifecycle.test.mjs
- bridge/diagnostics.mjs
- bridge/frontend.test.mjs
- bridge/gemini.mjs
- bridge/local-commands.mjs
- bridge/net.mjs
- bridge/ollama.mjs
- bridge/openai.mjs
- bridge/page.mjs
- bridge/panels.mjs
- bridge/permissions.mjs
- bridge/readiness.mjs
- bridge/reports.mjs
- bridge/research.mjs
- bridge/safe-log.mjs
- bridge/security-config.test.mjs
- bridge/security-http.test.mjs
- bridge/security.mjs
- bridge/security.test.mjs
- bridge/server.mjs
- bridge/tts.test.mjs
- docs/AUDIT_NPM_1C.json
- docs/ESTADO_ATUAL.md
- docs/ETAPA_1C.md
- docs/ROADMAP.md
- docs/SECURITY.md
- index.html
- src/App.tsx
- src/config.ts
- src/lib/bridge-session.ts
- src/lib/bridge.ts
- src/lib/capabilities.ts
- src/lib/kokoro.ts
- src/lib/tts.ts
- src/lib/voice.ts
- src/scene/Orbits.tsx
- src/ui/Confirmation.tsx
- src/ui/Panels.tsx
- vite.config.ts

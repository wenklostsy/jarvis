# Segurança local do JARVIS — Etapa 1C

## Modelo de ameaça

As barreiras reduzem acesso por páginas web não autorizadas, exposição acidental na LAN, traversal, SSRF, URLs perigosas, execução não autorizada, vazamentos acidentais e duplicação de efeitos. **Não isolam malware executando como o usuário, administrador, Windows comprometido ou acesso físico com suas credenciais.** Um processo local pode falsificar Origin/Host e estabelecer a sessão. Aplicações locais na mesma origem e extensões privilegiadas também pertencem à fronteira de confiança.

## Rede e sessão

Bridge: `127.0.0.1:8787`, sem opção de bind remoto. Vite: `127.0.0.1:5173`; preview: `127.0.0.1:4173`; portas estritas, sem fallback silencioso. `PORT` personalizado com `npm start` registra origins exatas correspondentes. Execuções separadas devem configurar `JARVIS_ALLOWED_ORIGINS`. Defaults: HTTP localhost/127.0.0.1 somente 5173/4173. Origin remota, wildcard, caminho ou barra final são recusados. Não usar `--host 0.0.0.0`.

Frontend usa `/bridge` com proxy HTTP/WS no Vite e preview. `POST /session` exige Host local, Origin permitido e header `x-jarvis-client: hud`; preflight bloqueia origens estranhas. Entrega cookie HttpOnly, SameSite=Strict, sem Domain, Path=/, com 256 bits aleatórios novos por execução. Não há segredo em HTML estático, código, logs ou prompts. HTTP local não usa Secure: isso NÃO é um mecanismo para internet. Cookies não isolam portas no mesmo hostname; instâncias em portas de bridge diferentes usam nomes diferentes. Reiniciar invalida cookies antigos; reconectar faz novo bootstrap.

Endpoints de capacidade exigem sessão. `/live` é leitura pública mínima (`alive`). `/health` conserva `tts/stt` para o seletor de voz, explicitamente como **configurado, não verificado**. `/readiness` autenticado verifica filesystem e modelos instalados no Ollama com deadline de dois segundos; presença do modelo não garante inferência aquecida. APIs pagas ficam `not_verified`; voz depende do navegador. Diagnóstico WS diferencia alcance do Ollama e modelo configurado, sem certificar inferência.

WS exige cookie, Host, Origin e caminho `/` ou `/ws`; limite de frame 2 MiB. Ausência de Origin é recusada, exceto `JARVIS_ALLOW_NO_ORIGIN=1`, que **não dispensa cookie**. GET de mídia/download pode omitir Origin se carregar cookie e Fetch Metadata same-origin/same-site. Não habilitar no-origin para corrigir configuração do navegador.

Artigos em iframe têm CSP e sandbox sem same-origin. Suas imagens recebem capacidade HMAC restrita ao caminho `/img` e parâmetros exatos, válida por 60 segundos, permitindo imagens no iframe opaco sem expor a sessão. Não é autorização genérica. Links assinados não devem ir a logs e expiram se recarregados muito depois. Demais recursos do HUD usam cookie. Para URL de bridge explícita legada, use o mesmo hostname do frontend e portas compatíveis com a CSP; o proxy padrão evita esses problemas.

## Permissões e confirmação

`bridge/permissions.mjs` é uma tabela pequena, não um Universal Tool Registry.

| Classe | Regra e capacidades existentes |
|---|---|
| READ | Pesquisa, fontes, diagnóstico, data/hora, leituras conhecidas do navegador/câmera com permissão do browser |
| LOCAL_REVERSIBLE | HUD, leitura, timers e cancelamento |
| LOCAL_EFFECT | Apps/pastas/settings conhecidos, URL HTTP/HTTPS, relatório local, navegação/abas conhecidas |
| EXTERNAL_EFFECT | Exige confirmação contextual; cliques, digitação e formulários genéricos permanecem bloqueados |
| DESTRUCTIVE | Confirmação contextual obrigatória; nenhuma ferramenta destrutiva nova |

Parser Windows mantém allowlists e spawn sem shell. `ms-settings:` é exceção exclusivamente para os destinos fixos existentes; conteúdo arbitrário só pode abrir HTTP/HTTPS sem credenciais. Não há fallback cmd/PowerShell/exec/eval. Pesquisa/relatório passam pela política e validadores existentes. Claude mantém backend, SDK e MCP, mas `PreToolUse` aplica a tabela antes de executar, mesmo se o classificador do SDK achar a operação segura. Builtins de shell, agentes delegados e disco indiscriminado não são oferecidos. Não se infere segurança por verbos ou servidor inteiro. `JARVIS_ALLOW_WRITES=1` não contorna o hook.

Ferramentas MCP externas desconhecidas não têm autorização automática. **Parte pendente de aprovação:** adaptadores com esquema de efeito, destinatário/alvo e parâmetros revisáveis para cada integração. Liberar servidor inteiro ou confirmar genericamente “clicar” pode autorizar envio/exclusão sem informar o usuário; não foi feito. Configurações e credenciais dos servidores permanecem intactas.

Infraestrutura: `createConfirmations().execute()` captura parâmetros, vincula hash SHA-256, operação e UUID à conexão, mantém pending/confirmed/rejected/expired, expira em 30 segundos e invalida ao fechar/abortar. Uma pendência por conexão; replay do mesmo ID usa a mesma Promise/resultado, parâmetros diferentes são recusados. Limite de 1000 IDs por conexão, sem descarte que permita replay. Efeito recebe a cópia aprovada. Clique e voz (`sim`, `confirmo`, `sim pode continuar`; cancelamento equivalente) enviam `confirmation_response` para a mesma pendência. Conteúdo do modelo não é autorização. Interface contém Confirmar/Cancelar sem redesenhar HUD. Nenhuma ferramenta sensível real foi adicionada; testes usam contador em memória. Futuras integrações devem fornecer resumo contextual confiável e chamar `execute`, nunca montar autorização a partir de texto do modelo. Não há garantia exactly-once entre reinícios para APIs externas: exige idempotency key do provedor/persistência.

## Arquivos e URLs

`/file`: caminho absoluto sem segmento `..`/NUL, realpath do alvo/raiz, contenção via relative, apenas raster conhecido e até 25 MiB. Raiz padrão `.jarvis/media`; extras em `JARVIS_FILE_ROOTS`, separados por vírgula. Home e temp deixaram de ser implícitos. Ferramentas que salvam screenshots fora das raízes exigem pasta explícita aprovada pelo operador.

`/reports`: nome UUID fixo `.docx`, root `reports/`, canonicalização na leitura e recusa de diretório simbólico. Escrita DOCX usa diretório validado, UUID e `wx`, sem sobrescrever. Links no DOCX são HTTP/HTTPS. Junctions/symlinks escapando da raiz são recusados. Raízes declaradas são confiadas ao operador; não há garantia contra corrida de troca de ancestrais por malware do mesmo usuário entre validação e abertura (TOCTOU).

Proxies `/img`, `/media`, `/page` conservam validação DNS na conexão, recusam nomes locais e IPs loopback/privados/link-local/mapeados, quatro redirects revalidados, apenas HTTP/HTTPS e sem credenciais na URL. Imagem 15 MiB/10s; mídia 200 MiB/30s; página 2 MiB/12s. Tempos são deadline de cabeçalhos e timeout por inatividade: mídia com progresso contínuo pode levar mais tempo. Não se promete limite absoluto total. Authorization/cookies do usuário não são encaminhados aos sites. Artigos live podem carregar recursos públicos diretamente conforme CSP legada, sem acesso à sessão. TTS/STT têm deadline de 30s; entrada texto 64 KiB, áudio 25 MiB, saída TTS 25 MiB. Cancelamento e IDs das etapas anteriores preservados.

## Secrets e configuração

Inventário só nomes: `.env` atual contém `JARVIS_BRAIN`, `JARVIS_MODEL`, `JARVIS_LOCAL_MODEL`, `GEMINI_API_KEY`, `OPENAI_API_KEY`. `.env.local` não encontrado no diretório principal na auditoria. Nenhum valor foi publicado, movido ou apagado. `npm start`/bridge carregam `.env`; Vite também lê `.env.local`. Node não carrega `.env.local` automaticamente.

Outros nomes suportados: `ELEVENLABS_API_KEY`; `VITE_ANTHROPIC_API_KEY`, `VITE_ELEVENLABS_API_KEY`, `VITE_PICOVOICE_ACCESS_KEY`, `VITE_ZAPIER_MCP_URL`, `VITE_PIPEDREAM_MCP_URL`, `VITE_NOTION_TOKEN`, `VITE_LINEAR_TOKEN`, `VITE_GITHUB_TOKEN`, `VITE_STRIPE_TOKEN`, `VITE_SENTRY_TOKEN`, `VITE_HOMEASSISTANT_MCP_URL`, `VITE_HOMEASSISTANT_TOKEN`. MCP legado lê `~/.claude.json`, mapas `mcpServers` e `projects[homedir].mcpServers`, incluindo `env.ELEVENLABS_API_KEY`. O arquivo ~/.claude.json não foi encontrado nesta instalação na verificação; o suporte permanece opcional e nenhum arquivo de configuração MCP foi alterado. Configurações de terceiros podem conter outros nomes de secrets não enumerados por valor. Base Python separada documenta `SUPABASE_URL` e `SUPABASE_KEY`; nenhuma conexão/persistência Supabase foi criada.

Build bloqueia variáveis sensíveis por padrão. `VITE_ALLOW_BROWSER_SECRETS=1` é opt-in para o modo direto legado e serviços/Porcupine diretamente no browser: **qualquer chave assim exposta é legível no navegador/bundle**. Não habilitar ao compartilhar/publicar. Preferir providers no bridge. `.env`, `*.local`, `.jarvis` e relatórios são ignorados pelo Git. Isso não é criptografia nem remove secrets eventualmente existentes no histórico.

Interface futura proposta, sem migração: `SecretProvider.get(name): Promise<string | undefined>`, `has(name): Promise<boolean>`, `source(): 'environment' | 'windows-credential-manager'`. Consumidores pedem nomes permitidos; nunca enumeram/exportam valores. Primeiro environment, depois Credential Manager por instalação. Segredo de sessão continua efêmero. Dependência nativa e migração exigirão etapa aprovada.

## Logs, instalação e execução

`safeLog` permite metadados selecionados; `redact` filtra campos de chave/token/header/cookie/prompt/transcrição/conteúdo/stack, URLs e valores de secrets conhecidos do ambiente. Erros HTTP/provedores/pesquisa enviados ao frontend são resumidos, sem eco de resposta bruta. Logs de ferramentas conhecidas não incluem parâmetros. Redaction é defesa adicional, não licença para registrar documentos/prompts; credenciais MCP desconhecidas nunca devem chegar aos logs. Trace completo não vai ao cliente.

`installationId`: UUID em `.jarvis/installation.json`, sem nome/email/serial/hardware, não secreto e não enviado automaticamente a terceiros. Para regenerar deliberadamente: pare o bridge, faça backup e renomeie o arquivo, depois inicie. Arquivo inválido/link não é sobrescrito silenciosamente. Permissões Windows herdadas e OneDrive podem sincronizar a pasta: `.gitignore` não impede OneDrive. UUID não concede acesso.

Dev e preview usam a mesma política, sem modo permissivo. `vite preview` confere o build local; não é deployment público. Distribuir `dist` sozinho exige servidor local equivalente para proxy/sessão; remoto fora do escopo. CSP mantém concessões legadas WASM/Vite, `unsafe-inline`/`unsafe-eval` e provedores opcionais; não elimina todo risco XSS. Dependências vulneráveis e MCP opcionais requerem acompanhamento.

Consulte [auditoria npm](AUDIT_NPM_1C.json) e [entrega/testes](ETAPA_1C.md). Universal Tool Registry, Memory, Projects, Legacy e novas integrações não foram iniciados.

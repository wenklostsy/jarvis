# Etapa 1A — execução e diagnóstico

Implementada em 23/09/2026 por solicitação de Matheus Ribeiro. A Etapa 1B não foi iniciada.

## Resultado

O bridge mantém a arquitetura existente e passa a controlar pedidos por conexão, com ID, fila serial, cancelamento, limite de execução e descarte de eventos tardios. Ollama continua sendo o backend principal configurado. Os adaptadores preservam seus prompts, formatos de API e históricos.

`brain.ts` e `store.ts` foram examinados e mantidos: o primeiro já delega cancelamento ao transporte correto; o segundo continua cuidando do estado visual. Os novos diagnósticos usam o mecanismo de leitura periódica do painel existente, sem duplicar o estado da conversa no Zustand.

## Ciclo de vida e protocolo

Os eventos anteriores `ready`, `text`, `tool`, `done`, `error`, `panel`, `blade`, `ui`, `capture` e `timer` continuam disponíveis. Foram acrescentados `request`, `progress` e `diagnostics`.

| Estado | Significado |
| --- | --- |
| `queued` | Solicitação recebida e aguardando execução |
| `running` | Solicitação em processamento |
| `started` | Execução do comando local iniciada |
| `effect_unconfirmed` | Lançador acionado; janela/página final não foi observada |
| `completed` | Processamento concluído; não implica confirmação de efeito externo |
| `failed` | Falha identificada na operação |
| `cancelled` | Pedido invalidado; resultados posteriores não serão apresentados |

Pedidos conservam o ID enviado pelo cliente; clientes sem ID recebem um identificador interno. Um ID aceito não é executado novamente na mesma conexão. Eventos vinculados a um pedido carregam `ask`. Timers já criados continuam sendo notificações da conexão e não são confundidos com a resposta atual.

O novo servidor anuncia `protocol: 2` no diagnóstico. Nesse modo, o frontend recusa eventos de turno sem ID ou com ID diferente do pedido ativo. Servidores antigos continuam aceitos no modo compatível, mas sem a garantia completa de correlação; aparecem sem identificação. Reconexões descartam eventos do socket anterior. A corrida entre dois pedidos durante a conexão inicial também foi corrigida.

O servidor emite progresso a cada dez segundos enquanto trabalha, com prazo total de três minutos por pedido em execução. O cliente renova o prazo de inatividade apenas com eventos do seu pedido e solicita cancelamento quando esse prazo termina.

## Cancelamento

`interrupt` sem ID invalida todos os pedidos atuais daquela conexão; com `ask` ou `id`, invalida somente o pedido indicado. Novos pedidos posteriores permanecem válidos.

- Pedidos pendentes cancelados são descartados antes de chamar o executor.
- Operações em andamento recebem `AbortSignal`; chamadas aos modelos e requisições HTTP de pesquisa usam esse sinal.
- O contexto assíncrono conserva o ID original e bloqueia publicações após cancelamento ou conclusão.
- Fechar a conexão invalida os pedidos, fecha a pesquisa e limpa os timers locais.
- Exceções não deixam a fila permanentemente rejeitada. Operações que ignoram o sinal deixam de bloquear os adaptadores HTTP, mas seus efeitos já iniciados podem continuar.
- Claude utiliza o mesmo controle, mas aguarda a fronteira `result` do SDK antes do próximo pedido. Se o SDK não confirmar a interrupção em cinco segundos, a conexão é encerrada e o frontend pode reconectar. Pedidos não são reenviados automaticamente, evitando repetição de efeitos.

Cancelamento não é rollback. Não fecha aplicativos já iniciados, não retira requisições já recebidas por terceiros e não apaga um DOCX cuja gravação começou antes do cancelamento. Nesse último caso, o arquivo pode permanecer em disco, mas sua resposta tardia não é publicada. Timers concluídos anteriormente devem ser cancelados pelos comandos próprios ou pelo fechamento da conexão.

## Windows

Os destinos permitidos e lançadores foram preservados. Em vez de interpretar o evento `spawn` como abertura confirmada, a resposta informa: “Comando enviado para abrir ... A abertura não foi confirmada.” O diagnóstico distingue despacho iniciado, efeito não confirmado e falha. Um aplicativo desconhecido não é executado nem convertido em shell arbitrário.

## Diagnóstico

Pressione **D** no dashboard. O painel mostra backend, modelo, disponibilidade HTTP do Ollama, WebSocket, hash do código do bridge carregado, identificação da instância, início do processo, estado/ID do pedido e último erro resumido. Compara o código em disco com o carregado e recomenda reinício se houver diferença. Essa comparação cobre arquivos `.mjs` do bridge, não alterações de `.env`, dependências ou frontend.

A disponibilidade do Ollama indica resposta de `/api/tags`, não que o modelo esteja carregado ou que uma geração tenha funcionado. As APIs de voz e os contadores existentes distinguem presença da API e atividade observada; presença não comprova permissão de microfone ou som audível.

O painel não mostra chaves, prompts ou transcrições. Erros nele são resumidos. A consulta de disponibilidade tem prazo de dois segundos e é atualizada na conexão e, enquanto o painel estiver aberto, a cada cinco segundos. O painel conserva o estilo e permite rolagem.

## Arquivos envolvidos

| Arquivos | Alteração |
| --- | --- |
| `bridge/requests.mjs` | Controle comum, pequeno e testado de ciclo de vida; não é um registro geral de ferramentas |
| `bridge/ollama.mjs`, `gemini.mjs`, `openai.mjs` | Uso do controle e do contexto antes dos comandos locais |
| `bridge/server.mjs` | Ciclo Claude, correlação dos eventos visuais/câmera e diagnóstico |
| `bridge/local-commands.mjs` | Contexto de cancelamento e respostas honestas sobre lançamentos |
| `bridge/research.mjs`, `net.mjs` | Propagação do sinal, bloqueio de saída tardia e atualização da última pesquisa somente após sucesso |
| `bridge/diagnostics.mjs` | Identidade da instância, comparação de código e consulta limitada ao Ollama local |
| `src/lib/bridge.ts` | Correlação, isolamento de sockets, propriedade do pedido durante conexão e diagnóstico |
| `src/ui/Diagnostics.tsx`, `src/index.css` | Novas informações, remoção de texto reconhecido e rolagem |
| Testes e documentação | Cobertura dos cenários solicitados e registro dos limites |

## Validação

Comando da suíte completa:

```powershell
node --test bridge/local-commands.test.mjs bridge/research.test.mjs bridge/requests.test.mjs bridge/frontend.test.mjs bridge/claude-lifecycle.test.mjs
npm run build
npm run lint
```

Resultado final: **28 testes passaram, zero falhas**. Inclui WhatsApp, VS Code, Bloco de Notas, aplicativo desconhecido, YouTube sem assunto, esclarecimento, fila, cancelamento pendente/ativo, fechamento, falha seguida de sucesso, duplicação de ID, saída tardia, prazo limite, reconexão, diagnóstico, pesquisa e estrutura editável do Word.

Os novos cenários usam sockets/SDKs/modelos/lançadores simulados. O teste do cliente transpila o arquivo TypeScript real com a dependência TypeScript já instalada. O teste Claude executa o handler real do servidor com fronteiras substituídas; não autentica no SDK externo. O teste preexistente de DOCX gera e remove somente seu documento temporário.

TypeScript/Vite passaram. Lint: zero erros e os dois avisos preexistentes em `chrome.mjs` (`err`) e `server.mjs` (`probeUrl`). `git diff --check` não apontou erros. Permanecem os avisos anteriores de bundles grandes e módulos Node externalizados pelo SDK Anthropic.

Não foram validados microfone, áudio real, abertura efetiva de janelas, qualidade de respostas de modelos reais ou credenciais de serviços externos. Não houve instalação, alteração de credenciais, banco, remoto Git, commit ou publicação. A instância de uso do usuário não foi reiniciada.

## Ativação e próximos passos

Para usar o código atualizado, encerre normalmente a instância anterior do JARVIS e execute `npm start` na pasta `jarvis-chatgpt`; atualize a página e abra D. Servidor antigo sem este recurso aparecerá sem identificação. Confirme backend/modelo e faça a validação manual dos três comandos Windows e da voz.

A03, A07 e A09 receberam correções com cobertura automatizada; A08 também recebeu propagação do sinal de rede como parte necessária do cancelamento. A validação no ambiente real permanece pendente. A política geral de permissões, distribuição/rede, dependências, memória e demais módulos não foram ampliados.

A Etapa 1B deve avaliar relevância dos resultados, fontes/citações, bloqueios dos buscadores e apresentação visual dos relatórios. Pode aproveitar IDs, sinais e progresso implementados aqui. Sua implementação e refatorações estruturais mais amplas dependem de nova aprovação.

# Hotfix 1B.1 — contexto e integridade dos relatórios

Implementado em 24/09/2026 no Jarvis web, preservando React/Vite/Three.js/Zustand e bridge Node. Etapa 1C não iniciada.

## Causa e evidência

A lista completa relatada pelo usuário estava literalmente na constante `SYSTEM` de `bridge/ollama.mjs`, linha 6 antes do hotfix. `ollamaConnection.answer` enviava essa constante em TODA geração conversacional. Além de apresentar os seis exemplos, o prompt instruía o modelo a sugeri-los quando o parser não reconhecesse um pedido. Portanto, energia solar, aulas de violão e example.com chegavam ao modelo em produção. O código comprova esse caminho; não existe captura do payload da sessão original que permita reconstruir cada decisão do modelo.

Pedidos de relatório fora da gramática podiam cair no chat livre. Uma frase de sucesso produzida pelo modelo não acionava `reports.mjs`, mas era exibida como resposta normal. O histórico do Ollama também armazenava respostas de comandos locais como `assistant`, incluindo ajuda com exemplo, resumos e avisos de relatório. Isso misturava saída operacional e conversa.

O inventário anterior à correção, com arquivo, linha e classificação de cada ocorrência, está em [ORIGENS_1B_1.md](ORIGENS_1B_1.md). Testes, fixtures, documentação e sugestões visuais não foram apagados nem tratados como conteúdo proibido.

## Auditoria do contexto

| Caminho | Antes / resultado da auditoria | Agora |
| --- | --- | --- |
| Ollama system | Instruções + seis exemplos executáveis | Instruções sem exemplos, em `conversation-context.mjs` |
| Ollama user | Pedido real atual e pedidos anteriores | Preservados; limite de 20 mensagens |
| Ollama assistant | Chat e toda resposta de comando local | Somente respostas conversacionais reais |
| Contexto de pesquisa | Resumo operacional perdido no histórico misturado | Objeto separado: researchId, assunto, conteúdo e fontes da pesquisa confirmada, rotulado como dados externos |
| Ajuda, progresso, diagnóstico | Ajuda podia entrar como assistant; progresso/diagnóstico não entravam | Ajuda continua disponível na UI; saída operacional não é promovida a assistant; diagnóstico continua fora do prompt |
| Gemini | `systemInstruction` sem essa lista; histórico de user/model somente no caminho conversacional | Preservado; usa correções compartilhadas de pesquisa/parser |
| OpenAI | `instructions` recebido do servidor; histórico user/assistant somente no caminho conversacional | Preservado; usa correções compartilhadas |
| `research-model.mjs` | Síntese independente, instrução própria + JSON de assunto/fontes atuais; sem histórico do chat | Preservado |
| `research-quality.mjs` | Relevância, citações, resumo falável; sem lista de exemplos | Preservado |
| `requests.mjs` | IDs, fila, cancelamento, bloqueio de eventos tardios e pedidos repetidos | Preservado; contexto antes omitido em um caminho de busca local agora é propagado |

O histórico não foi eliminado: perguntas como “Quando a dupla foi formada?” recebem os dados confirmados de Rick e Renner, além das mensagens reais anteriores. A pesquisa seguinte substitui o contexto de ferramenta anterior; exportar uma pesquisa selecionada torna aquele resultado o contexto confirmado atual. Nenhuma conversa é entrada do gerador Word. Não há blacklist de termos nem limpeza textual da resposta para esconder exemplos.

## Pesquisa → Word

1. `App.respond` resolve comandos de relatório “dessa pesquisa” com a regra existente: pesquisa focada; na ausência, a última pesquisa nos painéis atuais. Envia seu `researchId` explícito e origem `voice`; o botão envia o ID do próprio painel e origem `button`.
2. O backend procura esse ID no mapa da conexão. ID ausente/expirado exige esclarecimento ou nova pesquisa. Foi removido o fallback silencioso para `latest` no servidor.
3. Cada nova pesquisa guarda `requestId`, `id` (researchId), query, fontes, summary (conteúdo completo), spokenSummary, limitações e artefatos.
4. `research.action` exporta o objeto selecionado, sem nova busca e sem nova síntese. `writeReport` exige pesquisa estruturada e ID da operação, recebe seus dados explicitamente e aguarda `writeFile` exclusivo concluir.
5. O retorno inclui artifactId, name (filename), researchId, actionRequestId e createdAt. O registro do painel conserva esses campos. Estados de diagnóstico: requested → generating → created → available, ou failed; o registro ocorre entre created e available.
6. Só depois de gerar, registrar e emitir o painel o caminho operacional confirma que o Word está disponível. Isso não confirma download nem abertura no Word. Pedidos de relatório identificados, mas incompletos, recebem esclarecimento determinístico em vez de uma promessa do modelo.

## Dois links de download

Foram encontrados dois arquivos reais de Rick e Renner em `reports/`:

| Arquivo | Criação UTC | SHA-256 do document.xml (prefixo) |
| --- | --- | --- |
| relatorio-d2075bc3-259a-4551-a4c5-4f8f9ce2bb76.docx | 2026-09-24 03:04:14.129 | 6e524a8ade91 |
| relatorio-376129f3-b38e-418d-8916-ff489747b8c0.docx | 2026-09-24 03:04:47.749 | 0902a77c8d9f |

Isso comprova duas criações, com XMLs diferentes, e não apenas dois elementos apontando ao mesmo arquivo. Não prova que o conteúdo substantivo fosse diferente nem distingue duas intenções de uma repetição acidental. Os arquivos antigos não guardam identidade da operação/origem; não é possível atribuir retrospectivamente voz versus botão. O código acumulava um artefato a cada geração e o componente rotulava todos igualmente.

Agora a mesma operação compartilha a mesma Promise/resultado na conexão e não escreve novamente, mesmo durante execução ou depois de terminada. O registro usa artifactId. O frontend também apresenta uma vez cada identidade recebida, inclusive payload duplicado. Duas operações deliberadas diferentes continuam criando dois arquivos, rotulados com data/hora e ID. A proteção de clique duplo, a substituição de blade pelo mesmo ID e a rejeição de eventos tardios da 1A/1B permanecem.

Reconexão não reenvia pedidos automaticamente. O mapa de pesquisas pertence à conexão; uma ação com ID antigo é recusada. Não há registro persistente de operações entre reinicializações. Não foi adicionada infraestrutura de memória.

## Arquivos alterados

- Backend: `bridge/ollama.mjs`, novo `conversation-context.mjs`, `local-commands.mjs`, `research.mjs`, `reports.mjs`.
- Frontend: `src/App.tsx`, `src/lib/research-actions.ts`, `src/lib/bridge.ts`, `src/ui/ResearchResult.tsx`, `src/ui/Diagnostics.tsx`.
- Testes: novo `bridge/hotfix-1b1.test.mjs`; ajustes nos testes `research.test.mjs`, `research-quality.test.mjs`, `research-ui.test.mjs` para seleção explícita, metadados e payload duplicado.
- Documentação: este arquivo, inventário, `ESTADO_ATUAL.md` e `ROADMAP.md`.

## Validação

Suíte: os 43 testes existentes mais sete testes do hotfix, **50 testes aprovados, zero falhas**. Os novos casos verificam esportes sem exemplos, energia → esportes → DOCX real, pesquisa antiga Rick → energia → dois DOCX reais de Rick, repetição da operação, falha de gravação/recibo inválido, histórico legítimo separado, sequência A → B → comando comum → C e payload real enviado pelo adaptador Ollama com fetch simulado. O teste de UI verifica controles, origem button, parsing voice e artefato duplicado. Testes existentes cobrem cancelamento, resposta tardia, clique duplo e reconexão sem replay.

```powershell
node --test bridge/local-commands.test.mjs bridge/research.test.mjs bridge/requests.test.mjs bridge/frontend.test.mjs bridge/claude-lifecycle.test.mjs bridge/tts.test.mjs bridge/research-quality.test.mjs bridge/research-ui.test.mjs bridge/hotfix-1b1.test.mjs
npm run build
npm run lint
git diff --check
```

Resultado final: `npm run build` aprovado (avisos anteriores de módulos Node externalizados e tamanho de bundle); `npm run lint` aprovado, zero erros e os dois avisos anteriores de `err` em chrome.mjs e `probeUrl` em server.mjs; `git diff --check` aprovado, apenas avisos de conversão LF/CRLF do Git.

Testes usam rede/modelos simulados e diretórios temporários para os DOCX; não alteram os documentos existentes. Conferem o conteúdo editável do ZIP/XML, sem validar visualmente a paginação no Microsoft Word.

## Validação manual antes da Etapa 1C

Após reiniciar o bridge com o código novo e atualizar a página:

1. Pesquisar energia solar, depois principais eventos de esporte recentes; exportar a pesquisa de esportes por voz e conferir conteúdo/fontes no Word.
2. Pesquisar Rick e Renner, depois energia solar; focar o painel antigo e exportá-lo por voz e botão. Conferir researchId/reportResearchId no diagnóstico.
3. Durante uma geração, clicar duas vezes; esperar um arquivo. Pedir outra geração deliberadamente; esperar dois links identificáveis.
4. Perguntar “Quando a dupla foi formada?” após pesquisar Rick e Renner; avaliar continuidade no modelo local real.
5. Exercitar ouvir/parar, fontes, conteúdo completo, pesquisar novamente, interrupção e reconexão. Um painel de conexão anterior exige nova pesquisa.

Limites: testes não comprovam relevância/atualidade de resultados reais, microfone/TTS, comportamento probabilístico do modelo ou entrega HTTP/download no navegador. O prompt conversacional não é uma garantia matemática contra afirmações falsas; solicitações operacionais reconhecidas são resolvidas fora dele. Se houver cancelamento exatamente durante a escrita, pode restar um arquivo sem link, sem anúncio de sucesso, como no fluxo anterior. Não houve reinício do serviço em uso, instalação, alteração de credenciais, commit ou publicação. Antes da 1C, falta a validação manual acima; nenhuma mudança arquitetural adicional foi identificada como necessária por estes testes.
